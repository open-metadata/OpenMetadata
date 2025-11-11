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
Entity processor CLI for distributed ingestion workers.

Processes a single entity (table, dashboard, etc.) in isolation,
suitable for running in separate pods/containers.
"""
import json
import sys
import time

import yaml

from metadata.ingestion.api.distributed import (
    DiscoverableSource,
    EntityDescriptor,
    ProcessingResult,
)
from metadata.utils.logger import cli_logger
from metadata.workflow.metadata import MetadataWorkflow

logger = cli_logger()


def process_entity_cli(config_yaml: str, entity_json: str) -> ProcessingResult:
    """
    CLI entry point for entity processing.

    Args:
        config_yaml: Workflow configuration as YAML string
        entity_json: Entity descriptor as JSON string

    Returns:
        Processing result with success/failure info
    """
    start_time = time.time()
    entities_created = 0
    error_message = None

    try:
        config_dict = yaml.safe_load(config_yaml)
        entity_dict = json.loads(entity_json)
        entity_descriptor = EntityDescriptor(**entity_dict)

        logger.info(f"Processing {entity_descriptor.type}: {entity_descriptor.id}")

        workflow = MetadataWorkflow.create(config_dict)
        source = workflow.source
        sink = workflow.sink

        if not isinstance(source, DiscoverableSource):
            raise ValueError(
                f"Source {source.__class__.__name__} does not support "
                f"distributed execution"
            )

        source.prepare()

        for entity_request in source.process_entity(entity_descriptor):
            if entity_request.right:
                result = sink.run(entity_request.right)

                if result.left:
                    logger.warning(f"Failed to sink entity: {result.left}")
                else:
                    entities_created += 1
                    logger.debug(f"Successfully created entity: {result.right}")
            else:
                logger.warning(f"Source returned error: {entity_request.left}")

        processing_time = time.time() - start_time
        logger.info(
            f"Successfully processed {entity_descriptor.id} "
            f"({entities_created} entities created, "
            f"{processing_time:.2f}s)"
        )

        return ProcessingResult(
            entity_id=entity_descriptor.id,
            entity_type=entity_descriptor.type,
            success=True,
            entities_created=entities_created,
            processing_time_seconds=processing_time,
        )

    except Exception as exc:
        processing_time = time.time() - start_time
        error_message = str(exc)
        logger.error(
            f"Failed to process entity: {exc}",
            exc_info=True,
        )

        entity_id = "unknown"
        entity_type = "unknown"
        try:
            entity_dict = json.loads(entity_json)
            entity_id = entity_dict.get("id", "unknown")
            entity_type = entity_dict.get("type", "unknown")
        except:
            pass

        return ProcessingResult(
            entity_id=entity_id,
            entity_type=entity_type,
            success=False,
            error=error_message,
            entities_created=entities_created,
            processing_time_seconds=processing_time,
        )


def main():
    """
    CLI main function.

    Usage:
        python -m metadata.cmd.process_entity \\
            --config /path/to/workflow.yaml \\
            --entity '{"id": "...", "type": "table", "metadata": {...}}'
    """
    import argparse

    parser = argparse.ArgumentParser(
        description="Process single entity for distributed ingestion"
    )
    parser.add_argument(
        "--config", required=True, help="Path to workflow configuration YAML"
    )
    parser.add_argument(
        "--entity", required=True, help="Entity descriptor as JSON string"
    )

    args = parser.parse_args()

    with open(args.config) as f:
        config_yaml = f.read()

    try:
        result = process_entity_cli(config_yaml, args.entity)

        if result.success:
            logger.info(f"Processing completed successfully")
            sys.exit(0)
        else:
            logger.error(f"Processing failed: {result.error}")
            sys.exit(1)

    except Exception as exc:
        logger.error(f"Fatal error: {exc}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
