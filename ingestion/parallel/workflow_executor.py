#!/usr/bin/env python3
"""
Workflow executor for Argo-based parallel ingestion.
This module provides CLI commands for discovery and execution phases.
"""

import argparse
import json
import logging
import sys
from typing import Any, Dict, List

import yaml

# Add parent path for imports
sys.path.insert(0, "/app/ingestion/src")
sys.path.insert(0, "/app/ingestion/parallel")

from processor.runner import WorkflowRunner
from processor.sharding import ShardingFactory

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - [%(levelname)s] - %(name)s - %(message)s"
)
logger = logging.getLogger(__name__)


def discover_shards(config_path: str) -> List[Dict[str, Any]]:
    """
    Discover shards for parallel processing.

    Args:
        config_path: Path to workflow configuration file

    Returns:
        List of shard descriptors
    """
    logger.info(f"Loading configuration from {config_path}")

    with open(config_path, "r") as file:
        if config_path.endswith(".json"):
            workflow_config = json.load(file)
        else:
            workflow_config = yaml.safe_load(file)

    strategy = ShardingFactory.create(workflow_config)

    shards = strategy.discover_shards()

    logger.info(f"Discovered {len(shards)} shards for processing")
    return shards


def process_shard(shard_json: str, config_path: str) -> None:
    """
    Process a single shard.

    Args:
        shard_json: JSON string containing shard descriptor
        config_path: Path to workflow configuration file
    """
    shard = json.loads(shard_json)
    shard_id = shard.get("id", "unknown")

    logger.info(f"Processing shard: {shard_id}")

    runner = WorkflowRunner(config_path)
    result = runner.execute_shard(shard)

    if result.get("status") == "success":
        logger.info(f"Successfully processed shard {shard_id}")
    elif result.get("status") == "partial":
        logger.warning(f"Partially processed shard {shard_id} with errors")
    else:
        logger.error(f"Failed to process shard {shard_id}")
        sys.exit(1)


def main():
    """Main entry point for the workflow executor."""
    parser = argparse.ArgumentParser(
        description="OpenMetadata Parallel Workflow Executor"
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # Discover command
    discover_parser = subparsers.add_parser(
        "discover", help="Discover shards for parallel processing"
    )
    discover_parser.add_argument(
        "--config",
        default="/config/workflow-config.yaml",
        help="Path to workflow configuration file",
    )

    # Process command
    process_parser = subparsers.add_parser("process", help="Process a single shard")
    process_parser.add_argument("shard", help="Shard descriptor (JSON)")
    process_parser.add_argument(
        "--config",
        default="/config/workflow-config.yaml",
        help="Path to workflow configuration file",
    )

    args = parser.parse_args()

    if args.command == "discover":
        shards = discover_shards(args.config)
        # Output as JSON for Argo
        print(json.dumps(shards))
        # Also write to file for Argo to capture
        with open("/tmp/shards.json", "w") as f:
            json.dump(shards, f)
        sys.exit(0)

    elif args.command == "process":
        process_shard(args.shard, args.config)
        sys.exit(0)

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
