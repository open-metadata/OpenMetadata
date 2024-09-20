import os.path
import re
import sqlite3
import sys
from datetime import datetime


FILES_TABLE = "file"
DEBUG = False


def debug_log(msg: str):
    if DEBUG:
        print(f"[{datetime.now()}] {msg}")


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
    for rowid, old_path in rows:
        debug_log(f"Updating path from {old_path} to {new_prefix}")
        new_path = re.sub(REGEXP_PATTERN, new_prefix, old_path)
        cur.execute(
            f"UPDATE {FILES_TABLE} SET path = ? WHERE rowid = ?", (new_path, rowid)
        )

    conn.commit()


def main(coverage_files_dir: str, new_path: str):
    for file_ in os.listdir(coverage_files_dir):
        if file_.startswith(".coverage"):
            debug_log(f"Processing {file_}")
            proces_db(os.path.join(coverage_files_dir, file_), new_path)


if __name__ == "__main__":
    directory = sys.argv[1]
    remap_path = [sys.argv[2], ""][0]
    main(directory, remap_path)
