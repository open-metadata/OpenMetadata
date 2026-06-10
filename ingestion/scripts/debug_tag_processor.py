#!/usr/bin/env python3
"""
Debug tool for the OpenMetadata TagProcessor.

Runs the TagProcessor against a list of values and prints which tags are
assigned, together with their confidence score and the reason.  Useful for
diagnosing false-positive classifications (e.g. year columns tagged as
CreditCard / Sensitive).

USAGE
-----
# values from a file
python debug_tag_processor.py --values-file years.txt

# values piped via stdin
echo -e "1999\\n2000\\n2001" | python debug_tag_processor.py

# values as a CLI argument (newline-separated)
python debug_tag_processor.py --values $'1999\\n2000\\n2001'

CONNECTION (pick one approach, in order of precedence)
-------------------------------------------------------
  1. CLI flags: --host / --jwt-token
  2. Environment variables: OPENMETADATA_HOST / OPENMETADATA_JWT_TOKEN

OPTIONS
-------
  --host          OpenMetadata server URL (default: http://localhost:8585/api)
  --jwt-token     JWT token for authentication
  --column-name   Column name to simulate (affects name-based recognizers, default: "value")
  --confidence    Confidence threshold 0-100 (default: 80)
  --language      Classification language: en, es, de, fr, pt, it, zh, ja, ko, nl, any (default: en)
  --classification  Restrict to a specific classification name (can repeat)
  --values-file   File with one value per line
  --values        Newline-separated string of values
  --verbose       Show per-tag scores and detailed reasons
  --no-ssl-verify Skip SSL certificate verification (useful for self-signed certs)
  --ca-cert       Path to CA bundle for full SSL verification

SSL modes (in order of precedence):
  --ca-cert provided  → full validation with that CA bundle
  default             → connect over HTTPS, skip certificate check (ignore)
  --no-ssl-verify     → plain HTTP / disable SSL entirely (no-ssl)
"""

from __future__ import annotations

# ruff: noqa: T201  -- CLI tool, print is intentional
import argparse
import json
import os
import sys
from pathlib import Path

from metadata.generated.schema.type.basic import FullyQualifiedEntityName

# ---------------------------------------------------------------------------
# Lazy imports so the script fails fast with a clear message if the package
# is not installed rather than a confusing ImportError stack trace.
# ---------------------------------------------------------------------------
try:
    from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType
    from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
        AuthProvider,
        OpenMetadataConnection,
    )
    from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
        OpenMetadataJWTClientConfig,
    )
    from metadata.generated.schema.security.ssl import validateSSLClientConfig, verifySSLConfig
    from metadata.generated.schema.type.classificationLanguages import ClassificationLanguage
    from metadata.ingestion.api.parser import parse_workflow_config_gracefully
    from metadata.ingestion.ometa.mixins.server_mixin import OMetaServerMixin
    from metadata.ingestion.ometa.ometa_api import OpenMetadata
    from metadata.pii.tag_processor import TagProcessor
except ImportError as exc:
    sys.exit(
        f"Import error: {exc}\n"
        "Make sure the OpenMetadata ingestion package is installed:\n"
        "  cd ingestion && pip install -e '.[all]'\n"
        "or activate the project venv first: source env/bin/activate"
    )


# ---------------------------------------------------------------------------
# Patch version check: the installed client version may differ from the server
# (common when running against customer instances).  A failed version handshake
# should not block the debug tool from working.
# ---------------------------------------------------------------------------
_original_validate_versions = OMetaServerMixin.validate_versions


def _lenient_validate_versions(self) -> None:
    try:
        _original_validate_versions(self)
    except Exception as exc:
        print(
            f"[warn] Version check skipped ({type(exc).__name__}: {exc})",
            file=sys.stderr,
        )


OMetaServerMixin.validate_versions = _lenient_validate_versions  # type: ignore[method-assign]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _ssl_mode(no_ssl_verify: bool, ca_cert: str | None) -> str:
    """Return the verifySSL string value for the workflow config dict."""
    if no_ssl_verify:
        return "no-ssl"
    if ca_cert:
        return "validate"
    return "ignore"


def _build_workflow_config_dict(
    host: str,
    jwt_token: str,
    confidence: float,
    language: str,
    no_ssl_verify: bool,
    ca_cert: str | None,
) -> dict:
    """Return a plain dict that parse_workflow_config_gracefully can parse."""
    server_config: dict = {
        "hostPort": host,
        "authProvider": "openmetadata",
        "securityConfig": {"jwtToken": jwt_token},
        "verifySSL": _ssl_mode(no_ssl_verify, ca_cert),
    }
    if ca_cert:
        server_config["sslConfig"] = {"caCertificate": ca_cert}

    return {
        "source": {
            "type": "autoClassification",
            "sourceConfig": {
                "config": {
                    "type": "AutoClassification",
                    "enableAutoClassification": True,
                    "confidence": confidence,
                    "classificationLanguage": language,
                }
            },
        },
        "workflowConfig": {
            "openMetadataServerConfig": server_config,
        },
    }


def _build_ometa_connection(
    host: str,
    jwt_token: str,
    no_ssl_verify: bool,
    ca_cert: str | None,
) -> OpenMetadataConnection:
    ssl_config = None
    if ca_cert:
        ssl_config = verifySSLConfig.SslConfig(validateSSLClientConfig.ValidateSslClientConfig(caCertificate=ca_cert))
    verify_ssl_value = verifySSLConfig.VerifySSL[_ssl_mode(no_ssl_verify, ca_cert).replace("-", "_")]
    return OpenMetadataConnection(
        hostPort=host,
        authProvider=AuthProvider.openmetadata,
        securityConfig=OpenMetadataJWTClientConfig(jwtToken=jwt_token),
        verifySSL=verify_ssl_value,
        sslConfig=ssl_config,
    )


def _read_values(
    values_file: str | None,
    values_str: str | None,
) -> list[str]:
    if values_file:
        with Path(values_file).open() as fh:
            lines = fh.read().splitlines()
    elif values_str:
        lines = values_str.splitlines()
    elif not sys.stdin.isatty():
        lines = sys.stdin.read().splitlines()
    else:
        sys.exit("No values provided.  Use --values-file, --values, or pipe values via stdin.")

    return [line for line in lines if line.strip()]


def _build_column(column_name: str) -> Column:
    return Column(
        name=ColumnName(root=column_name),
        dataType=DataType.VARCHAR,
        fullyQualifiedName=FullyQualifiedEntityName(root=f"db.schema.table.{column_name}"),
        tags=[],
    )


def _print_results(tag_labels, verbose: bool) -> None:
    if not tag_labels:
        print("No tags assigned.")
        return

    for label in tag_labels:
        fqn = label.tagFQN.root if label.tagFQN else "unknown"
        line = f"  {fqn}"
        if verbose and label.reason:
            line += f"  (reason: {label.reason})"
        if verbose and label.metadata and label.metadata.recognizer:
            rec = label.metadata.recognizer
            if hasattr(rec, "score"):
                line += f"  [score={rec.score:.3f}]"
        print(line)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--host", default=None, help="OpenMetadata server URL")
    parser.add_argument("--jwt-token", default=None, dest="jwt_token", help="JWT token")
    parser.add_argument(
        "--column-name",
        default="value",
        dest="column_name",
        help="Simulated column name (influences name-based recognizers)",
    )
    parser.add_argument(
        "--confidence",
        type=float,
        default=80.0,
        help="Confidence threshold 0-100 (default: 80)",
    )
    parser.add_argument(
        "--language",
        default="en",
        choices=[lang.value for lang in ClassificationLanguage],
        help="Classification language (default: en)",
    )
    parser.add_argument(
        "--classification",
        action="append",
        dest="classifications",
        metavar="NAME",
        help="Restrict to classification by name (repeatable)",
    )
    parser.add_argument("--values-file", dest="values_file", help="File with one value per line")
    parser.add_argument("--values", help="Newline-separated string of values")
    parser.add_argument("--verbose", action="store_true", help="Show scores and reasons")
    parser.add_argument(
        "--no-ssl-verify",
        action="store_true",
        dest="no_ssl_verify",
        help="Disable SSL entirely (use for plain HTTP endpoints)",
    )
    parser.add_argument(
        "--ca-cert",
        dest="ca_cert",
        default=None,
        help="Path to CA certificate for full SSL verification",
    )
    parser.add_argument(
        "--output-json",
        action="store_true",
        dest="output_json",
        help="Emit results as JSON",
    )

    args = parser.parse_args()

    host = args.host or os.environ.get("OPENMETADATA_HOST") or "http://localhost:8585/api"
    jwt_token = args.jwt_token or os.environ.get("OPENMETADATA_JWT_TOKEN")

    if not jwt_token:
        sys.exit("JWT token is required.  Pass --jwt-token or set OPENMETADATA_JWT_TOKEN.")

    values = _read_values(args.values_file, args.values)

    ssl_label = "no-ssl" if args.no_ssl_verify else ("validate" if args.ca_cert else "ignore")
    print(f"Host          : {host}", file=sys.stderr)
    print(f"SSL mode      : {ssl_label}", file=sys.stderr)
    print(f"Column name   : {args.column_name}", file=sys.stderr)
    print(f"Values        : {len(values)} item(s)", file=sys.stderr)
    print(f"Confidence    : {args.confidence}", file=sys.stderr)
    print(f"Language      : {args.language}", file=sys.stderr)
    if args.classifications:
        print(f"Classifications: {', '.join(args.classifications)}", file=sys.stderr)
    print("", file=sys.stderr)

    ometa_conn = _build_ometa_connection(host, jwt_token, args.no_ssl_verify, args.ca_cert)
    metadata = OpenMetadata(ometa_conn)

    workflow_config_dict = _build_workflow_config_dict(
        host=host,
        jwt_token=jwt_token,
        confidence=args.confidence,
        language=args.language,
        no_ssl_verify=args.no_ssl_verify,
        ca_cert=args.ca_cert,
    )
    workflow_config = parse_workflow_config_gracefully(workflow_config_dict)

    print("Initializing TagProcessor (fetching classifications from server)...", file=sys.stderr)
    processor = TagProcessor(
        config=workflow_config,
        metadata=metadata,
        classification_filter=args.classifications or None,
    )

    column = _build_column(args.column_name)

    print("Running classification...", file=sys.stderr)
    tag_labels = processor.create_column_tag_labels(column=column, sample_data=values)

    if args.output_json:
        output = [
            {
                "tagFQN": label.tagFQN.root if label.tagFQN else None,
                "reason": label.reason,
                "state": label.state.value if label.state else None,
                "labelType": label.labelType.value if label.labelType else None,
            }
            for label in tag_labels
        ]
        print(json.dumps(output, indent=2))
    else:
        print(f"\nResults for column '{args.column_name}' ({len(values)} values):")
        if tag_labels:
            print(f"  Tags assigned ({len(tag_labels)}):")
            _print_results(tag_labels, args.verbose)
        else:
            print("  No tags assigned.")


if __name__ == "__main__":
    main()
