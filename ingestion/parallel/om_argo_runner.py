#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Argo-only runner for OpenMetadata parallel ingestion.
This is a fallback when Ray/Dask are not available.
Each shard is processed in its own Kubernetes pod.
"""
import json
import logging
import os
import sys
import time
import traceback
from typing import Any, Dict, List, Type

from prometheus_client import Counter, Histogram, start_http_server

from ingestion.parallel.om_adapters import (
    ProcessorAdapter,
    ShardDescriptor,
    SinkAdapter,
    SourceAdapter,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Metrics
RECORDS_PROCESSED = Counter("om_argo_records_processed", "Total records processed")
RECORDS_FAILED = Counter("om_argo_records_failed", "Total records failed")
PROCESSING_TIME = Histogram("om_argo_processing_time", "Time to process a record")
SHARD_PROCESSING_TIME = Histogram("om_argo_shard_time", "Time to process a shard")

# Environment configuration
BATCH_SIZE = int(os.getenv("OM_BATCH_SIZE", "1000"))
ENABLE_METRICS = os.getenv("OM_ENABLE_METRICS", "true").lower() == "true"
DLQ_ENABLED = os.getenv("OM_DLQ_ENABLED", "true").lower() == "true"
DLQ_BUCKET = os.getenv("OM_DLQ_BUCKET", "om-parallel-dlq")


def write_to_dlq(failed_records: List[Dict[str, Any]], shard_id: str, run_id: str):
    """Write failed records to Dead Letter Queue"""
    if not DLQ_ENABLED or not failed_records:
        return

    import tempfile

    dlq_path = os.path.join(
        tempfile.gettempdir(), DLQ_BUCKET, run_id, f"{shard_id}_failures.jsonl"
    )
    os.makedirs(os.path.dirname(dlq_path), exist_ok=True)

    with open(dlq_path, "a") as f:
        for record in failed_records:
            f.write(json.dumps(record) + "\n")

    logger.info(f"Wrote {len(failed_records)} failed records to DLQ: {dlq_path}")


def process_shard(
    shard: Dict[str, Any],
    source_class: str,
    processor_class: str,
    sink_class: str,
    config: Dict[str, Any],
):
    """
    Process a single shard in a dedicated pod.
    This is the main entry point for Argo-only execution.
    """
    start_time = time.time()
    logger.info(f"Processing shard: {shard}")
    shard_desc = ShardDescriptor(**shard)

    # Start metrics server if enabled
    if ENABLE_METRICS:
        start_http_server(8000)

    # Initialize source
    module_name, class_name = source_class.rsplit(".", 1)
    module = __import__(module_name, fromlist=[class_name])
    SourceClass: Type[SourceAdapter] = getattr(module, class_name)
    source = SourceClass(config.get("source", {}))

    # Initialize processor
    module_name, class_name = processor_class.rsplit(".", 1)
    module = __import__(module_name, fromlist=[class_name])
    ProcessorClass: Type[ProcessorAdapter] = getattr(module, class_name)
    processor = ProcessorClass(config.get("processor", {}))

    # Initialize sink
    module_name, class_name = sink_class.rsplit(".", 1)
    module = __import__(module_name, fromlist=[class_name])
    SinkClass: Type[SinkAdapter] = getattr(module, class_name)
    sink = SinkClass(config.get("sink", {}))

    # Process records
    batch_buffer = []
    failed_records = []
    total_success = 0
    total_failed = 0

    try:
        for record in source.iter_records(shard_desc):
            try:
                # Validate record
                if not processor.validate(record):
                    failed_records.append(
                        {
                            "record_id": record.record_id,
                            "error": "Validation failed",
                            "data": record.model_dump(),
                        }
                    )
                    total_failed += 1
                    RECORDS_FAILED.inc()
                    continue

                # Process record
                with PROCESSING_TIME.time():
                    processed = processor.process(record)

                # Add to batch buffer
                batch_buffer.append(processed)

                # Write batch when buffer is full
                if len(batch_buffer) >= BATCH_SIZE:
                    write_results = sink.batch_write(batch_buffer)
                    for record_id, success in write_results.items():
                        if success:
                            total_success += 1
                            RECORDS_PROCESSED.inc()
                        else:
                            total_failed += 1
                            RECORDS_FAILED.inc()
                            # Find the original record for DLQ
                            for proc_rec in batch_buffer:
                                if proc_rec.record_id == record_id:
                                    failed_records.append(
                                        {
                                            "record_id": record_id,
                                            "error": "Sink write failed",
                                            "data": proc_rec.model_dump(),
                                        }
                                    )
                                    break
                    batch_buffer = []

            except Exception as e:
                logger.error(f"Error processing record {record.record_id}: {e}")
                failed_records.append(
                    {
                        "record_id": record.record_id,
                        "error": str(e),
                        "traceback": traceback.format_exc(),
                        "data": record.model_dump(),
                    }
                )
                total_failed += 1
                RECORDS_FAILED.inc()

        # Write remaining records in buffer
        if batch_buffer:
            write_results = sink.batch_write(batch_buffer)
            for record_id, success in write_results.items():
                if success:
                    total_success += 1
                    RECORDS_PROCESSED.inc()
                else:
                    total_failed += 1
                    RECORDS_FAILED.inc()
                    for proc_rec in batch_buffer:
                        if proc_rec.record_id == record_id:
                            failed_records.append(
                                {
                                    "record_id": record_id,
                                    "error": "Sink write failed",
                                    "data": proc_rec.model_dump(),
                                }
                            )
                            break

        # Write failed records to DLQ
        if failed_records:
            write_to_dlq(failed_records, shard_desc.id, source.run_id)

        elapsed_time = time.time() - start_time
        SHARD_PROCESSING_TIME.observe(elapsed_time)

        logger.info(
            f"Shard {shard_desc.id} complete: "
            f"{total_success} success, {total_failed} failed, "
            f"elapsed time: {elapsed_time:.2f}s"
        )

        # Output results for Argo to collect
        result = {
            "shard_id": shard_desc.id,
            "success_count": total_success,
            "failed_count": total_failed,
            "elapsed_time": elapsed_time,
        }
        print(json.dumps(result))

    except Exception as e:
        logger.error(f"Fatal error processing shard {shard_desc.id}: {e}")
        raise


def aggregate_results(result_files: List[str], output_file: str):
    """
    Aggregate results from multiple shard processing runs.
    This is used in the reduce step of Argo workflow.
    """
    total_success = 0
    total_failed = 0
    total_time = 0
    shard_results = []

    for result_file in result_files:
        try:
            with open(result_file, "r") as f:
                result = json.load(f)
                total_success += result["success_count"]
                total_failed += result["failed_count"]
                total_time += result["elapsed_time"]
                shard_results.append(result)
        except Exception as e:
            logger.error(f"Error reading result file {result_file}: {e}")

    aggregate = {
        "total_success": total_success,
        "total_failed": total_failed,
        "total_elapsed_time": total_time,
        "shard_count": len(shard_results),
        "average_time_per_shard": total_time / len(shard_results)
        if shard_results
        else 0,
        "shard_results": shard_results,
    }

    with open(output_file, "w") as f:
        json.dump(aggregate, f, indent=2)

    logger.info(
        f"Aggregated results: {total_success} success, "
        f"{total_failed} failed across {len(shard_results)} shards"
    )


# Entry point for direct execution
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python om_argo_runner.py <command> [args...]")
        print("Commands: process_shard, aggregate_results")
        sys.exit(1)

    command = sys.argv[1]

    if command == "process_shard":
        # Example: python om_argo_runner.py process_shard '{"type":"table","id":"test"}' source.class processor.class sink.class '{}'
        shard = json.loads(sys.argv[2])
        process_shard(
            shard,
            sys.argv[3],  # source_class
            sys.argv[4],  # processor_class
            sys.argv[5],  # sink_class
            json.loads(sys.argv[6]) if len(sys.argv) > 6 else {},  # config
        )
    elif command == "aggregate_results":
        # Example: python om_argo_runner.py aggregate_results result1.json,result2.json output.json
        result_files = sys.argv[2].split(",")
        output_file = sys.argv[3]
        aggregate_results(result_files, output_file)
