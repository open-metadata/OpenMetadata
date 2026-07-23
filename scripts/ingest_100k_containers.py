#!/usr/bin/env python3
"""
Generate ~100k Container entities in OpenMetadata for reindex performance testing.

Builds a Storage service plus a tree of Containers (depth 1-10) where every Container
has tags and a dataModel of 5-10 columns with column-level tags. Mirrors the structure
of {@code ingest_100k_tables.py} but for the Container entity, which is the path that
exposed the 580k-record reindex slowness this PR addresses.

Layout:
  - 5 classifications, 10 tags each = 50 tags
  - 1 storage service
  - ~100k containers distributed across depths 1-10 (root-heavy bell curve)
  - Each container: 1-3 tags + dataModel(5-10 columns, each with 0-2 tags)

Run after the local docker stack is up:

    python scripts/ingest_100k_containers.py \\
        --server http://localhost:8585/api --token "$OM_JWT_TOKEN"

Use --containers / --workers / --batch-size to tune. Default 100000 / 10 / 50.
"""

import argparse
import concurrent.futures
import random
import string
import sys
import time
from typing import Dict, List, Tuple

# Force unbuffered output so progress shows up under tee/redirect.
sys.stdout.reconfigure(line_buffering=True)

# Skip the strict server/client version match. The repo venv may carry an older
# client SDK against a freshly built 1.13 server (or vice versa) and the resulting
# VersionMismatchException is the difference between "this script runs" and
# "this script doesn't". Nothing this script does is version-sensitive — it's just
# create_or_update on standard entity types.
import metadata.ingestion.ometa.mixins.server_mixin as _server_mixin  # noqa: E402

_server_mixin.OMetaServerMixin.validate_versions = lambda self: None  # type: ignore[assignment]

from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.api.data.createContainer import CreateContainerRequest
from metadata.generated.schema.api.services.createStorageService import (
    CreateStorageServiceRequest,
)
from metadata.generated.schema.entity.classification.classification import (
    Classification,
)
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.container import (
    Container,
    ContainerDataModel,
)
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.storageService import (
    StorageService,
    StorageServiceType,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata


# Distribution of containers across depths 1..10. Root-heavy bell curve so the tree
# looks realistic (lots of mid-depth nodes, fewer at the extremes). Sum = 100000.
DEPTH_DISTRIBUTION = {
    1: 1000,
    2: 5000,
    3: 12000,
    4: 20000,
    5: 22000,
    6: 18000,
    7: 12000,
    8: 6000,
    9: 3000,
    10: 1000,
}


def scale_depth_counts(distribution: Dict[int, int], target: int) -> Dict[int, int]:
    """Scale a depth distribution to a requested total, preserving the exact total.

    Floor each weighted share, then hand out the leftover one-by-one to the depths with the
    largest fractional remainder. Honors --containers exactly (10 → 10 containers, not 10 *
    len(distribution)) and produces a stable distribution for the same input. Depth 1 must
    always have at least one container so subsequent depths have a parent to attach to; the
    floor would otherwise zero it out at very small targets.
    """
    if target <= 0:
        return {d: 0 for d in distribution}
    base_total = sum(distribution.values())
    raw = {d: c * target / base_total for d, c in distribution.items()}
    floored = {d: int(v) for d, v in raw.items()}
    # Reserve one slot at depth 1 so the tree has a root layer.
    if floored.get(1, 0) == 0 and target >= 1:
        floored[1] = 1
    deficit = target - sum(floored.values())
    if deficit > 0:
        remainders = sorted(
            ((d, raw[d] - floored[d]) for d in raw),
            key=lambda x: (-x[1], x[0]),
        )
        for d, _ in remainders[:deficit]:
            floored[d] += 1
    elif deficit < 0:
        # Overshoot from the depth=1 reservation: take back from depths with the largest counts.
        excess = -deficit
        biggest = sorted(floored.items(), key=lambda kv: (-kv[1], kv[0]))
        for d, _ in biggest:
            if excess == 0:
                break
            if d == 1:
                continue
            take = min(excess, floored[d])
            floored[d] -= take
            excess -= take
    return floored

CLASSIFICATIONS = [
    ("PIIClass", ["Email", "Phone", "Address", "SSN", "DOB",
                   "CreditCard", "BankAccount", "MedicalRecord", "Biometric", "Geolocation"]),
    ("Sensitivity", ["Public", "Internal", "Confidential", "Restricted", "Secret",
                     "TopSecret", "PartnerOnly", "EmployeeOnly", "ExecutiveOnly", "Auditor"]),
    ("Quality", ["Gold", "Silver", "Bronze", "Raw", "Curated",
                 "Validated", "Deprecated", "Experimental", "Production", "Staging"]),
    ("Domain", ["Sales", "Marketing", "Engineering", "Finance", "HR",
                "Operations", "Legal", "Support", "Product", "Research"]),
    ("Compliance", ["GDPR", "HIPAA", "SOX", "CCPA", "PCI",
                    "SOC2", "ISO27001", "NIST", "FedRAMP", "FERPA"]),
]

DATA_TYPES = [
    DataType.BIGINT, DataType.INT, DataType.VARCHAR, DataType.TEXT,
    DataType.TIMESTAMP, DataType.DATE, DataType.BOOLEAN, DataType.JSON,
    DataType.DOUBLE, DataType.DECIMAL,
]

# Cached after setup; workers pick from this list to attach tags to containers/columns.
ALL_TAG_FQNS: List[str] = []


def random_word(length: int = 8) -> str:
    return "".join(random.choices(string.ascii_lowercase, k=length))


def make_metadata_client(server_url: str, token: str) -> OpenMetadata:
    return OpenMetadata(
        OpenMetadataConnection(
            hostPort=server_url,
            securityConfig=OpenMetadataJWTClientConfig(jwtToken=token),
        )
    )


def ensure_classifications_and_tags(metadata: OpenMetadata) -> List[str]:
    """Idempotent: create classifications and tags if missing, return all tag FQNs."""
    fqns: List[str] = []
    for class_name, tag_names in CLASSIFICATIONS:
        if not metadata.get_by_name(entity=Classification, fqn=class_name):
            metadata.create_or_update(
                CreateClassificationRequest(
                    name=class_name,
                    description=f"Reindex perf test classification: {class_name}",
                )
            )
            print(f"Created classification: {class_name}", flush=True)
        for tag_name in tag_names:
            tag_fqn = f"{class_name}.{tag_name}"
            if not metadata.get_by_name(entity=Tag, fqn=tag_fqn):
                metadata.create_or_update(
                    CreateTagRequest(
                        name=tag_name,
                        classification=class_name,
                        description=f"Reindex perf test tag: {tag_fqn}",
                    )
                )
            fqns.append(tag_fqn)
    print(f"Total tags available: {len(fqns)}", flush=True)
    return fqns


def ensure_storage_service(metadata: OpenMetadata, name: str) -> str:
    """Returns the service name (used as FQN for sub-entities)."""
    if metadata.get_by_name(entity=StorageService, fqn=name):
        print(f"Using existing storage service: {name}", flush=True)
        return name
    # CustomStorage with empty connection — sufficient for entity creation; reindex
    # only cares about the entity rows, not whether the connection works.
    from metadata.generated.schema.entity.services.connections.storage.customStorageConnection import (
        CustomStorageConnection,
        CustomStorageType,
    )
    from metadata.generated.schema.entity.services.storageService import (
        StorageConnection,
    )

    metadata.create_or_update(
        CreateStorageServiceRequest(
            name=name,
            serviceType=StorageServiceType.CustomStorage,
            connection=StorageConnection(
                config=CustomStorageConnection(
                    type=CustomStorageType.CustomStorage,
                    sourcePythonClass="x.y.z",
                )
            ),
        )
    )
    print(f"Created storage service: {name}", flush=True)
    return name


def random_tag_labels(count_min: int, count_max: int) -> List[TagLabel]:
    n = random.randint(count_min, count_max)
    if n == 0 or not ALL_TAG_FQNS:
        return []
    chosen = random.sample(ALL_TAG_FQNS, min(n, len(ALL_TAG_FQNS)))
    return [
        TagLabel(
            tagFQN=fqn,
            source=TagSource.Classification,
            labelType=LabelType.Manual,
            state=State.Confirmed,
        )
        for fqn in chosen
    ]


def random_columns() -> List[Column]:
    n = random.randint(5, 10)
    cols: List[Column] = []
    for i in range(n):
        dt = random.choice(DATA_TYPES)
        col = Column(
            name=f"col_{i}_{random_word(4)}",
            dataType=dt,
            tags=random_tag_labels(0, 2),
        )
        if dt == DataType.VARCHAR:
            col.dataLength = 255
        elif dt == DataType.DECIMAL:
            col.dataLength = 10
        cols.append(col)
    return cols


def build_parent_ref(parent_id: str, parent_fqn: str) -> EntityReference:
    return EntityReference(id=parent_id, type="container", fullyQualifiedName=parent_fqn)


def create_depth_layer(
    server_url: str,
    token: str,
    service_name: str,
    depth: int,
    count: int,
    parents: List[Tuple[str, str]],  # list of (id, fqn) from previous layer
    workers: int,
    batch_size: int,
) -> List[Tuple[str, str]]:
    """
    Create {@code count} containers at the given depth, each picking a random parent
    from {@code parents}. Returns the (id, fqn) of every created container — feeds the
    next deeper layer.
    """
    print(f"\n=== Depth {depth}: creating {count} containers ===", flush=True)
    start = time.time()
    created: List[Tuple[str, str]] = []
    failed = 0

    def make_batch(batch_start: int, batch_count: int) -> List[Tuple[str, str]]:
        worker_metadata = make_metadata_client(server_url, token)
        batch_results: List[Tuple[str, str]] = []
        for i in range(batch_start, batch_start + batch_count):
            name = f"c_d{depth}_{i:06d}_{random_word(4)}"
            try:
                if depth == 1:
                    # Depth-1 containers attach directly to the service (no parent ref).
                    req = CreateContainerRequest(
                        name=name,
                        service=service_name,
                        description=f"Reindex perf test container {name}",
                        tags=random_tag_labels(1, 3),
                        dataModel=ContainerDataModel(
                            isPartitioned=False, columns=random_columns()
                        ),
                    )
                else:
                    parent_id, parent_fqn = random.choice(parents)
                    req = CreateContainerRequest(
                        name=name,
                        service=service_name,
                        parent=build_parent_ref(parent_id, parent_fqn),
                        description=f"Reindex perf test container {name}",
                        tags=random_tag_labels(1, 3),
                        dataModel=ContainerDataModel(
                            isPartitioned=False, columns=random_columns()
                        ),
                    )
                obj = worker_metadata.create_or_update(req)
                fqn = (
                    obj.fullyQualifiedName.root
                    if hasattr(obj.fullyQualifiedName, "root")
                    else str(obj.fullyQualifiedName)
                )
                batch_results.append((str(obj.id.root) if hasattr(obj.id, "root") else str(obj.id), fqn))
            except Exception as e:  # noqa: BLE001
                # Don't let one bad row sink the whole layer.
                print(f"  [d{depth} #{i}] {name}: {e}", flush=True)
        return batch_results

    batches = [
        (start_idx, min(batch_size, count - start_idx))
        for start_idx in range(0, count, batch_size)
    ]
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(make_batch, s, c): (s, c) for s, c in batches}
        completed_batches = 0
        for fut in concurrent.futures.as_completed(futures):
            try:
                results = fut.result()
                created.extend(results)
                # batch_size minus actual results = failures we logged
                expected = futures[fut][1]
                failed += expected - len(results)
            except Exception as e:  # noqa: BLE001
                print(f"  Batch {futures[fut]} hard-failed: {e}", flush=True)
                failed += futures[fut][1]
            completed_batches += 1
            if completed_batches % 20 == 0 or completed_batches == len(batches):
                elapsed = time.time() - start
                rate = len(created) / elapsed if elapsed > 0 else 0
                print(
                    f"  depth={depth} progress: {len(created)}/{count} "
                    f"({100 * len(created) / count:.1f}%) - {rate:.1f}/s",
                    flush=True,
                )

    elapsed = time.time() - start
    rate = len(created) / elapsed if elapsed > 0 else 0
    print(
        f"=== Depth {depth} done: {len(created)} created, {failed} failed, "
        f"{elapsed:.1f}s, {rate:.1f}/s ===",
        flush=True,
    )
    return created


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--server", default="http://localhost:8585/api")
    parser.add_argument("--token", required=True, help="OpenMetadata JWT")
    parser.add_argument("--service", default="reindex_perf_storage")
    parser.add_argument("--containers", type=int, default=100000)
    parser.add_argument("--workers", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    # The seeded RNG is consumed concurrently by worker threads, so seed determinism is
    # best-effort: the *layout* (depth distribution, target totals) is reproducible, the
    # specific tag/name/column choices interleave non-deterministically across threads. Good
    # enough for perf reproducibility; if you need exact byte-for-byte output, drop
    # --workers to 1.
    random.seed(args.seed)
    print(f"Server: {args.server}", flush=True)
    print(f"Target: {args.containers} containers, {args.workers} workers, batch {args.batch_size}", flush=True)
    print("-" * 60, flush=True)

    metadata = make_metadata_client(args.server, args.token)

    global ALL_TAG_FQNS
    ALL_TAG_FQNS = ensure_classifications_and_tags(metadata)
    service_name = ensure_storage_service(metadata, args.service)

    # Scale the depth distribution to honor --containers exactly. Floor-and-distribute the
    # remainder largest-first so the totals add up to the requested target without overshoot
    # (the previous max(1, round(...)) form clamped tiny inputs to >= len(distribution)).
    depth_counts = scale_depth_counts(DEPTH_DISTRIBUTION, args.containers)
    print(f"Depth counts: {depth_counts}", flush=True)
    print(f"Sum: {sum(depth_counts.values())}", flush=True)

    overall_start = time.time()
    parents: List[Tuple[str, str]] = []
    for depth in sorted(depth_counts.keys()):
        count = depth_counts[depth]
        if depth > 1 and not parents:
            print(f"No parents available at depth {depth}; aborting.", flush=True)
            break
        layer = create_depth_layer(
            server_url=args.server,
            token=args.token,
            service_name=service_name,
            depth=depth,
            count=count,
            parents=parents,
            workers=args.workers,
            batch_size=args.batch_size,
        )
        # Keep a bounded sample of this depth's containers as parents for the next
        # depth — picking from a 10k subset is plenty of branching variety and keeps
        # memory bounded if the user runs at 1M+ scale.
        parents = layer if len(layer) <= 10000 else random.sample(layer, 10000)

    total_elapsed = time.time() - overall_start
    print("\n" + "=" * 60, flush=True)
    print(
        f"Done: ~{args.containers} containers across "
        f"{len(depth_counts)} depths in {total_elapsed:.1f}s "
        f"({args.containers / total_elapsed:.1f}/s overall)",
        flush=True,
    )
    print("=" * 60, flush=True)


if __name__ == "__main__":
    main()
