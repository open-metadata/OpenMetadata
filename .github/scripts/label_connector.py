"""Auto-label connector bugs.

Reads the "Connector" field from the issue body and applies one connector:* label.
- Exactly one rule matches → that label.
- Zero or multiple matches → connector:other.
Any other connector:* label this script manages is removed.

To add a connector: append one row to RULES.
"""

import json
import os
import re
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

RULES = [
    ("connector:mssql",         r"\b(mssql|ms ?sql|sql ?server)\b"),
    ("connector:mysql",         r"\bmysql\b"),
    ("connector:s3",            r"\b(aws )?s3\b"),
    ("connector:bigquery",      r"\b(big ?query|gcp bigquery)\b"),
    ("connector:snowflake",     r"\bsnowflake\b"),
    ("connector:redshift",      r"\b(aws )?redshift\b"),
    ("connector:unity-catalog", r"\bunity ?catalog\b"),
    ("connector:powerbi",       r"\bpower ?bi\b"),
    ("connector:postgres",      r"\bpostgres(ql)?\b"),
    ("connector:athena",        r"\b(aws )?athena\b"),
    ("connector:tableau",       r"\btableau\b"),
    ("connector:looker",        r"\blooker\b"),
    ("connector:airflow",       r"\b(apache )?airflow\b"),
    ("connector:dbt",           r"\bdbt( ?cloud| ?core)?\b"),
    ("connector:databricks",    r"\bdatabricks\b"),
    ("connector:fabric",        r"\b(microsoft |ms )?fabric\b"),
]

OTHER = "connector:other"
MANAGED = {label for label, _ in RULES} | {OTHER}

TOKEN = os.environ["GITHUB_TOKEN"]
REPO = os.environ["GITHUB_REPOSITORY"]


def gh(method, path, body=None, ok=(200, 201, 204)):
    data = json.dumps(body).encode() if body else None
    req = Request(
        f"https://api.github.com/repos/{REPO}{path}",
        data=data, method=method,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
        },
    )
    try:
        with urlopen(req) as r:
            status = r.status
    except HTTPError as e:
        status = e.code
    if status not in ok:
        raise RuntimeError(f"{method} {path} returned HTTP {status}")
    return status


def classify(field_value):
    norm = re.sub(r"\s+", " ", re.sub(r"[_\-/.,()]", " ", field_value.lower())).strip()
    hits = [label for label, pattern in RULES if re.search(pattern, norm)]
    return hits[0] if len(hits) == 1 else OTHER


def main():
    with open(os.environ["GITHUB_EVENT_PATH"]) as f:
        issue = json.load(f)["issue"]

    match = re.search(r"### Connector\s*\n+\s*([^\n]+)", issue.get("body") or "")
    field = match.group(1).strip() if match else ""
    if not field or field == "_No response_":
        print("No Connector field — skipping.")
        return

    target = classify(field)
    current = {label["name"] for label in issue.get("labels", [])}
    print(f'Resolved to "{target}"')

    if gh("GET", f"/labels/{quote(target, safe='')}", ok=(200, 404)) == 404:
        gh("POST", "/labels", {"name": target, "color": "aaaaaa", "description": "Connector"})

    for label in current & MANAGED - {target}:
        gh("DELETE", f"/issues/{issue['number']}/labels/{quote(label, safe='')}", ok=(200, 404))
        print(f'Removed "{label}"')

    if target not in current:
        gh("POST", f"/issues/{issue['number']}/labels", {"labels": [target]})
        print(f'Added "{target}"')


if __name__ == "__main__":
    main()
