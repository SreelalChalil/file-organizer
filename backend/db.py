#!/usr/bin/env python3
"""Simple SQLite helpers for storing category keywords and disk mappings.

Schema:
  categories(id INTEGER PK, name TEXT UNIQUE, priority INTEGER, target_dir TEXT)
  keywords(id INTEGER PK, category_id INTEGER, keyword TEXT)
  disks(id INTEGER PK, name TEXT UNIQUE, source_dir TEXT, sorted_dir TEXT)

This module provides helpers to create the schema, load a config dict (same
shape as the JSON files used previously), and retrieve disk records.
"""
import sqlite3
import json
from pathlib import Path
from typing import Dict
import sqlite3


def _get_conn(db_path: Path) -> sqlite3.Connection:
    """Gets a connection to the SQLite database, creating it if it doesn't exist."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    # If the database doesn't exist, connect to it (which creates the file)
    # and then immediately initialize the schema.
    if not db_path.exists():
        init_db(db_path, clear_existing=False)
    # All subsequent connections will be to the existing, initialized DB.
    return sqlite3.connect(str(db_path), timeout=10)


def init_db(db_path: Path, clear_existing: bool = False):
    """Initializes the database schema. Creates tables if they don't exist."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()

    cur.execute("""CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY,
        name TEXT UNIQUE,
        priority INTEGER,
        target_dir TEXT
    )""")

    cur.execute("""CREATE TABLE IF NOT EXISTS keywords (
        id INTEGER PRIMARY KEY,
        category_id INTEGER,
        keyword TEXT,
        FOREIGN KEY(category_id) REFERENCES categories(id)
    )""")

    cur.execute("""CREATE TABLE IF NOT EXISTS disks (
        id INTEGER PRIMARY KEY,
        name TEXT UNIQUE,
        source_dir TEXT,
        sorted_dir TEXT,
        schedule TEXT
    )""")

    cur.execute("""CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY,
        disk_name TEXT,
        source_path TEXT,
        status TEXT,
        files_moved INTEGER,
        log_file TEXT,
        start_ts DATETIME,
        end_ts DATETIME
    )""")

    if clear_existing:
        cur.execute("DELETE FROM keywords")
        cur.execute("DELETE FROM categories")
        cur.execute("DELETE FROM disks")

    conn.commit()
    conn.close()


def load_config_from_db(db_path: Path) -> Dict:
    """Loads all categories and keywords from the DB into a dictionary."""
    conn = _get_conn(db_path)
    cur = conn.cursor()

    cur.execute("SELECT id, name, priority, target_dir FROM categories")
    rows = cur.fetchall()

    config = {}
    for row in rows:
        cid, name, priority, target_dir = row
        cur.execute("SELECT keyword FROM keywords WHERE category_id = ?", (cid,))
        kws = [k[0] for k in cur.fetchall()]
        config[name] = {"keywords": kws, "priority": priority, "target_dir": target_dir}

    conn.close()
    return config


def import_from_json(db_path: Path, json_path: Path):
    """Imports categories and keywords from a JSON file, replacing all existing data."""
    with open(json_path) as f:
        categories_data = json.load(f)
    # This function is designed to be atomic and handles the array format.
    # It's perfect for replacing the old dictionary-based import.
    replace_all_categories(db_path, categories_data)


def add_category(db_path: Path, name: str, priority: int, target_dir: str):
    """Adds a new category. Ignores if a category with the same name already exists."""
    conn = _get_conn(db_path)
    cur = conn.cursor()
    cur.execute("INSERT OR IGNORE INTO categories (name, priority, target_dir) VALUES (?, ?, ?)", (name, priority, target_dir))
    conn.commit()
    conn.close()


def add_keyword(db_path: Path, category_name: str, keyword: str):
    """Adds a keyword to an existing category."""
    conn = _get_conn(db_path)
    cur = conn.cursor()
    cur.execute("SELECT id FROM categories WHERE name = ?", (category_name,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise ValueError("category not found")
    cid = row[0]
    cur.execute("INSERT INTO keywords (category_id, keyword) VALUES (?, ?)", (cid, keyword))
    conn.commit()
    conn.close()


def list_categories(db_path: Path):
    """Lists all categories with their associated keywords."""
    conn = _get_conn(db_path)
    cur = conn.cursor()
    cur.execute("SELECT id, name, priority, target_dir FROM categories ORDER BY priority DESC, name")
    cat_rows = cur.fetchall()
    
    # N+1 query fix: Fetch all keywords in one go
    cur.execute("SELECT category_id, keyword FROM keywords")
    kw_rows = cur.fetchall()
    
    # Group keywords by category_id
    keywords_by_cat = {}
    for cid, kw in kw_rows:
        keywords_by_cat.setdefault(cid, []).append(kw)

    cats = []
    for r in cat_rows:
        cid, name, priority, target_dir = r
        kws = keywords_by_cat.get(cid, [])
        cats.append({"id": cid, "name": name, "priority": priority, "target_dir": target_dir, "keywords": kws})
    conn.close()
    return cats


def delete_disk(db_path: Path, name: str):
    """Deletes a disk configuration by name."""
    conn = _get_conn(db_path)
    cur = conn.cursor()
    cur.execute("DELETE FROM disks WHERE name = ?", (name,))
    conn.commit()
    conn.close()


def delete_category(db_path: Path, name: str):
    """Deletes a category and all its associated keywords by name."""
    conn = _get_conn(db_path)
    cur = conn.cursor()
    cur.execute("SELECT id FROM categories WHERE name = ?", (name,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return False
    cid = row[0]
    cur.execute("DELETE FROM keywords WHERE category_id = ?", (cid,))
    cur.execute("DELETE FROM categories WHERE id = ?", (cid,))
    conn.commit()
    conn.close()
    return True


def update_disk(db_path: Path, name: str, source_dir: str, sorted_dir: str, schedule: str = None):
    """Updates the paths and schedule for an existing disk."""
    conn = _get_conn(db_path)
    cur = conn.cursor()
    cur.execute("UPDATE disks SET source_dir = ?, sorted_dir = ?, schedule = ? WHERE name = ?", (source_dir, sorted_dir, schedule, name))
    conn.commit()
    conn.close()


def update_category(db_path: Path, name: str, priority: int, target_dir: str):
    """Updates the priority and target directory for an existing category."""
    conn = _get_conn(db_path)
    cur = conn.cursor()
    cur.execute("UPDATE categories SET priority = ?, target_dir = ? WHERE name = ?", (priority, target_dir, name))
    conn.commit()
    conn.close()


def upsert_category(db_path: Path, name: str, priority: int, target_dir: str, keywords: list):
    """Insert or update a category and replace its keywords atomically."""
    conn = _get_conn(db_path)
    cur = conn.cursor()
    # insert or ignore
    cur.execute("INSERT OR IGNORE INTO categories (name, priority, target_dir) VALUES (?, ?, ?)", (name, priority, target_dir))
    cur.execute("UPDATE categories SET priority = ?, target_dir = ? WHERE name = ?", (priority, target_dir, name))
    cur.execute("SELECT id FROM categories WHERE name = ?", (name,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise ValueError('failed to upsert category')
    cid = row[0]
    # replace keywords
    cur.execute("DELETE FROM keywords WHERE category_id = ?", (cid,))
    for kw in keywords:
        cur.execute("INSERT INTO keywords (category_id, keyword) VALUES (?, ?)", (cid, kw))
    conn.commit()
    conn.close()


def replace_all_categories(db_path: Path, categories_data: list):
    """Atomically replaces all categories and keywords from a list of category objects."""
    conn = _get_conn(db_path)
    cur = conn.cursor()
    try:
        # Start a transaction
        cur.execute("BEGIN")
        cur.execute("DELETE FROM keywords")
        cur.execute("DELETE FROM categories")
        for cat in categories_data:
            cur.execute("INSERT INTO categories (name, priority, target_dir) VALUES (?, ?, ?)",
                        (cat['name'], cat['priority'], cat['target_dir']))
            cat_id = cur.lastrowid
            for kw in cat.get('keywords', []):
                cur.execute("INSERT INTO keywords (category_id, keyword) VALUES (?, ?)", (cat_id, kw))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def merge_categories_from_data(db_path: Path, categories_data: list):
    """Merges categories from a list of data, updating existing ones and adding new ones."""
    conn = _get_conn(db_path)
    try:
        for cat in categories_data:
            # This re-uses the existing atomic upsert logic for each category
            upsert_category(db_path, cat['name'], cat['priority'], cat['target_dir'], cat.get('keywords', []))
    except Exception:
        # The upsert_category function handles its own transactions, so we just need to catch and re-raise
        raise
    finally:
        conn.close()


def get_disks(db_path: Path):
    """Retrieves all disk configurations from the database."""
    conn = _get_conn(db_path)
    cur = conn.cursor()
    cur.execute("SELECT name, source_dir, sorted_dir, schedule FROM disks")
    rows = cur.fetchall()
    conn.close()
    return [dict(name=r[0], source_dir=r[1], sorted_dir=r[2], schedule=r[3]) for r in rows]


def upsert_disk(db_path: Path, name: str, source_dir: str, sorted_dir: str, schedule: str = None):
    """Inserts a new disk or updates an existing one based on its name."""
    conn = _get_conn(db_path)
    cur = conn.cursor()
    # Use UPSERT: try insert, on conflict(name) update
    cur.execute(
        "INSERT INTO disks (name, source_dir, sorted_dir, schedule) VALUES (?, ?, ?, ?) ON CONFLICT(name) DO UPDATE SET source_dir=excluded.source_dir, sorted_dir=excluded.sorted_dir, schedule=excluded.schedule",
        (name, source_dir, sorted_dir, schedule)
    )
    conn.commit()
    conn.close()


def create_run(db_path: Path, disk_name: str, source_path: str, log_file: str) -> int:
    """Creates a new record for a file organization run and returns its ID."""
    conn = _get_conn(db_path)
    cur = conn.cursor()
    cur.execute("INSERT INTO runs (disk_name, source_path, status, start_ts, log_file) VALUES (?, ?, ?, ?, ?)",
                (disk_name, source_path, 'running', sqlite3.datetime.datetime.now(), log_file))
    run_id = cur.lastrowid
    conn.commit()
    conn.close()
    return run_id


def update_run_status(db_path: Path, run_id: int, status: str, files_moved: int):
    """Updates the status, files moved count, and end time for a run."""
    conn = _get_conn(db_path)
    cur = conn.cursor()
    cur.execute("UPDATE runs SET status = ?, files_moved = ?, end_ts = ? WHERE id = ?",
                (status, files_moved, sqlite3.datetime.datetime.now(), run_id))
    conn.commit()
    conn.close()


def list_runs(db_path: Path):
    """Lists all historical runs, ordered by the most recent first."""
    conn = _get_conn(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT * FROM runs ORDER BY start_ts DESC")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def get_run(db_path: Path, run_id: int):
    """Retrieves a single run's details by its ID."""
    conn = _get_conn(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT * FROM runs WHERE id = ?", (run_id,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None
