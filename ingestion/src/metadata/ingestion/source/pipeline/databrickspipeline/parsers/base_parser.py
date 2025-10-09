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
Base parser interface for extracting data sources from Databricks notebooks
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class SourceReference:
    """
    Generic source reference extracted from notebook code
    Represents any external data source: Kafka topics, Delta tables, S3 files, JDBC tables, etc.
    """

    source_type: str  # "kafka_topic", "delta_table", "s3_path", "jdbc_table", etc.
    source_name: str  # The actual name/identifier (topic name, table name, path, etc.)
    source_fqn: Optional[str] = None  # Fully qualified name if applicable
    connection_details: dict = field(default_factory=dict)  # Server, bucket, etc.
    metadata: dict = field(default_factory=dict)  # Additional context


class BaseSourceParser(ABC):
    """
    Abstract base class for notebook source parsers
    Each parser extracts a specific type of data source (Kafka, Delta, S3, etc.)
    """

    @abstractmethod
    def get_source_type(self) -> str:
        """
        Return the source type this parser handles
        Examples: "kafka", "delta", "s3", "jdbc", "unity_catalog"
        """
        pass

    @abstractmethod
    def extract_sources(self, source_code: str) -> List[SourceReference]:
        """
        Extract all sources of this type from notebook source code

        Args:
            source_code: Python/SQL source code from Databricks notebook

        Returns:
            List of SourceReference objects found in the code
        """
        pass

    @abstractmethod
    def can_parse(self, source_code: str) -> bool:
        """
        Quick check if this parser can extract anything from the code
        Used to skip parsers that don't apply

        Args:
            source_code: Python/SQL source code

        Returns:
            True if this parser should run on this code
        """
        pass

    def get_priority(self) -> int:
        """
        Parser priority (lower = runs first)
        Useful when multiple parsers might match the same pattern

        Returns:
            Priority level (default: 100)
        """
        return 100
