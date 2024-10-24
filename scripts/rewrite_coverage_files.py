import argparse
import logging
import os.path
import re
import sqlite3
import sys

FILES_TABLE = "file"
DEBUG = True

logger = logging.getLogger(__name__)
handler = logging.StreamHandler(sys.stderr)
logger.addHandler(handler)


def proces_db(path: str, new_prefix: str):
    conn = sqlite3.connect(path)
    cur = conn.cursor()
    # regexp for capturing .nox -> site-packages in a string like:
    # .nox/integration_tests-3-9-integration-postgres/lib/python3.9/site-packages/
    REGEXP_PATTERN = (
        r"\.nox\/(.+)-(\d+)-(.+)-(.+)\/lib\/python(\d+\.\d+)\/site-packages\/"
    )
    cur.execute(f"SELECT rowid, path FROM {FILES_TABLE}")
    rows = cur.fetchall()
    if len(rows) == 0:
        raise RuntimeError(f"No rows found in {path}, '{FILES_TABLE}'")
    for rowid, old_path in rows:
        new_path = re.sub(REGEXP_PATTERN, new_prefix, old_path)
        logger.debug(f"Updating path from {old_path} to {new_path}")
        cur.execute(
            f"UPDATE {FILES_TABLE} SET path = ? WHERE rowid = ?", (new_path, rowid)
        )

    conn.commit()


def main(path: str, new_path: str):
    for dirpath, dirnames, files in os.walk(path):
        for file_ in files:
            if file_.startswith(".coverage"):
                logger.debug(f"Processing {file_}")
                proces_db(os.path.join(dirpath, file_), new_path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=str, help="Path to the directory")
    parser.add_argument("new_path", type=str, help="New path prefix")
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()
    logger.setLevel(logging.DEBUG if args.debug else logging.INFO)
    main(sys.argv[1], sys.argv[2])
