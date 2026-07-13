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
Delete methods
"""

import os
import traceback
from typing import Dict, Iterable, List, Optional, Set, Type  # noqa: UP035

from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.models.delete_entity import DeleteEntity
from metadata.ingestion.ometa.ometa_api import OpenMetadata, T
from metadata.utils.logger import utils_logger

logger = utils_logger()

# Env var that opts every connector into the server-side async delete cascade. When set,
# mark-deletion calls fire DELETE /<entity>/async/{id}?recursive=true and return 202 + a
# jobId immediately, so ingestion does not block on the server-side cascade (issue #4003).
# Explicit dispatch_async= passed to the generators overrides this default.
DELETE_DISPATCH_ASYNC_ENV = "OM_INGESTION_DELETE_ASYNC"


def _default_dispatch_async() -> bool:
    return os.getenv(DELETE_DISPATCH_ASYNC_ENV, "").lower() in {"true", "1", "yes", "on"}


def delete_entity_from_source(
    metadata: OpenMetadata,
    entity_type: Type[T],  # noqa: UP006
    entity_source_state: Set[str],  # noqa: UP006
    recursive: bool = True,
    params: Optional[Dict[str, str]] = None,  # noqa: UP006, UP045
    dispatch_async: Optional[bool] = None,  # noqa: UP045
) -> Iterable[Either[DeleteEntity]]:
    """
    Soft-delete the entities of ``entity_type`` within ``params`` scope that were not seen in
    this run. The server owns the detection: the connector sends the set of FQNs it produced
    (``entity_source_state``) and the server soft-deletes the in-scope entities not in that set.

    Whether stale deletion runs at all is decided by the caller (the ``markDeleted*`` source
    config gate); this function only performs it.

    Falls back to the legacy client-side paginate-and-diff against older servers that do not
    expose the ``deleteStale`` endpoint.

    :param metadata: OMeta client
    :param entity_type: Pydantic Entity model
    :param entity_source_state: FQNs of the entities produced by the connector this run
    :param recursive: When True, the soft-delete cascades to child entities
    :param params: single-key scope dict, e.g. {"database": fqn} / {"databaseSchema": fqn}
    :param dispatch_async: For the legacy fallback path, route the sink delete through the
        server-side async endpoint (returns 202 + jobId, runs cascade on the server's
        executor) so ingestion does not block on large hierarchies — see issue #4003. The
        server-side bulk deleteStale path is already async by design and ignores this flag.
    """
    use_async = dispatch_async if dispatch_async is not None else _default_dispatch_async()
    # Flush the sink buffer so the scope entity and the entities seen this run are committed
    # before the server resolves the scope and computes what is stale.
    barrier = Barrier(reason=f"flush_before_delete_stale:{entity_type.__name__}")
    yield Either(right=barrier)  # pyright: ignore[reportCallIssue]
    try:
        result = metadata.delete_stale_entities(
            entity=entity_type,
            scope_params=params,
            live_fqns=entity_source_state,
            recursive=recursive,
        )
        if result is not None:
            # The server soft-deleted the stale entities; nothing to push through the sink.
            return
        # Older server without the deleteStale endpoint: fall back to client-side detection.
        yield from _delete_stale_entities_legacy(
            metadata,
            entity_type,
            entity_source_state,
            recursive,
            params,
            use_async,
        )
    except Exception as exc:
        yield Either(  # pyright: ignore[reportCallIssue]
            left=StackTraceError(
                name="Delete Entity",
                error=f"Error deleting {entity_type.__class__}: {exc}",
                stackTrace=traceback.format_exc(),
            )
        )


def _delete_stale_entities_legacy(
    metadata: OpenMetadata,
    entity_type: Type[T],  # noqa: UP006
    entity_source_state: Set[str],  # noqa: UP006
    recursive: bool,
    params: Optional[Dict[str, str]],  # noqa: UP006, UP045
    dispatch_async: bool,
) -> Iterable[Either[DeleteEntity]]:
    """Legacy client-side stale detection: paginate the scope and diff FQNs locally."""
    entity_state = metadata.list_all_entities(entity=entity_type, params=params)
    for entity in entity_state:
        if str(entity.fullyQualifiedName.root) not in entity_source_state:
            yield Either(
                left=None,
                right=DeleteEntity(
                    entity=entity,
                    recursive=recursive,
                    dispatch_async=dispatch_async,
                ),
            )


def delete_entity_by_name(
    metadata: OpenMetadata,
    entity_type: Type[T],  # noqa: UP006
    entity_names: List[str],  # noqa: UP006
    recursive: bool = True,
    dispatch_async: Optional[bool] = None,  # noqa: UP045
) -> Iterable[Either[DeleteEntity]]:
    """
    Method to delete the entities contained on a given list
    :param metadata: OMeta client
    :param entity_type: Pydantic Entity model
    :param entity_names: List of FullyQualifiedNames of the entities to be deleted
    :param recursive: When True, the delete cascades to child entities
    :param dispatch_async: see :func:`delete_entity_from_source`
    """
    use_async = dispatch_async if dispatch_async is not None else _default_dispatch_async()
    try:
        for entity_name in entity_names:
            entity = metadata.get_by_name(entity=entity_type, fqn=entity_name)
            if entity:
                yield Either(
                    left=None,
                    right=DeleteEntity(
                        entity=entity,
                        recursive=recursive,
                        dispatch_async=use_async,
                    ),
                )
    except Exception as exc:
        yield Either(  # pyright: ignore[reportCallIssue]
            left=StackTraceError(
                name="Delete Entity",
                error=f"Error deleting {entity_type.__class__}: {exc}",
                stackTrace=traceback.format_exc(),
            )
        )
