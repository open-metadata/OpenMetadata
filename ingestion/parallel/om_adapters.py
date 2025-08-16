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
Adapter interfaces to wrap OpenMetadata Source→Processor→Sink components
for parallel execution in Ray/Dask environments.
"""
import hashlib
import json
import os
import uuid
from abc import ABC, abstractmethod
from typing import Any, Dict, Iterable, List, Optional

from pydantic import BaseModel


class ShardDescriptor(BaseModel):
    """Describes a partition/shard of data to be processed"""

    type: str  # "table", "time_window", "range", "kafka_partition", etc.
    id: str  # Unique identifier for this shard
    metadata: Dict[str, Any] = {}  # Additional shard-specific metadata


class Record(BaseModel):
    """Represents a single record to be processed"""

    record_id: str  # Stable identifier for idempotency
    data: Dict[str, Any]  # The actual record data
    metadata: Dict[str, Any] = {}  # Processing metadata


class ProcessedRecord(BaseModel):
    """Result of processing a record"""

    record_id: str  # Maps back to input record
    data: Dict[str, Any]  # Processed data
    metadata: Dict[str, Any] = {}  # Processing metadata


class PartialAggregate(BaseModel):
    """Partial aggregate for stateful operations"""

    shard_id: str
    aggregate_type: str  # "usage", "lineage", etc.
    data: Dict[str, Any]  # The partial aggregate data


class SourceAdapter(ABC):
    """
    Adapts OpenMetadata Source components for parallel processing.
    Responsible for partitioning data and yielding records from each shard.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.run_id = str(uuid.uuid4())

    @abstractmethod
    def discover_shards(self) -> List[ShardDescriptor]:
        """
        Discover and return all shards/partitions available for processing.
        This is called during the partition step in Argo.
        """
        pass

    @abstractmethod
    def iter_records(self, shard: ShardDescriptor) -> Iterable[Record]:
        """
        Iterate through all records in a given shard.
        Records must have stable IDs for idempotency.
        """
        pass

    def generate_record_id(
        self, shard: ShardDescriptor, record_data: Dict[str, Any]
    ) -> str:
        """
        Generate a stable record ID for idempotency.
        Default implementation uses shard ID + record hash.
        """
        content = f"{shard.id}:{json.dumps(record_data, sort_keys=True)}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]


class ProcessorAdapter(ABC):
    """
    Adapts OpenMetadata Processor components for parallel processing.
    Must be stateless and pure - no side effects allowed.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}

    @abstractmethod
    def process(self, record: Record) -> ProcessedRecord:
        """
        Process a single record. Must be a pure function.
        """
        pass

    def validate(self, record: Record) -> bool:
        """
        Optional validation before processing.
        Return False to skip the record.
        """
        return True


class SinkAdapter(ABC):
    """
    Adapts OpenMetadata Sink components for parallel processing.
    Must implement idempotent writes.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.metadata_server = os.getenv("OPENMETADATA_HOST", "http://localhost:8585")
        self.api_key = os.getenv("OPENMETADATA_API_KEY", "")

    @abstractmethod
    def write(self, processed: ProcessedRecord, idempotency_key: str) -> bool:
        """
        Write processed record to sink. Must be idempotent.
        Returns True if successful, False otherwise.
        """
        pass

    def batch_write(self, records: List[ProcessedRecord]) -> Dict[str, bool]:
        """
        Optional batch write implementation.
        Returns mapping of record_id -> success status.
        """
        results = {}
        for record in records:
            results[record.record_id] = self.write(record, record.record_id)
        return results


class Combiner(ABC):
    """
    For stateful operations (e.g., usage aggregation).
    Combines records into partial aggregates within a shard.
    """

    @abstractmethod
    def zero(self) -> Dict[str, Any]:
        """Return the zero/identity value for the aggregation"""
        pass

    @abstractmethod
    def combine(self, accumulator: Dict[str, Any], record: Record) -> Dict[str, Any]:
        """Combine a record into the accumulator"""
        pass


class Merger(ABC):
    """
    Merges partial aggregates from multiple shards into final result.
    Used in the reduce phase.
    """

    @abstractmethod
    def zero(self) -> Dict[str, Any]:
        """Return the zero/identity value for merging"""
        pass

    @abstractmethod
    def merge(self, acc1: Dict[str, Any], acc2: Dict[str, Any]) -> Dict[str, Any]:
        """Merge two partial aggregates"""
        pass


class PartialStore:
    """
    Stores and retrieves partial aggregates during map-reduce operations.
    Default implementation uses object storage (S3/GCS/Azure Blob).
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.bucket = os.getenv("OM_PARTIAL_BUCKET", "om-parallel-partials")
        self.run_id = os.getenv("WORKFLOW_RUN_ID", str(uuid.uuid4()))

    def write_partial(self, shard_id: str, partial: PartialAggregate) -> str:
        """Write a partial aggregate and return its key"""
        key = f"{self.run_id}/{shard_id}.json"
        # Implementation would write to S3/GCS/Azure
        # For now, we'll use local filesystem
        import tempfile

        temp_dir = tempfile.gettempdir()
        path = os.path.join(temp_dir, key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(partial.model_dump(), f)
        return key

    def list_partials(self) -> List[str]:
        """List all partial keys for this run"""
        import tempfile

        temp_dir = tempfile.gettempdir()
        run_dir = os.path.join(temp_dir, self.run_id)
        if not os.path.exists(run_dir):
            return []
        return [
            os.path.join(self.run_id, f)
            for f in os.listdir(run_dir)
            if f.endswith(".json")
        ]

    def read_partial(self, key: str) -> PartialAggregate:
        """Read a partial aggregate by key"""
        import tempfile

        temp_dir = tempfile.gettempdir()
        path = os.path.join(temp_dir, key)
        with open(path, "r") as f:
            data = json.load(f)
        return PartialAggregate(**data)


# Example implementations for common use cases


class TableUsageCombiner(Combiner):
    """Example combiner for table usage statistics"""

    def zero(self) -> Dict[str, Any]:
        return {"usage_count": {}, "query_count": 0}

    def combine(self, accumulator: Dict[str, Any], record: Record) -> Dict[str, Any]:
        # Extract table usage from query log record
        if "tables" in record.data:
            for table in record.data["tables"]:
                if table not in accumulator["usage_count"]:
                    accumulator["usage_count"][table] = 0
                accumulator["usage_count"][table] += 1
        accumulator["query_count"] += 1
        return accumulator


class TableUsageMerger(Merger):
    """Example merger for table usage statistics"""

    def zero(self) -> Dict[str, Any]:
        return {"usage_count": {}, "query_count": 0}

    def merge(self, acc1: Dict[str, Any], acc2: Dict[str, Any]) -> Dict[str, Any]:
        merged = {
            "usage_count": acc1["usage_count"].copy(),
            "query_count": acc1["query_count"],
        }

        for table, count in acc2["usage_count"].items():
            if table not in merged["usage_count"]:
                merged["usage_count"][table] = 0
            merged["usage_count"][table] += count

        merged["query_count"] += acc2["query_count"]
        return merged
