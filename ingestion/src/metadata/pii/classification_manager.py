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
Classification run manager for auto-classification workflows.
"""

import re
from collections import OrderedDict
from typing import Any, Protocol

from pydantic import ValidationError
from requests.exceptions import Timeout

from metadata.generated.schema.entity.classification.classification import (
    Classification,
)
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.services.ingestionPipelines.status import StackTraceError
from metadata.ingestion.api.status import Status
from metadata.ingestion.ometa.client import RestTransportError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import profiler_logger

logger = profiler_logger()
MAX_CACHE_ENTRIES = 256
MAX_DIAGNOSTIC_IDENTIFIER_LENGTH = 3072


def _identifier(value: Any) -> str:
    """Show entity identifiers without allowing control characters into status logs."""
    if not isinstance(value, str) or not value:
        return "<unknown>"
    sanitized = re.sub(r"[\x00-\x1f\x7f]", "?", value[:MAX_DIAGNOSTIC_IDENTIFIER_LENGTH])
    return sanitized + ("…" if len(value) > MAX_DIAGNOSTIC_IDENTIFIER_LENGTH else "")


_RECOGNIZER_TYPES = {
    "pattern": "PatternRecognizer",
    "exact_terms": "ExactTermsRecognizer",
    "context": "ContextRecognizer",
    "custom": "CustomRecognizer",
    "predefined": "PredefinedRecognizer",
}


def _selected_recognizer_index(location: tuple, recognizers: list) -> int | None:
    if len(location) < 5 or location[0] != "recognizers" or location[2] != "recognizerConfig":
        return None
    index = location[1]
    if not isinstance(index, int) or not 0 <= index < len(recognizers):
        return None
    recognizer = recognizers[index]
    if not isinstance(recognizer, dict) or not isinstance(recognizer.get("recognizerConfig"), dict):
        return None
    branch = _RECOGNIZER_TYPES.get(recognizer["recognizerConfig"].get("type"))
    return index if branch and branch in str(location[3]) else None


def _unknown_recognizer_type_index(recognizers: list) -> int | None:
    for index, recognizer in enumerate(recognizers):
        config = recognizer.get("recognizerConfig") if isinstance(recognizer, dict) else None
        kind = config.get("type") if isinstance(config, dict) else None
        if isinstance(config, dict) and (not isinstance(kind, str) or kind not in _RECOGNIZER_TYPES):
            return index
    return None


def _missing_field(exc: Exception, raw: dict | None = None) -> tuple[str, int | None]:
    if isinstance(exc, ValidationError):
        errors = exc.errors()
        if raw and isinstance(raw.get("recognizers"), list):
            unknown_type_index = _unknown_recognizer_type_index(raw["recognizers"])
            if unknown_type_index is not None:
                return "type", unknown_type_index
            for desired_type in ("missing", "invalid"):
                for error in errors:
                    location = error["loc"]
                    error_type = error["type"]
                    if desired_type == "missing" and error_type != "missing":
                        continue
                    if desired_type == "invalid" and error_type in ("missing", "literal_error", "extra_forbidden"):
                        continue
                    index = _selected_recognizer_index(location, raw["recognizers"])
                    if index is not None:
                        return _identifier(location[-1]), index
        for error in errors:
            if error["type"] == "missing":
                location = error["loc"]
                recognizer_index = None
                if "recognizers" in location:
                    next_index = location.index("recognizers") + 1
                    if next_index < len(location):
                        index = location[next_index]
                        if isinstance(index, int):
                            recognizer_index = index
                return _identifier(location[-1]), recognizer_index
    return "invalid configuration", None


def _fetch_reason(exc: Exception) -> str:
    status_code = getattr(exc, "status_code", None)
    if isinstance(status_code, int) and 100 <= status_code <= 599:
        return f"HTTP {status_code}"
    if isinstance(exc, Timeout) or (isinstance(exc, RestTransportError) and isinstance(exc.cause, Timeout)):
        return "request timed out"
    return type(exc).__name__


class ClassificationManagerInterface(Protocol):
    def get_enabled_classifications(self, filter_names: list[str] | None = None) -> list[Classification]: ...

    def get_enabled_tags(self, classifications: list[Classification]) -> list[Tag]: ...


class ClassificationManager:
    """
    Manages which classifications and tags participate in auto-classification.
    Respects classification-level and tag-level configuration.
    """

    def __init__(self, metadata: OpenMetadata[Any, Any], status: Status | None = None):
        self.metadata: OpenMetadata[Any, Any] = metadata
        self.status = status
        self._classification_cache: OrderedDict[str, list[Classification]] = OrderedDict()
        self._tags_cache: OrderedDict[str, list[Tag]] = OrderedDict()

    @staticmethod
    def _cache_result(cache: OrderedDict, key: str, value: list) -> None:
        cache[key] = value
        cache.move_to_end(key)
        if len(cache) > MAX_CACHE_ENTRIES:
            cache.popitem(last=False)

    def _failure(self, name: str, message: str) -> None:
        if self.status is not None:
            self.status.failed(StackTraceError(name=name, error=message))
        else:
            logger.error(message)

    def _classification_parse_error(self, filter_names: list[str] | None):
        def callback(_entity: type, raw: dict, exc: Exception) -> None:
            raw_name = raw.get("name") or raw.get("fullyQualifiedName")
            name = _identifier(raw_name)
            if filter_names and isinstance(raw_name, str) and raw_name not in filter_names:
                return
            config = raw.get("autoClassificationConfig")
            if isinstance(config, dict) and config.get("enabled") is False:
                return
            field, _ = _missing_field(exc)
            self._failure(name, f"Could not load classification {name}: missing or invalid {field}")

        return callback

    def _tag_parse_error(self, classification_name: str):
        def callback(_entity: type, raw: dict, exc: Exception) -> None:
            if raw.get("autoClassificationEnabled") is False:
                return
            raw_fqn = raw.get("fullyQualifiedName")
            fqn = _identifier(raw_fqn)
            if isinstance(raw_fqn, str) and not raw_fqn.startswith(f"{classification_name}."):
                return
            field, recognizer_index = _missing_field(exc, raw)
            recognizer = "<unknown>"
            recognizers = raw.get("recognizers")
            if isinstance(recognizers, list) and recognizer_index is not None and recognizer_index < len(recognizers):
                failing = recognizers[recognizer_index]
                if isinstance(failing, dict):
                    recognizer = _identifier(failing.get("name"))
            self._failure(
                fqn,
                f"Could not load tag {fqn} in classification {classification_name}, "
                f"recognizer {recognizer}: missing or invalid {field}",
            )

        return callback

    def get_enabled_classifications(self, filter_names: list[str] | None = None) -> list[Classification]:
        """
        Fetch classifications that have auto-classification enabled.

        Args:
            filter_names: Optional list of classification names to include.
                         If provided, only these classifications will be considered.

        Returns:
            List of enabled classification configs
        """
        cache_key = ",".join(sorted(filter_names)) if filter_names else "all"

        if cache_key in self._classification_cache:
            logger.debug(f"Returning cached enabled classifications for filter: {cache_key}")
            self._classification_cache.move_to_end(cache_key)
            return self._classification_cache[cache_key]

        logger.debug("Fetching enabled classifications from OpenMetadata")

        enabled: list[Classification] = []
        completed = False
        try:
            for classification in self.metadata.list_all_entities(
                entity=Classification,
                fields=[
                    "name",
                    "autoClassificationConfig",
                    "mutuallyExclusive",
                ],
                skip_on_failure=True,
                on_parse_error=self._classification_parse_error(filter_names),
            ):
                if filter_names and classification.name.root not in filter_names:
                    continue
                auto_config = classification.autoClassificationConfig
                if auto_config and auto_config.enabled:
                    enabled.append(classification)
            completed = True
        except Exception as exc:
            self._failure("classifications", f"Failed to fetch classifications: {_fetch_reason(exc)}")

        if completed:
            self._cache_result(self._classification_cache, cache_key, enabled)

        logger.info("Found %d enabled classifications: %s", len(enabled), [c.name.root for c in enabled])
        return enabled

    def get_enabled_tags(self, classifications: list[Classification]) -> list[Tag]:
        """
        Get all tags with recognizers from enabled classifications.

        Filters out:
        - Tags where autoClassificationEnabled = False
        - Tags without recognizers

        Args:
            classifications: List of enabled classification configs

        Returns:
            List of tags ready for auto-classification
        """
        classification_names = [c.name.root for c in classifications]

        cache_key = ",".join(sorted(classification_names))
        if cache_key in self._tags_cache:
            logger.debug(f"Returning cached tags for classifications: {cache_key}")
            self._tags_cache.move_to_end(cache_key)
            return self._tags_cache[cache_key]

        logger.info(f"Fetching enabled tags from classifications: {classification_names}")

        candidate_tags: list[Tag] = []
        completed = True

        for classification_name in classification_names:
            try:
                for tag in self.metadata.list_all_entities(
                    entity=Tag,
                    fields=[
                        "name",
                        "fullyQualifiedName",
                        "recognizers",
                        "autoClassificationEnabled",
                        "autoClassificationPriority",
                        "classification",
                    ],
                    params={
                        "parent": classification_name,
                    },
                    skip_on_failure=True,
                    on_parse_error=self._tag_parse_error(classification_name),
                ):
                    if not tag.autoClassificationEnabled:
                        logger.debug(f"Skipping tag {tag.fullyQualifiedName} (auto-classification disabled)")
                        continue

                    if not tag.recognizers:
                        logger.debug(f"Skipping tag {tag.fullyQualifiedName} (no recognizers configured)")
                        continue

                    candidate_tags.append(tag)

            except Exception as exc:
                completed = False
                self._failure(
                    classification_name,
                    f"Failed to fetch tags for classification {classification_name}: {_fetch_reason(exc)}"
                    + (" after partial results" if candidate_tags else ""),
                )
                continue

        logger.info(
            f"Found {len(candidate_tags)} enabled tags with recognizers: "
            + f"{[t.fullyQualifiedName for t in candidate_tags]}"
        )

        if completed:
            self._cache_result(self._tags_cache, cache_key, candidate_tags)
        return candidate_tags

    def clear_cache(self) -> None:
        """Clear cached classifications and tags. Useful for testing."""
        logger.debug("Clearing classification and tag caches")
        self._classification_cache.clear()
        self._tags_cache.clear()
