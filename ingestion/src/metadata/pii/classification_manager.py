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
from contextlib import suppress
from typing import Any, Protocol, get_args

from pydantic import TypeAdapter, ValidationError
from requests.exceptions import Timeout

from metadata.generated.schema.entity.classification.classification import (
    AutoClassificationConfig,
    Classification,
)
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.services.ingestionPipelines.status import StackTraceError
from metadata.generated.schema.type.recognizer import RecognizerConfig
from metadata.ingestion.api.status import Status
from metadata.ingestion.ometa.client import RestTransportError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.fqn import quote_name, split_raw_name, unquote_name
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


_RECOGNIZER_MODELS = {
    kind: model
    for model in get_args(RecognizerConfig.model_fields["root"].annotation)
    for kind in get_args(model.model_fields["type"].annotation)
}
_CLASSIFICATION_ENABLED = TypeAdapter(AutoClassificationConfig.model_fields["enabled"].annotation)
_TAG_ENABLED = TypeAdapter(Tag.model_fields["autoClassificationEnabled"].annotation)


def _disabled(value: Any, adapter: TypeAdapter) -> bool:
    try:
        return not adapter.validate_python(value)
    except ValidationError:
        return False


def _other_parent(raw_fqn: Any, classification_name: str) -> bool:
    if not isinstance(raw_fqn, str):
        return False
    parts = split_raw_name(raw_fqn)
    if len(parts) < 2 or any(not part for part in parts):
        return False
    try:
        quoted_parts = [quote_name(part) for part in parts]
    except ValueError:
        return False
    return quoted_parts[0] != quote_name(classification_name)


def _field_path(location: tuple) -> str:
    path = ""
    for part in location:
        path += f"[{part}]" if isinstance(part, int) else ("." if path else "") + _identifier(part)
    return path or "invalid configuration"


def _missing_field(exc: Exception, raw: dict | None = None) -> tuple[str, int | None]:
    if isinstance(exc, ValidationError):
        errors = exc.errors(include_input=False, include_context=False)
        if raw and isinstance(raw.get("recognizers"), list):
            for index, recognizer in enumerate(raw["recognizers"]):
                config = recognizer.get("recognizerConfig") if isinstance(recognizer, dict) else None
                if not isinstance(config, dict):
                    if isinstance(recognizer, dict):
                        return "recognizerConfig", index
                    continue
                kind = config.get("type")
                model = _RECOGNIZER_MODELS.get(kind) if isinstance(kind, str) else None
                if model is None:
                    return "type", index
                try:
                    # Union errors include failures from unrelated branches. Revalidate only
                    # the selected generated model to retain its actual field/index path.
                    model.model_validate(config)
                except ValidationError as config_error:
                    return _missing_field(config_error)[0], index
        if errors:
            error = next((error for error in errors if error["type"] == "missing"), errors[0])
            location = error["loc"]
            if len(location) > 1 and location[0] == "recognizers" and isinstance(location[1], int):
                return _field_path(location[2:]), location[1]
            return _field_path(location), None
    return "invalid configuration", None


def _fetch_reason(exc: Exception) -> str:
    status_code = getattr(exc, "status_code", None)
    if isinstance(status_code, int) and 100 <= status_code <= 599:
        return f"HTTP {status_code}"
    if isinstance(exc, Timeout) or (isinstance(exc, RestTransportError) and isinstance(exc.cause, Timeout)):
        return "request timed out"
    if isinstance(exc, RestTransportError):
        return f"transport failure ({type(exc.cause).__name__})"
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
        self._reported_diagnostics: OrderedDict[tuple[str, str, bool], None] = OrderedDict()

    @staticmethod
    def _cache_result(cache: OrderedDict, key: str, value: list) -> None:
        cache[key] = value
        cache.move_to_end(key)
        if len(cache) > MAX_CACHE_ENTRIES:
            cache.popitem(last=False)

    def _diagnostic(self, name: str, message: str, *, warning: bool = False) -> None:
        key = (name, message, warning)
        if key in self._reported_diagnostics:
            self._reported_diagnostics.move_to_end(key)
            return
        self._reported_diagnostics[key] = None
        if len(self._reported_diagnostics) > MAX_CACHE_ENTRIES:
            self._reported_diagnostics.popitem(last=False)
        if warning:
            logger.warning(message)
            if self.status is not None:
                self.status.warning(name, message)
            return
        if self.status is not None:
            self.status.failed(StackTraceError(name=name, error=message))
        else:
            logger.error(message)

    def _classification_parse_error(self, filter_names: list[str] | None):
        def callback(_entity: type, raw: dict, exc: Exception) -> None:
            raw_name = raw.get("name") or raw.get("fullyQualifiedName")
            name = _identifier(raw_name)
            selection_name = raw.get("name")
            if not isinstance(selection_name, str) or not selection_name:
                selection_name = None
                raw_fqn = raw.get("fullyQualifiedName")
                if isinstance(raw_fqn, str) and raw_fqn and len(split_raw_name(raw_fqn)) == 1:
                    with suppress(ValueError):
                        selection_name = unquote_name(quote_name(raw_fqn))
            if filter_names and selection_name and selection_name not in filter_names:
                return
            config = raw.get("autoClassificationConfig")
            if config is None or (
                isinstance(config, dict) and _disabled(config.get("enabled"), _CLASSIFICATION_ENABLED)
            ):
                return
            field, _ = _missing_field(exc)
            self._diagnostic(name, f"Could not load classification {name}: missing or invalid {field}", warning=True)

        return callback

    def _tag_parse_error(self, classification_name: str):
        def callback(_entity: type, raw: dict, exc: Exception) -> None:
            if _disabled(raw.get("autoClassificationEnabled"), _TAG_ENABLED):
                return
            raw_fqn = raw.get("fullyQualifiedName")
            fqn = _identifier(raw_fqn)
            if _other_parent(raw_fqn, classification_name):
                return
            field, recognizer_index = _missing_field(exc, raw)
            recognizer = "<unknown>"
            recognizers = raw.get("recognizers")
            if isinstance(recognizers, list) and recognizer_index is not None and recognizer_index < len(recognizers):
                failing = recognizers[recognizer_index]
                if isinstance(failing, dict):
                    recognizer = _identifier(failing.get("name"))
            self._diagnostic(
                fqn,
                f"Could not load tag {fqn} in classification {classification_name}, "
                f"recognizer {recognizer}: missing or invalid {field}",
                warning=True,
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
            self._diagnostic("classifications", f"Failed to fetch classifications: {_fetch_reason(exc)}")

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
            loaded_before_classification = len(candidate_tags)
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
                        "parent": quote_name(classification_name),
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
                self._diagnostic(
                    classification_name,
                    f"Failed to fetch tags for classification {classification_name}: {_fetch_reason(exc)}"
                    + (" after partial results" if len(candidate_tags) > loaded_before_classification else ""),
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
