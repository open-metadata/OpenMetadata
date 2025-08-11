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
Ray-based parallel runner for OpenMetadata ingestion.
Handles fan-out processing of records and optional reduce operations.
"""
import json
import logging
import os
import sys
import time
import traceback
from typing import Any, Dict, List, Optional, Type

import ray
from prometheus_client import Counter, Histogram, start_http_server
from ray.util.metrics import Counter as RayCounter

from ingestion.parallel.om_adapters import (
    Combiner,
    Merger,
    PartialAggregate,
    PartialStore,
    ProcessorAdapter,
    Record,
    ShardDescriptor,
    SinkAdapter,
    SourceAdapter,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Metrics
RECORDS_PROCESSED = Counter("om_parallel_records_processed", "Total records processed")
RECORDS_FAILED = Counter("om_parallel_records_failed", "Total records failed")
PROCESSING_TIME = Histogram("om_parallel_processing_time", "Time to process a record")
BATCH_PROCESSING_TIME = Histogram("om_parallel_batch_time", "Time to process a batch")

# Environment configuration
MICROBATCH_SIZE = int(os.getenv("OM_MICROBATCH", "1000"))
RAY_NUM_CPUS = int(os.getenv("RAY_NUM_CPUS", "1"))
ENABLE_METRICS = os.getenv("OM_ENABLE_METRICS", "true").lower() == "true"
DLQ_ENABLED = os.getenv("OM_DLQ_ENABLED", "true").lower() == "true"
DLQ_BUCKET = os.getenv("OM_DLQ_BUCKET", "om-parallel-dlq")
MAX_RETRIES = int(os.getenv("OM_MAX_RETRIES", "3"))


@ray.remote(num_cpus=RAY_NUM_CPUS, max_retries=MAX_RETRIES)
def process_batch(
    batch: List[Dict[str, Any]], processor_class: str, processor_config: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Process a batch of records using the specified processor.
    Returns list of processed records or errors.
    """
    start_time = time.time()

    # Dynamic import of processor class
    module_name, class_name = processor_class.rsplit(".", 1)
    module = __import__(module_name, fromlist=[class_name])
    ProcessorClass: Type[ProcessorAdapter] = getattr(module, class_name)

    processor = ProcessorClass(processor_config)
    results = []

    for record_dict in batch:
        try:
            record = Record(**record_dict)
            if processor.validate(record):
                processed = processor.process(record)
                results.append(
                    {
                        "success": True,
                        "record_id": record.record_id,
                        "data": processed.model_dump(),
                    }
                )
            else:
                results.append(
                    {
                        "success": False,
                        "record_id": record.record_id,
                        "error": "Validation failed",
                    }
                )
        except Exception as e:
            logger.error(f"Error processing record {record_dict.get('record_id')}: {e}")
            results.append(
                {
                    "success": False,
                    "record_id": record_dict.get("record_id", "unknown"),
                    "error": str(e),
                    "traceback": traceback.format_exc(),
                }
            )

    if ENABLE_METRICS:
        ray_counter = RayCounter("processed_records", tag_keys=("status",))
        for result in results:
            status = "success" if result["success"] else "failed"
            ray_counter.inc(1, {"status": status})

    logger.info(
        f"Processed batch of {len(batch)} records in {time.time() - start_time:.2f}s"
    )
    return results


@ray.remote(num_cpus=RAY_NUM_CPUS)
def combine_batch(
    batch: List[Dict[str, Any]], combiner_class: str, combiner_config: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Combine a batch of records into a partial aggregate.
    Used for stateful operations like usage aggregation.
    """
    # Dynamic import of combiner class
    module_name, class_name = combiner_class.rsplit(".", 1)
    module = __import__(module_name, fromlist=[class_name])
    CombinerClass: Type[Combiner] = getattr(module, class_name)

    combiner = CombinerClass()
    accumulator = combiner.zero()

    for record_dict in batch:
        try:
            record = Record(**record_dict)
            accumulator = combiner.combine(accumulator, record)
        except Exception as e:
            logger.error(f"Error combining record: {e}")

    return accumulator


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


def run_shard_map(
    shard: Dict[str, Any],
    source_class: str,
    processor_class: str,
    sink_class: str,
    config: Dict[str, Any],
    ray_address: Optional[str] = None,
):
    """
    Main entry point for processing a single shard.
    Runs source → processor → sink pipeline with micro-batching.
    """
    # Initialize Ray connection
    if ray_address:
        ray.init(address=ray_address, ignore_reinit_error=True)
    else:
        ray.init(ignore_reinit_error=True)

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

    # Initialize sink
    module_name, class_name = sink_class.rsplit(".", 1)
    module = __import__(module_name, fromlist=[class_name])
    SinkClass: Type[SinkAdapter] = getattr(module, class_name)
    sink = SinkClass(config.get("sink", {}))

    # Process records in micro-batches
    batch_buffer = []
    batch_refs = []
    failed_records = []

    try:
        for record in source.iter_records(shard_desc):
            batch_buffer.append(record.model_dump())

            if len(batch_buffer) >= MICROBATCH_SIZE:
                # Submit batch for processing
                ref = process_batch.remote(
                    batch_buffer, processor_class, config.get("processor", {})
                )
                batch_refs.append((ref, batch_buffer.copy()))
                batch_buffer = []

        # Process remaining records
        if batch_buffer:
            ref = process_batch.remote(
                batch_buffer, processor_class, config.get("processor", {})
            )
            batch_refs.append((ref, batch_buffer.copy()))

        # Collect results and write to sink
        total_success = 0
        total_failed = 0

        for ref, original_batch in batch_refs:
            try:
                results = ray.get(ref)

                # Write successful records to sink
                for result in results:
                    if result["success"]:
                        try:
                            processed = result["data"]
                            success = sink.write(processed, result["record_id"])
                            if success:
                                total_success += 1
                                RECORDS_PROCESSED.inc()
                            else:
                                total_failed += 1
                                failed_records.append(
                                    {
                                        "record_id": result["record_id"],
                                        "error": "Sink write failed",
                                        "data": processed,
                                    }
                                )
                                RECORDS_FAILED.inc()
                        except Exception as e:
                            logger.error(f"Sink write error: {e}")
                            total_failed += 1
                            failed_records.append(
                                {
                                    "record_id": result["record_id"],
                                    "error": str(e),
                                    "traceback": traceback.format_exc(),
                                }
                            )
                            RECORDS_FAILED.inc()
                    else:
                        total_failed += 1
                        failed_records.append(result)
                        RECORDS_FAILED.inc()

            except Exception as e:
                logger.error(f"Error processing batch: {e}")
                # Add all records from this batch to failed
                for record in original_batch:
                    failed_records.append(
                        {
                            "record_id": record.get("record_id", "unknown"),
                            "error": f"Batch processing failed: {e}",
                            "traceback": traceback.format_exc(),
                        }
                    )
                    RECORDS_FAILED.inc()

        # Write failed records to DLQ
        if failed_records:
            write_to_dlq(failed_records, shard_desc.id, source.run_id)

        logger.info(
            f"Shard {shard_desc.id} complete: {total_success} success, {total_failed} failed"
        )

    except Exception as e:
        logger.error(f"Fatal error processing shard {shard_desc.id}: {e}")
        raise
    finally:
        ray.shutdown()


def run_stateful_shard_map(
    shard: Dict[str, Any],
    source_class: str,
    combiner_class: str,
    config: Dict[str, Any],
    ray_address: Optional[str] = None,
):
    """
    Process a shard for stateful operations (e.g., usage aggregation).
    Produces partial aggregates to be reduced later.
    """
    # Initialize Ray connection
    if ray_address:
        ray.init(address=ray_address, ignore_reinit_error=True)
    else:
        ray.init(ignore_reinit_error=True)

    logger.info(f"Processing stateful shard: {shard}")
    shard_desc = ShardDescriptor(**shard)

    # Initialize source
    module_name, class_name = source_class.rsplit(".", 1)
    module = __import__(module_name, fromlist=[class_name])
    SourceClass: Type[SourceAdapter] = getattr(module, class_name)
    source = SourceClass(config.get("source", {}))

    # Process records in micro-batches and combine
    batch_buffer = []
    batch_refs = []

    try:
        for record in source.iter_records(shard_desc):
            batch_buffer.append(record.model_dump())

            if len(batch_buffer) >= MICROBATCH_SIZE:
                ref = combine_batch.remote(
                    batch_buffer, combiner_class, config.get("combiner", {})
                )
                batch_refs.append(ref)
                batch_buffer = []

        # Process remaining records
        if batch_buffer:
            ref = combine_batch.remote(
                batch_buffer, combiner_class, config.get("combiner", {})
            )
            batch_refs.append(ref)

        # Merge all partial aggregates for this shard
        if batch_refs:
            partials = ray.get(batch_refs)

            # Merge partials locally
            module_name, class_name = combiner_class.rsplit(".", 1)
            module = __import__(module_name, fromlist=[class_name])
            CombinerClass: Type[Combiner] = getattr(module, class_name)
            combiner = CombinerClass()

            final_partial = combiner.zero()
            for partial in partials:
                # Simple merge using combiner logic
                for k, v in partial.items():
                    if k not in final_partial:
                        final_partial[k] = v
                    elif isinstance(v, dict):
                        final_partial[k].update(v)
                    elif isinstance(v, (int, float)):
                        final_partial[k] += v

            # Write partial to store
            partial_agg = PartialAggregate(
                shard_id=shard_desc.id,
                aggregate_type=config.get("aggregate_type", "unknown"),
                data=final_partial,
            )

            store = PartialStore(config.get("partial_store", {}))
            key = store.write_partial(shard_desc.id, partial_agg)
            logger.info(f"Wrote partial aggregate for shard {shard_desc.id}: {key}")

    except Exception as e:
        logger.error(f"Error in stateful processing for shard {shard_desc.id}: {e}")
        raise
    finally:
        ray.shutdown()


def reduce_partials(merger_class: str, sink_class: str, config: Dict[str, Any]):
    """
    Reduce phase: merge partial aggregates and write final results.
    """
    logger.info("Starting reduce phase")

    # Initialize merger
    module_name, class_name = merger_class.rsplit(".", 1)
    module = __import__(module_name, fromlist=[class_name])
    MergerClass: Type[Merger] = getattr(module, class_name)
    merger = MergerClass()

    # Initialize sink
    module_name, class_name = sink_class.rsplit(".", 1)
    module = __import__(module_name, fromlist=[class_name])
    SinkClass: Type[SinkAdapter] = getattr(module, class_name)
    sink = SinkClass(config.get("sink", {}))

    # Read and merge all partials
    store = PartialStore(config.get("partial_store", {}))
    partial_keys = store.list_partials()

    if not partial_keys:
        logger.warning("No partial aggregates found to reduce")
        return

    logger.info(f"Found {len(partial_keys)} partial aggregates to merge")

    final_aggregate = merger.zero()
    for key in partial_keys:
        try:
            partial = store.read_partial(key)
            final_aggregate = merger.merge(final_aggregate, partial.data)
        except Exception as e:
            logger.error(f"Error reading partial {key}: {e}")

    # Write final aggregate to sink
    try:
        from ingestion.parallel.om_adapters import ProcessedRecord

        processed = ProcessedRecord(
            record_id=f"reduce-{store.run_id}",
            data=final_aggregate,
            metadata={"type": "final_aggregate"},
        )

        success = sink.write(processed, processed.record_id)
        if success:
            logger.info("Successfully wrote final aggregate to sink")
        else:
            logger.error("Failed to write final aggregate to sink")
    except Exception as e:
        logger.error(f"Error writing final aggregate: {e}")
        raise


# Entry points for different scenarios

if __name__ == "__main__":
    # This allows running the module directly for testing
    if len(sys.argv) < 2:
        print("Usage: python om_parallel.py <command> [args...]")
        print("Commands: map, stateful_map, reduce")
        sys.exit(1)

    command = sys.argv[1]

    if command == "map":
        # Example: python om_parallel.py map '{"type":"table","id":"test"}' source.class processor.class sink.class
        shard = json.loads(sys.argv[2])
        run_shard_map(
            shard,
            sys.argv[3],  # source_class
            sys.argv[4],  # processor_class
            sys.argv[5],  # sink_class
            {},  # config
        )
    elif command == "stateful_map":
        shard = json.loads(sys.argv[2])
        run_stateful_shard_map(
            shard,
            sys.argv[3],  # source_class
            sys.argv[4],  # combiner_class
            {},  # config
        )
    elif command == "reduce":
        reduce_partials(
            sys.argv[2], sys.argv[3], {}  # merger_class  # sink_class  # config
        )
