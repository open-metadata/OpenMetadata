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
Kafka configuration parser for Databricks DLT pipelines
"""

import re
from typing import List, Optional

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class KafkaSourceConfig:
    """Model for Kafka source configuration extracted from DLT code"""

    def __init__(
        self,
        bootstrap_servers: Optional[str] = None,
        topics: Optional[List[str]] = None,
        group_id_prefix: Optional[str] = None,
    ):
        self.bootstrap_servers = bootstrap_servers
        self.topics = topics or []
        self.group_id_prefix = group_id_prefix


def extract_kafka_sources(source_code: str) -> List[KafkaSourceConfig]:
    """
    Extract Kafka topic configurations from DLT source code

    Parses patterns like:
    - spark.readStream.format("kafka").option("subscribe", "topic1,topic2")
    - .option("kafka.bootstrap.servers", "broker:9092")
    - .option("groupIdPrefix", "dlt-pipeline")

    Returns empty list if parsing fails or no sources found
    """
    kafka_configs = []

    try:
        if not source_code:
            logger.debug("Empty or None source code provided")
            return kafka_configs

        kafka_stream_pattern = re.compile(
            r'\.format\s*\(\s*["\']kafka["\']\s*\)(.*?)\.load\s*\(\s*\)',
            re.DOTALL | re.IGNORECASE,
        )

        for match in kafka_stream_pattern.finditer(source_code):
            try:
                config_block = match.group(1)

                bootstrap_servers = _extract_option(
                    config_block, r"kafka\.bootstrap\.servers"
                )
                subscribe_topics = _extract_option(config_block, r"subscribe")
                topics = _extract_option(config_block, r"topics")
                group_id_prefix = _extract_option(config_block, r"groupIdPrefix")

                topic_list = []
                if subscribe_topics:
                    topic_list = [
                        t.strip() for t in subscribe_topics.split(",") if t.strip()
                    ]
                elif topics:
                    topic_list = [t.strip() for t in topics.split(",") if t.strip()]

                if bootstrap_servers or topic_list:
                    kafka_config = KafkaSourceConfig(
                        bootstrap_servers=bootstrap_servers,
                        topics=topic_list,
                        group_id_prefix=group_id_prefix,
                    )
                    kafka_configs.append(kafka_config)
                    logger.debug(
                        f"Extracted Kafka config: brokers={bootstrap_servers}, "
                        f"topics={topic_list}, group_prefix={group_id_prefix}"
                    )
            except Exception as exc:
                logger.warning(f"Failed to parse individual Kafka config block: {exc}")
                continue

    except Exception as exc:
        logger.warning(f"Error parsing Kafka sources from code: {exc}")

    return kafka_configs


def _extract_option(config_block: str, option_name: str) -> Optional[str]:
    """
    Extract a single option value from Kafka configuration block
    Safely handles any parsing errors
    """
    try:
        pattern = (
            rf'\.option\s*\(\s*["\']({option_name})["\']\s*,\s*["\']([^"\']+)["\']\s*\)'
        )
        match = re.search(pattern, config_block, re.IGNORECASE)
        if match:
            return match.group(2)
    except Exception as exc:
        logger.debug(f"Failed to extract option {option_name}: {exc}")
    return None


def get_pipeline_libraries(pipeline_config: dict) -> List[str]:
    """
    Extract notebook and file paths from pipeline configuration
    Safely handles missing or malformed configuration
    """
    libraries = []

    try:
        if not pipeline_config:
            return libraries

        for lib in pipeline_config.get("libraries", []):
            try:
                if "notebook" in lib:
                    notebook_path = lib["notebook"].get("path")
                    if notebook_path:
                        libraries.append(notebook_path)
                elif "file" in lib:
                    file_path = lib["file"].get("path")
                    if file_path:
                        libraries.append(file_path)
            except Exception as exc:
                logger.debug(f"Failed to process library entry {lib}: {exc}")
                continue

    except Exception as exc:
        logger.warning(f"Error extracting pipeline libraries: {exc}")

    return libraries
