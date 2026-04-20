from __future__ import annotations

import argparse
import json
import sys

from identity_trust_sidecar.config import Settings
from identity_trust_sidecar.om_client import OpenMetadataClient


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="identity-trust-sidecar")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("ping", help="Ping OpenMetadata backend")

    entity = sub.add_parser("get-entity", help="Fetch entity by type + FQN")
    entity.add_argument("--entity-type", required=True)
    entity.add_argument("--fqn", required=True)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    settings = Settings()
    client = OpenMetadataClient(settings.om_base_url.rstrip("/"), settings.om_jwt_token)

    if args.cmd == "ping":
        version = client.get_version()
        print(version)
        return 0

    if args.cmd == "get-entity":
        entity = client.get_entity_by_fqn(args.entity_type, args.fqn)
        print(json.dumps(entity, indent=2))
        return 0

    print(f"Unknown command: {args.cmd}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
 
