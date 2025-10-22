#!/usr/bin/env python3
"""Shared organiser functions for moving files based on keyword configs.

This module centralises the logic used by `organise_SRL_Data_2.py` and
`organise_SRL_Ext.py` so the behaviour is implemented once and can be
re-used by a CLI or a web UI.
"""
import os
import shutil
import json
from pathlib import Path
from typing import Union
import sqlite3
from app import db as dbmod
import logging
from pathlib import Path


def load_config(config_path: Path):
    """Load config from JSON file or sqlite DB (if config_path suffix is .db).

    When a DB path is provided, `db.load_config_from_db` is used.
    """
    if str(config_path).endswith(".db"):
        return dbmod.load_config_from_db(config_path)
    with open(config_path) as f:
        return json.load(f)


def find_target(file_name: str, config: dict):
    lower_name = file_name.lower()
    matches = []

    for _, info in config.items():
        for kw in info.get("keywords", []):
            if kw.lower() in lower_name:
                matches.append((info.get("priority", 0), info.get("target_dir")))
                break

    if not matches:
        if "Others" in config:
            return config["Others"]["target_dir"]
        return None

    matches.sort(reverse=True, key=lambda x: x[0])
    return matches[0][1]


def ensure_dir_exists(directory: str):
    try:
        os.makedirs(directory, exist_ok=True)
        return True
    except Exception as e:
        logging.getLogger(__name__).error("Failed to create directory %s: %s", directory, e)
        return False


def move_files(source_dir: Path, config_file: Path, dry_run: bool = False, sorted_root: str = None, logger: logging.Logger = None) -> int:
    """Move files from source_dir according to mappings in config_file.

    Returns the number of files moved.
    The function uses the standard logging module; callers should configure
    logging (handlers/format) before calling.
    """
    logger = logger or logging.getLogger(__name__)
    config = None
    try:
        config = load_config(config_file)
        logger.info("Loaded keyword configuration from %s", config_file)
    except Exception as e:
        logger.error("Failed to load config %s: %s", config_file, e)
        raise

    total_moved = 0

    for root, _, files in os.walk(source_dir):
        for file_name in files:
            file_path = Path(root) / file_name

            # Skip files already inside /Sorted/
            if "/Sorted/" in str(file_path):
                continue

            target_dir = find_target(file_name, config)
            if not target_dir:
                continue

            # If a sorted_root is provided, join it with the relative target_dir
            if sorted_root:
                # os.path.join handles if target_dir is absolute
                target_dir = os.path.join(sorted_root, target_dir)

            if not ensure_dir_exists(target_dir):
                continue

            dest_path = Path(target_dir) / file_name

            # Handle duplicate names
            counter = 1
            final_dest = dest_path
            while final_dest.exists():
                final_dest = Path(target_dir) / f"{dest_path.stem}_{counter}{dest_path.suffix}"
                counter += 1

            if dry_run:
                logger.info("DRY RUN: would move %s -> %s", file_path, final_dest)
                total_moved += 1
                continue

            try:
                shutil.move(str(file_path), str(final_dest))
                logger.info("Moved: %s -> %s", file_path, final_dest)
                total_moved += 1
            except Exception as e:
                logger.error("Failed to move %s: %s", file_path, e)

    logger.info("Completed file organization. Total files moved: %d", total_moved)
    return total_moved


def find_empty_dirs(path: Path) -> list[str]:
    """Recursively finds all empty subdirectories within a given path."""
    empty_dirs = []
    # Walk bottom-up to find leaf directories first
    for root, dirs, files in os.walk(path, topdown=False):
        # An empty directory has no files and no subdirectories
        # We check if the current root is empty by checking its contents.
        # os.walk(topdown=False) ensures we've processed subdirs already.
        if not os.listdir(root):
            empty_dirs.append(str(root))
    return empty_dirs


def delete_empty_dirs(dir_paths: list[str]) -> dict:
    """Deletes a list of directories, verifying they are empty first."""
    logger = logging.getLogger(__name__)
    deleted_count = 0
    errors = []
    for path_str in dir_paths:
        try:
            path = Path(path_str)
            if path.exists() and path.is_dir() and not os.listdir(path):
                os.rmdir(path)
                logger.info("Deleted empty directory: %s", path)
                deleted_count += 1
            else:
                errors.append(f"Skipped (not empty or not found): {path_str}")
        except Exception as e:
            errors.append(f"Error deleting {path_str}: {e}")
    return {"deleted": deleted_count, "errors": errors}
