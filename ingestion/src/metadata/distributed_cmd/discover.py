#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Entity discovery CLI for distributed ingestion.

Performs lightweight discovery of entities (tables, dashboards, etc.)
and outputs entity descriptors for parallel processing.
"""
import json
import sys
from typing import List

import yaml

from metadata.ingestion.api.distributed import DiscoverableSource, EntityDescriptor
from metadata.utils.logger import cli_logger
from metadata.workflow.metadata import MetadataWorkflow

logger = cli_logger()


def discover_entities_cli(
    config_yaml: str, entity_type: str, output_path: str = "/tmp/entities.json"
) -> List[EntityDescriptor]:
    """
    CLI entry point for entity discovery.

    Args:
        config_yaml: Workflow configuration as YAML string
        entity_type: Type of entities to discover (e.g., "table", "dashboard")
        output_path: Path to write entity descriptors JSON

    Returns:
        List of discovered entity descriptors
    """
    try:
        config_dict = yaml.safe_load(config_yaml)

        workflow = MetadataWorkflow.create(config_dict)
        source = workflow.source

        if not isinstance(source, DiscoverableSource):
            raise ValueError(
                f"Source {source.__class__.__name__} does not support "
                f"distributed execution. Must implement DiscoverableSource."
            )

        logger.info(f"Discovering {entity_type} entities...")

        source.prepare()

        entities = source.discover_entities(entity_type)

        logger.info(f"Discovered {len(entities)} {entity_type} entities")

        entities_json = [e.dict() for e in entities]

        with open(output_path, "w") as f:
            json.dump(entities_json, f, indent=2)

        logger.info(f"Wrote entity descriptors to {output_path}")

        return entities

    except Exception as exc:
        logger.error(f"Discovery failed: {exc}")
        raise


def discover_all_entity_types(config_yaml: str) -> List[EntityDescriptor]:
    """
    Discover all parallelizable entity types for a source.

    Args:
        config_yaml: Workflow configuration as YAML string

    Returns:
        List of all entity descriptors across all types
    """
    config_dict = yaml.safe_load(config_yaml)
    workflow = Workflow.create(config_dict)
    source = workflow.source

    if not isinstance(source, DiscoverableSource):
        raise ValueError(
            f"Source {source.__class__.__name__} does not support distributed execution"
        )

    source.prepare()

    entity_types = source.get_parallelizable_entity_types()
    logger.info(f"Discovering entity types: {entity_types}")

    all_entities = []
    for entity_type in entity_types:
        entities = source.discover_entities(entity_type)
        logger.info(f"Found {len(entities)} {entity_type} entities")
        all_entities.extend(entities)

    logger.info(f"Total entities discovered: {len(all_entities)}")
    return all_entities


def main():
    """
    CLI main function.

    Usage:
        python -m metadata.cmd.discover \\
            --config /path/to/workflow.yaml \\
            --entity-type table \\
            --output /tmp/entities.json
    """
    import argparse

    parser = argparse.ArgumentParser(
        description="Discover entities for distributed ingestion"
    )
    parser.add_argument(
        "--config", required=True, help="Path to workflow configuration YAML"
    )
    parser.add_argument("--entity-type", required=True, help="Entity type to discover")
    parser.add_argument(
        "--output",
        default="/tmp/entities.json",
        help="Output path for entity descriptors JSON",
    )

    args = parser.parse_args()

    with open(args.config) as f:
        config_yaml = f.read()

    try:
        discover_entities_cli(config_yaml, args.entity_type, args.output)
        sys.exit(0)
    except Exception as exc:
        logger.error(f"Discovery failed: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
