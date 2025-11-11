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
Local executor for testing distributed ingestion without Kubernetes/Argo.

Uses ThreadPoolExecutor to simulate parallel worker pods.
"""
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List

from metadata.ingestion.api.distributed import (
    DiscoverableSource,
    EntityDescriptor,
    ProcessingResult,
)
from metadata.ingestion.api.steps import Sink
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class LocalDistributedExecutor:
    """
    Execute distributed ingestion locally using threads.

    This is useful for:
    - Testing distributed logic without Kubernetes
    - Development and debugging
    - Small-scale ingestion on local machines
    """

    def __init__(self, parallelism: int = 10):
        """
        Initialize local executor.

        Args:
            parallelism: Number of worker threads (simulates pods)
        """
        self.parallelism = parallelism

    def execute(
        self,
        source: DiscoverableSource,
        sink: Sink,
    ) -> Dict[str, Any]:
        """
        Execute distributed ingestion using local threads.

        Args:
            source: Source implementing DiscoverableSource
            sink: Sink to write entities

        Returns:
            Execution summary with metrics
        """
        logger.info(
            f"Starting LOCAL distributed execution with {self.parallelism} threads"
        )

        start_time = time.time()
        total_entities = 0
        successful = 0
        failed = 0
        results = []

        # Phase 1: Discovery
        logger.info("Phase 1: Discovering entities...")
        entity_types = source.get_parallelizable_entity_types()
        all_descriptors = []

        for entity_type in entity_types:
            logger.info(f"Discovering {entity_type}...")
            descriptors = source.discover_entities(entity_type)
            logger.info(f"Found {len(descriptors)} {entity_type} entities")
            all_descriptors.extend(descriptors)

        total_entities = len(all_descriptors)
        logger.info(f"Total entities to process: {total_entities}")

        if total_entities == 0:
            logger.warning("No entities discovered!")
            return {
                "status": "completed",
                "total_entities": 0,
                "successful": 0,
                "failed": 0,
                "duration_seconds": 0,
            }

        # Phase 2: Batch Parallel Processing
        # Split entities into batches for better connection reuse
        batch_size = max(
            1, total_entities // (self.parallelism * 2)
        )  # 2 batches per thread
        batches = [
            all_descriptors[i : i + batch_size]
            for i in range(0, total_entities, batch_size)
        ]

        logger.info(
            f"Phase 2: Processing {total_entities} entities in {len(batches)} batches "
            f"(~{batch_size} entities/batch) with {self.parallelism} worker threads..."
        )

        with ThreadPoolExecutor(max_workers=self.parallelism) as executor:
            # Submit batches to thread pool (each batch processed sequentially by one thread)
            futures = {
                executor.submit(
                    self._process_batch_worker, source, sink, batch, batch_idx
                ): batch_idx
                for batch_idx, batch in enumerate(batches)
            }

            # Collect results as they complete
            for future in as_completed(futures):
                batch_idx = futures[future]
                try:
                    batch_results = future.result()
                    results.extend(batch_results)

                    for result in batch_results:
                        if result.success:
                            successful += 1
                        else:
                            failed += 1

                    logger.info(
                        f"✓ Batch {batch_idx + 1}/{len(batches)} complete "
                        f"({successful + failed}/{total_entities} entities processed)"
                    )

                except Exception as exc:
                    # Mark all entities in batch as failed
                    batch = batches[batch_idx]
                    failed += len(batch)
                    logger.error(
                        f"✗ Batch {batch_idx + 1} failed: {exc}",
                        exc_info=True,
                    )

        duration = time.time() - start_time

        # Summary
        logger.info("=" * 80)
        logger.info("LOCAL DISTRIBUTED EXECUTION SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Total entities: {total_entities}")
        logger.info(f"Successful: {successful}")
        logger.info(f"Failed: {failed}")
        logger.info(f"Success rate: {(successful/total_entities)*100:.1f}%")
        logger.info(f"Duration: {duration:.1f} seconds")
        logger.info(f"Throughput: {total_entities/duration:.1f} entities/second")
        logger.info("=" * 80)

        return {
            "status": "completed" if failed == 0 else "completed_with_errors",
            "total_entities": total_entities,
            "successful": successful,
            "failed": failed,
            "duration_seconds": duration,
            "throughput_per_second": total_entities / duration if duration > 0 else 0,
            "results": results,
        }

    def _process_batch_worker(
        self,
        source: DiscoverableSource,
        sink: Sink,
        batch: List[EntityDescriptor],
        batch_idx: int,
    ) -> List[ProcessingResult]:
        """
        Worker function to process a batch of entities sequentially.

        This runs in a separate thread and processes all entities in the batch
        sequentially, reusing database connections for efficiency.

        Args:
            source: Source instance
            sink: Sink instance
            batch: List of entities to process
            batch_idx: Batch index for logging

        Returns:
            List of ProcessingResult for each entity in batch
        """
        results = []

        for idx, descriptor in enumerate(batch):
            result = self._process_entity_worker(source, sink, descriptor)
            results.append(result)

            if (idx + 1) % 10 == 0:  # Log progress every 10 entities
                logger.debug(
                    f"Batch {batch_idx + 1}: Processed {idx + 1}/{len(batch)} entities"
                )

        return results

    def _process_entity_worker(
        self,
        source: DiscoverableSource,
        sink: Sink,
        descriptor: EntityDescriptor,
    ) -> ProcessingResult:
        """
        Worker function to process a single entity.

        This runs in a separate thread (simulating a separate pod).

        Args:
            source: Source instance
            sink: Sink instance
            descriptor: Entity to process

        Returns:
            ProcessingResult with success/failure info
        """
        entity_start = time.time()
        entities_created = 0
        error_message = None

        try:
            # Process entity using source
            for entity_request in source.process_entity(descriptor):
                if entity_request.right:
                    # Send to sink
                    result = sink.run(entity_request.right)

                    # Check if result exists and handle it
                    if result is not None:
                        # Result can be Either or the entity itself
                        if hasattr(result, "left"):
                            # It's an Either object
                            if result.left:
                                logger.warning(
                                    f"Sink error for {descriptor.id}: {result.left}"
                                )
                            else:
                                entities_created += 1
                        else:
                            # It's the entity itself (successful creation)
                            entities_created += 1
                    else:
                        # sink.run() returned None - count as created
                        entities_created += 1
                else:
                    logger.warning(
                        f"Source error for {descriptor.id}: {entity_request.left}"
                    )

            processing_time = time.time() - entity_start

            return ProcessingResult(
                entity_id=descriptor.id,
                entity_type=descriptor.type,
                success=True,
                entities_created=entities_created,
                processing_time_seconds=processing_time,
            )

        except Exception as exc:
            processing_time = time.time() - entity_start
            error_message = str(exc)
            logger.error(
                f"Failed to process {descriptor.id}: {exc}",
                exc_info=True,
            )

            return ProcessingResult(
                entity_id=descriptor.id,
                entity_type=descriptor.type,
                success=False,
                error=error_message,
                entities_created=entities_created,
                processing_time_seconds=processing_time,
            )
