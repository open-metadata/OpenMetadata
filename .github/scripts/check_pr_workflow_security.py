"""Reject credentials and write permissions in jobs reachable from pull_request."""

from __future__ import annotations

import re
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
READ_TOKEN = re.compile(
    r"\bsecrets(?:\.GITHUB_TOKEN\b|\[\s*'GITHUB_TOKEN'\s*\])", re.IGNORECASE
)


def split_expression(expression: str, operator: str) -> list[str]:
    """Split boolean terms without interpreting function calls or quoted strings."""
    parts = []
    depth = start = index = 0
    quoted = False
    while index < len(expression):
        char = expression[index]
        if char == "'":
            if quoted and expression[index : index + 2] == "''":
                index += 2
                continue
            quoted = not quoted
        elif not quoted:
            if char in "([":
                depth += 1
            elif char in ")]":
                depth -= 1
            elif depth == 0 and expression.startswith(operator, index):
                parts.append(expression[start:index].strip())
                index += len(operator)
                start = index
                continue
        index += 1
    return parts + [expression[start:].strip()]


def excludes_pull_request(condition: str) -> bool:
    """Prove exclusion from explicit event predicates; unknown terms remain reachable."""
    expression = condition.strip().removeprefix("${{").removesuffix("}}").strip()
    while expression.startswith("(") and expression.endswith(")"):
        # An outer pair encloses the whole expression only if it never closes early.
        depth = 0
        quoted = False
        for index, char in enumerate(expression):
            if char == "'":
                quoted = not quoted
            elif not quoted:
                depth += (char == "(") - (char == ")")
                if depth == 0 and index != len(expression) - 1:
                    break
        else:
            expression = expression[1:-1].strip()
            continue
        break
    terms = split_expression(expression, "||")
    if len(terms) > 1:
        return all(excludes_pull_request(term) for term in terms)
    terms = split_expression(expression, "&&")
    if len(terms) > 1:
        return any(excludes_pull_request(term) for term in terms)
    if expression == "false":
        return True
    match = re.fullmatch(r"github\.event_name\s*(==|!=)\s*'([^']+)'", expression)
    if not match:
        return False
    operator, event = match.groups()
    event = event.casefold()
    return (operator == "!=" and event == "pull_request") or (
        operator == "==" and event != "pull_request"
    )


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from strings(item)


def has_secrets(value) -> bool:
    for value_string in strings(value):
        start = value_string.find("${{")
        # A quoted '}}' is legal inside an expression, so scan through the whole value.
        if start >= 0 and re.search(
            r"(?<![\w.])secrets\b",
            READ_TOKEN.sub("", value_string[start:]),
            re.IGNORECASE,
        ):
            return True
    return False


def read_only(permissions) -> bool:
    if permissions == "read-all":
        return True
    return isinstance(permissions, dict) and all(
        value in ("read", "none") for value in permissions.values()
    )


def check_workflows(root: Path = ROOT) -> list[str]:
    failures = []

    def visit(path: Path, inherited_permissions=None, ancestors=()):
        relative = str(path.relative_to(root))
        if relative in ancestors:
            failures.append(f"{relative}: recursive reusable workflow")
            return
        document = yaml.load(path.read_text(), Loader=yaml.BaseLoader)
        workflow_permissions = document.get("permissions", inherited_permissions)
        for job_id, job in document.get("jobs", {}).items():
            if excludes_pull_request(job.get("if", "")):
                continue
            location = f"{relative}: jobs.{job_id}"
            permissions = job.get("permissions", workflow_permissions)
            if not read_only(permissions):
                failures.append(
                    f"{location}: declare read-only permissions for PR execution"
                )
            if job.get("secrets"):
                failures.append(
                    f"{location}: remove secrets forwarding from PR execution"
                )
            if has_secrets(document.get("env", {})) or has_secrets(job):
                failures.append(
                    f"{location}: remove secret references from PR execution"
                )
            if job.get("environment"):
                failures.append(f"{location}: remove the environment from PR execution")
            runner = job.get("runs-on")
            if runner and not (
                isinstance(runner, str)
                and re.fullmatch(r"(?:ubuntu|windows|macos)-[A-Za-z0-9_.-]+", runner)
            ):
                failures.append(
                    f"{location}: use a hosted runner without ambient credentials"
                )
            for step in job.get("steps", []):
                if (
                    step.get("uses", "").startswith("dorny/paths-filter@")
                    and not excludes_pull_request(step.get("if", ""))
                    and permissions != "read-all"
                    and (
                        not isinstance(permissions, dict)
                        or permissions.get("pull-requests") != "read"
                    )
                ):
                    failures.append(
                        f"{location}: PR file detection needs pull-requests: read"
                    )
                if step.get("uses", "").startswith("actions/checkout@"):
                    if step.get("with", {}).get("persist-credentials") != "false":
                        failures.append(
                            f"{location}: checkout must set persist-credentials: false"
                        )
            uses = job.get("uses", "")
            if uses.startswith("./"):
                called = root / uses[2:]
                if not called.is_file():
                    failures.append(
                        f"{location}: reusable workflow does not exist: {uses}"
                    )
                else:
                    visit(called, permissions, (*ancestors, relative))

    for path in sorted((root / ".github/workflows").glob("*.y*ml")):
        document = yaml.load(path.read_text(), Loader=yaml.BaseLoader)
        events = document.get("on", {})
        if events == "pull_request" or (
            isinstance(events, (dict, list)) and "pull_request" in events
        ):
            visit(path)
    return failures


if __name__ == "__main__":
    errors = check_workflows()
    for error in errors:
        print(f"::error::{error}")
    if errors:
        raise SystemExit(1)
    print("PR workflows use read-only tokens and no secrets, including reusable jobs.")
