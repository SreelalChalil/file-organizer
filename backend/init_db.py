#!/usr/bin/env python3
from pathlib import Path
import argparse
import logging
from db import init_db, import_from_json


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--db", type=Path, default=Path("/var/lib/data_organizer/config.db"), help="Path to sqlite DB")
    p.add_argument("--import-config", type=Path, help="Path to keyword JSON to import into DB")
    p.add_argument("--clear", action="store_true", help="Clear existing tables before importing")
    args = p.parse_args()

    logging.basicConfig(level=logging.INFO)
    # ensure parent dirs exist
    args.db.parent.mkdir(parents=True, exist_ok=True)
    init_db(args.db, clear_existing=args.clear)
    if args.import_config:
        import_from_json(args.db, args.import_config)
        logging.info("Imported %s into %s", args.import_config, args.db)


if __name__ == "__main__":
    main()
