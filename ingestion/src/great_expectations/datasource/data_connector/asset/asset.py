import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


class Asset:
    """
    A typed data asset class that maintains data asset specific properties (to override data connector level proprties with
    the same name and/or semantics, such as "partitioner_name", "base_directory", and "glob_directive").
    """

    def __init__(
        self,
        name: str,
        base_directory: Optional[str] = None,
        glob_directive: Optional[str] = None,
        pattern: Optional[str] = None,
        group_names: Optional[List[str]] = None,
        batch_spec_passthrough: Optional[dict] = None,
        # S3
        bucket: Optional[str] = None,
        max_keys: Optional[int] = None,
        # Azure
        container: Optional[str] = None,
        name_starts_with: Optional[str] = None,
        # GCS
        bucket_or_name: Optional[str] = None,
        max_results: Optional[int] = None,
        # Both S3/GCS
        prefix: Optional[str] = None,
        # Both S3/Azure
        delimiter: Optional[str] = None,
    ):
        self._name = name
        self._base_directory = base_directory
        self._glob_directive = glob_directive
        self._pattern = pattern
        # Note: this may need to become a nested object to accommodate sorters
        self._group_names = group_names
        self._batch_spec_passthrough = batch_spec_passthrough or {}

        # S3
        self._bucket = bucket
        self._max_keys = max_keys

        # Azure
        self._container = container
        self._name_starts_with = name_starts_with

        # GCS
        self._bucket_or_name = bucket_or_name
        self._max_results = max_results

        # Both S3/GCS
        self._prefix = prefix

        # Both S3/Azure
        self._delimiter = delimiter

    @property
    def name(self) -> str:
        return self._name

    @property
    def base_directory(self) -> Optional[str]:
        return self._base_directory

    @property
    def glob_directive(self) -> Optional[str]:
        return self._glob_directive

    @property
    def pattern(self) -> Optional[str]:
        return self._pattern

    @property
    def group_names(self) -> Optional[List[str]]:
        return self._group_names

    @property
    def batch_spec_passthrough(self) -> Optional[dict]:
        return self._batch_spec_passthrough

    @property
    def bucket(self) -> Optional[str]:
        return self._bucket

    @property
    def max_keys(self) -> Optional[int]:
        return self._max_keys

    @property
    def container(self) -> Optional[str]:
        return self._container

    @property
    def name_starts_with(self) -> Optional[str]:
        return self._name_starts_with

    @property
    def bucket_or_name(self) -> Optional[str]:
        return self._bucket_or_name

    @property
    def max_results(self) -> Optional[int]:
        return self._max_results

    @property
    def prefix(self) -> Optional[str]:
        return self._prefix

    @property
    def delimiter(self) -> Optional[str]:
        return self._delimiter
