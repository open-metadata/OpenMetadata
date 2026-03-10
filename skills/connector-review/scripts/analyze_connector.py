#!/usr/bin/env python3
"""Analyze an OpenMetadata connector's structure and implementation.

Usage:
    python analyze_connector.py <service_type> <connector_name> [--json]

Example:
    python analyze_connector.py database mysql
    python analyze_connector.py dashboard metabase --json
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


def get_repo_root() -> Path:
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
        check=True,
    )
    return Path(result.stdout.strip())


def analyze_connector(service_type: str, name: str) -> dict:
    root = get_repo_root()
    source_dir = (
        root
        / "ingestion/src/metadata/ingestion/source"
        / service_type
        / name
    )
    spec_dir = (
        root
        / "openmetadata-spec/src/main/resources/json/schema/entity/services/connections"
        / service_type
    )
    test_conn_dir = (
        root
        / "openmetadata-service/src/main/resources/json/data/testConnections"
        / service_type
    )
    unit_test_dir = root / "ingestion/tests/unit/topology" / service_type
    int_test_dir = root / "ingestion/tests/integration" / name

    report = {
        "connector": name,
        "service_type": service_type,
        "source_files": [],
        "schema_file": None,
        "test_connection_file": None,
        "unit_tests": [],
        "integration_tests": [],
        "base_class": None,
        "service_spec": None,
        "connection_pattern": None,
        "capabilities": [],
        "imports": [],
        "issues": [],
    }

    # Source files
    if source_dir.is_dir():
        report["source_files"] = sorted(
            str(f.relative_to(root)) for f in source_dir.rglob("*.py")
        )
    else:
        report["issues"].append(f"Source directory not found: {source_dir}")

    # Schema file
    schema_files = list(spec_dir.glob(f"*{name}*Connection.json"))
    if not schema_files:
        camel = "".join(w.capitalize() for w in name.split("_"))
        schema_files = list(spec_dir.glob(f"*{camel[0].lower() + camel[1:]}*Connection.json"))
    if schema_files:
        report["schema_file"] = str(schema_files[0].relative_to(root))
        schema = json.loads(schema_files[0].read_text())
        props = schema.get("properties", {})
        for cap in [
            "supportsMetadataExtraction",
            "supportsLineageExtraction",
            "supportsUsageExtraction",
            "supportsProfiler",
            "supportsDBTExtraction",
            "supportsDataDiff",
            "supportsQueryComment",
        ]:
            if cap in props:
                report["capabilities"].append(cap)
        if schema.get("additionalProperties", True) is not False:
            report["issues"].append("Schema missing additionalProperties: false")
        if "$id" not in schema:
            report["issues"].append("Schema missing $id")
        if "javaType" not in schema:
            report["issues"].append("Schema missing javaType")
    else:
        report["issues"].append("Connection schema not found")

    # Test connection JSON
    test_conn_files = list(test_conn_dir.glob("*.json"))
    for f in test_conn_files:
        if name.replace("_", "") in f.stem.lower():
            report["test_connection_file"] = str(f.relative_to(root))
            break

    # Unit tests
    if unit_test_dir.is_dir():
        report["unit_tests"] = sorted(
            str(f.relative_to(root))
            for f in unit_test_dir.glob(f"test_{name}*")
        )

    # Integration tests
    if int_test_dir.is_dir():
        report["integration_tests"] = sorted(
            str(f.relative_to(root))
            for f in int_test_dir.rglob("*.py")
        )

    # Base class detection
    metadata_py = source_dir / "metadata.py"
    if metadata_py.is_file():
        content = metadata_py.read_text()
        match = re.search(r"class\s+\w+\(([^)]+)\)", content)
        if match:
            report["base_class"] = match.group(1).strip()

    # ServiceSpec detection
    spec_py = source_dir / "service_spec.py"
    if spec_py.is_file():
        content = spec_py.read_text()
        if "DefaultDatabaseSpec" in content:
            report["service_spec"] = "DefaultDatabaseSpec"
        elif "BaseSpec" in content:
            report["service_spec"] = "BaseSpec"
        else:
            report["service_spec"] = "Unknown"

        if "connection_class" in content:
            report["connection_pattern"] = "BaseConnection"
        elif "metadata_source_class" in content:
            report["connection_pattern"] = "get_connection()"

    # Connection pattern from connection.py
    conn_py = source_dir / "connection.py"
    if conn_py.is_file():
        content = conn_py.read_text()
        if "BaseConnection" in content:
            report["connection_pattern"] = "BaseConnection"
        elif "def get_connection" in content:
            report["connection_pattern"] = "get_connection()"

    # Key imports
    if source_dir.is_dir():
        for py_file in source_dir.glob("*.py"):
            for line in py_file.read_text().splitlines():
                if line.startswith("from metadata"):
                    report["imports"].append(line.strip())
        report["imports"] = sorted(set(report["imports"]))[:20]

    # Validation checks
    if not report["unit_tests"]:
        report["issues"].append("No unit tests found")
    if not report["integration_tests"]:
        report["issues"].append("No integration tests found")
    if not report["test_connection_file"]:
        report["issues"].append("No test connection JSON found")

    # Copyright check
    for py_path_str in report["source_files"]:
        py_path = root / py_path_str
        if py_path.is_file():
            first_line = py_path.read_text().splitlines()[0] if py_path.read_text() else ""
            if "Copyright" not in first_line and first_line != "":
                report["issues"].append(f"Missing copyright header: {py_path_str}")
                break

    # Performance checks
    client_py = source_dir / "client.py"
    if client_py.is_file():
        content = client_py.read_text()
        lines = content.splitlines()
        report["performance"] = {
            "has_pagination": False,
            "list_methods_without_pagination": [],
            "has_shared_session": "Session()" in content,
            "has_retry": "retry" in content or "tenacity" in content,
        }
        # Detect pagination patterns
        if any(
            kw in content
            for kw in [
                "next_link",
                "nextLink",
                "next_page",
                "nextPage",
                "next_cursor",
                "offset",
                "page_size",
                "PAGE_SIZE",
                "$skip",
                "has_more",
            ]
        ):
            report["performance"]["has_pagination"] = True

        # Find list-returning methods without pagination
        for i, line in enumerate(lines):
            if re.match(r"\s+def (get_\w+|list_\w+|fetch_\w+)", line):
                method_name = re.match(
                    r"\s+def (\w+)", line
                ).group(1)
                # Look at next 15 lines for return type hint or body
                body = "\n".join(lines[i : i + 20])
                returns_list = (
                    "List[" in body
                    or "list[" in body
                    or "-> list" in body
                    or ".extend(" in body
                    or "results = []" in body
                )
                has_loop = "while" in body
                if returns_list and not has_loop:
                    report["performance"][
                        "list_methods_without_pagination"
                    ].append(method_name)

        if report["performance"]["list_methods_without_pagination"]:
            methods = ", ".join(
                report["performance"]["list_methods_without_pagination"]
            )
            report["issues"].append(
                f"Possible missing pagination in client methods: {methods}"
            )

    # Memory management checks
    report["memory"] = {
        "unbounded_reads": [],
        "missing_gc_collect": False,
        "unbounded_caches": [],
        "list_accumulation_in_yields": [],
        "unclosed_resources": [],
    }
    if source_dir.is_dir():
        for py_file in source_dir.glob("*.py"):
            py_name = py_file.name
            content = py_file.read_text()
            lines = content.splitlines()

            # Detect unbounded .read() / .readall() / .download_as_string()
            for i, line in enumerate(lines):
                stripped = line.strip()
                if any(
                    pattern in stripped
                    for pattern in [
                        ".read()",
                        ".readall()",
                        ".download_as_string()",
                        ".download_as_bytes()",
                    ]
                ):
                    # Check if there's a size check in the surrounding context
                    context_start = max(0, i - 10)
                    context = "\n".join(lines[context_start:i])
                    has_size_check = any(
                        kw in context
                        for kw in [
                            "ContentLength",
                            "content_length",
                            "file_size",
                            "MAX_FILE_SIZE",
                            "max_size",
                            "size >",
                            "size <",
                            "len(",
                        ]
                    )
                    if not has_size_check:
                        report["memory"]["unbounded_reads"].append(
                            f"{py_name}:{i + 1}: {stripped}"
                        )

            # Detect unbounded caches (dicts assigned in __init__ without maxsize)
            in_init = False
            for line in lines:
                if "def __init__" in line:
                    in_init = True
                    continue
                if in_init:
                    if re.match(r"\s+def \w+\(", line):
                        break
                    cache_match = re.search(
                        r"self\.(_?\w*cache\w*)\s*=\s*\{\}",
                        line,
                        re.IGNORECASE,
                    )
                    if cache_match:
                        cache_name = cache_match.group(1)
                        if f"{cache_name}.clear()" not in content:
                            report["memory"]["unbounded_caches"].append(
                                f"{py_name}: self.{cache_name}"
                            )

            # Detect list accumulation in yield methods
            for i, line in enumerate(lines):
                yield_match = re.match(r"\s+def (yield_\w+)\(", line)
                if yield_match:
                    method_name = yield_match.group(1)
                    # Collect body lines until next def or end of file
                    body_lines = []
                    for j in range(i + 1, min(i + 40, len(lines))):
                        if re.match(r"\s+def \w+\(", lines[j]):
                            break
                        body_lines.append(lines[j])
                    body = "\n".join(body_lines)
                    if (
                        "results = []" in body
                        or "results.append(" in body
                    ) and "yield" not in body:
                        report["memory"]["list_accumulation_in_yields"].append(
                            f"{py_name}: {method_name}"
                        )

        # Check for gc.collect() usage anywhere in source
        all_source = " ".join(
            f.read_text() for f in source_dir.glob("*.py")
        )
        if "gc.collect()" not in all_source and (
            report["memory"]["unbounded_reads"]
            or service_type == "storage"
        ):
            report["memory"]["missing_gc_collect"] = True

    # Generate memory issues
    if report["memory"]["unbounded_reads"]:
        reads = "; ".join(report["memory"]["unbounded_reads"][:5])
        report["issues"].append(
            f"Unbounded file reads without size check (OOM risk): {reads}"
        )
    if report["memory"]["unbounded_caches"]:
        caches = ", ".join(report["memory"]["unbounded_caches"])
        report["issues"].append(
            f"Unbounded caches without clear() or maxsize: {caches}"
        )
    if report["memory"]["list_accumulation_in_yields"]:
        methods = ", ".join(report["memory"]["list_accumulation_in_yields"])
        report["issues"].append(
            f"List accumulation in yield methods (should use generators): {methods}"
        )
    if report["memory"]["missing_gc_collect"] and service_type == "storage":
        report["issues"].append(
            "Storage connector missing gc.collect() — high OOM risk with large files"
        )

    # Schema validation: auth required, SSL config, required fields
    if schema_files:
        schema = json.loads(schema_files[0].read_text())
        props = schema.get("properties", {})
        required = schema.get("required", [])

        # Check if auth fields should be required
        has_username = "username" in props
        has_password = "password" in props
        has_token = "token" in props or "apiKey" in props
        if has_username and "username" not in required:
            report["issues"].append(
                "Schema: username defined but not in required array — "
                "if the service requires auth, make it required"
            )
        if has_password and "password" not in required:
            report["issues"].append(
                "Schema: password defined but not in required array — "
                "if the service requires auth, make it required"
            )

        # Check for SSL config on HTTPS connectors
        has_ssl = "verifySSL" in props or "sslConfig" in props
        host_prop = props.get("hostPort", {})
        is_https = host_prop.get("format") == "uri"
        if is_https and not has_ssl:
            report["issues"].append(
                "Schema: HTTPS connector missing verifySSL/sslConfig — "
                "enterprise deployments with internal CAs need this"
            )

    # SonarQube security checks — SSL verification wiring
    if schema_files and source_dir.is_dir():
        schema = json.loads(schema_files[0].read_text())
        props = schema.get("properties", {})
        has_ssl_in_schema = "verifySSL" in props or "sslConfig" in props

        if has_ssl_in_schema:
            # Check client.py uses session.verify
            if client_py.is_file():
                client_content = client_py.read_text()
                uses_verify = (
                    "session.verify" in client_content
                    or ".verify =" in client_content
                    or "verify=" in client_content
                    or "verify_ssl" in client_content
                )
                if not uses_verify:
                    report["issues"].append(
                        "SECURITY: client.py does not set session.verify — "
                        "schema defines verifySSL/sslConfig but client ignores it "
                        "(SonarQube: Security Review will fail)"
                    )

            # Check connection.py resolves SSL config
            if conn_py.is_file():
                conn_content = conn_py.read_text()
                resolves_ssl = (
                    "get_verify_ssl_fn" in conn_content
                    or "ssl_registry" in conn_content
                    or "set_verify_ssl" in conn_content
                    or "verify_ssl" in conn_content
                )
                if not resolves_ssl:
                    report["issues"].append(
                        "SECURITY: connection.py does not resolve SSL config — "
                        "schema defines verifySSL/sslConfig but get_connection() "
                        "does not pass it to client (SonarQube: Security Review will fail)"
                    )

    # Pydantic model checks
    models_py = source_dir / "models.py"
    if models_py.is_file():
        content = models_py.read_text()
        has_alias = "alias=" in content or 'alias="' in content
        has_populate = "populate_by_name" in content
        if has_alias and not has_populate:
            report["issues"].append(
                "models.py: Uses Field(alias=...) without "
                "model_config = ConfigDict(populate_by_name=True) — "
                "constructing with Python attribute names will raise ValidationError"
            )

    # Scaffolding artifact check — verify it's not tracked by git
    context_md = source_dir / "CONNECTOR_CONTEXT.md"
    if context_md.is_file():
        try:
            result = subprocess.run(
                ["git", "ls-files", "--error-unmatch", str(context_md)],
                capture_output=True,
                text=True,
            )
            if result.returncode == 0:
                report["issues"].append(
                    "CONNECTOR_CONTEXT.md is tracked by git — "
                    "it should be gitignored (local AI working document)"
                )
        except Exception:
            pass

    # Lineage precision check
    if metadata_py.is_file():
        content = metadata_py.read_text()
        if 'table_name="*"' in content or "table_name='*'" in content:
            report["issues"].append(
                "metadata.py: Wildcard table_name='*' in lineage search — "
                "links every table in DB to entity (incorrect lineage)"
            )

    # Duplicate test connection steps
    if conn_py.is_file():
        content = conn_py.read_text()
        # Find all function references in test_fn dict
        fn_refs = re.findall(r'"(\w+)":\s*([\w.]+)', content)
        if fn_refs:
            fn_values = [v for _, v in fn_refs]
            seen = {}
            for name_key, fn_val in fn_refs:
                if fn_val in seen:
                    report["issues"].append(
                        f"connection.py: Test steps '{seen[fn_val]}' and '{name_key}' "
                        f"both map to {fn_val} — consider distinct test functions"
                    )
                seen[fn_val] = name_key

    # Empty test stub check
    for test_dir_key in ["unit_tests", "integration_tests"]:
        for test_path_str in report.get(test_dir_key, []):
            test_path = root / test_path_str
            if test_path.is_file() and test_path.suffix == ".py":
                test_content = test_path.read_text()
                # Count real assert statements
                assert_count = len(re.findall(r"^\s+assert\s", test_content, re.MULTILINE))
                # Count pass-only test methods
                pass_methods = re.findall(
                    r"def (test_\w+)\([^)]*\):\s*\n\s+pass\s*$",
                    test_content,
                    re.MULTILINE,
                )
                if pass_methods:
                    report["issues"].append(
                        f"Empty test stubs in {test_path_str}: "
                        f"{', '.join(pass_methods)}"
                    )

    return report


def print_text_report(report: dict) -> None:
    print(f"=== Connector: {report['connector']} ({report['service_type']}) ===")
    print()

    print(f"Base Class:         {report['base_class'] or 'Unknown'}")
    print(f"ServiceSpec:        {report['service_spec'] or 'Unknown'}")
    print(f"Connection Pattern: {report['connection_pattern'] or 'Unknown'}")
    print(f"Capabilities:       {', '.join(report['capabilities']) or 'None detected'}")
    print()

    print(f"--- Source Files ({len(report['source_files'])}) ---")
    for f in report["source_files"]:
        print(f"  {f}")
    print()

    print(f"--- Schema ---")
    print(f"  {report['schema_file'] or 'NOT FOUND'}")
    print()

    print(f"--- Test Connection ---")
    print(f"  {report['test_connection_file'] or 'NOT FOUND'}")
    print()

    print(f"--- Unit Tests ({len(report['unit_tests'])}) ---")
    for f in report["unit_tests"]:
        print(f"  {f}")
    if not report["unit_tests"]:
        print("  NOT FOUND")
    print()

    print(f"--- Integration Tests ({len(report['integration_tests'])}) ---")
    for f in report["integration_tests"]:
        print(f"  {f}")
    if not report["integration_tests"]:
        print("  NOT FOUND")
    print()

    if report["issues"]:
        print(f"--- Issues ({len(report['issues'])}) ---")
        for issue in report["issues"]:
            print(f"  ⚠ {issue}")
    else:
        print("--- No Issues Found ---")


def main():
    parser = argparse.ArgumentParser(description="Analyze an OpenMetadata connector")
    parser.add_argument("service_type", help="Service type (database, dashboard, etc.)")
    parser.add_argument("connector_name", help="Connector name (mysql, metabase, etc.)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    if not re.match(r"^[a-zA-Z0-9_]+$", args.connector_name):
        print("Error: Invalid connector name", file=sys.stderr)
        sys.exit(1)

    if not re.match(r"^[a-zA-Z0-9_]+$", args.service_type):
        print("Error: Invalid service type", file=sys.stderr)
        sys.exit(1)

    report = analyze_connector(args.service_type, args.connector_name)

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print_text_report(report)


if __name__ == "__main__":
    main()
