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
Mixin class for centralized log streaming to S3 storage

This mixin provides methods to send ingestion logs to OpenMetadata server's
S3 storage backend. It's designed to be used by OpenMetadata class and
integrates with the existing logging infrastructure.
"""

import base64
import gzip
import json
import os
import socket
import time
from typing import Optional
from uuid import UUID

from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.utils import model_str
from metadata.utils.constants import UTF_8
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class OMetaLogsMixin:
    """
    OpenMetadata API methods for log streaming to S3.

    This mixin provides centralized methods for shipping logs to the
    OpenMetadata server's S3 storage backend. It reuses the existing
    OpenMetadata client instance to avoid creating new sessions.
    """

    client: REST

    def send_logs_to_s3(
        self,
        pipeline_fqn: str,
        run_id: UUID,
        log_content: str,
        compress: bool = False,
    ) -> bool:
        """
        Send logs to S3 storage via OpenMetadata server endpoint.

        Args:
            pipeline_fqn: Fully qualified name of the ingestion pipeline
            run_id: Unique identifier for the pipeline run
            log_content: The log content to send
            compress: Whether to compress logs before sending

        Returns:
            bool: True if logs were sent successfully, False otherwise
        """
        try:
            # Extract the UUID string value from the object if it has a .root attribute
            # Build the API endpoint
            url = (
                f"/services/ingestionPipelines/logs/{pipeline_fqn}/{model_str(run_id)}"
            )

            # Prepare log batch data matching Java LogBatch structure
            log_batch = {
                "logs": log_content,
                "timestamp": int(time.time() * 1000),  # milliseconds since epoch
                "connectorId": f"{socket.gethostname()}-{os.getpid()}",
                "compressed": False,
                "lineCount": log_content.count("\n") + 1,
            }

            # Apply compression if requested and content is large enough
            if compress and len(log_content) > 10240:  # Compress if > 10KB
                compressed_data = gzip.compress(log_content.encode(UTF_8))
                log_batch["logs"] = base64.b64encode(compressed_data).decode(UTF_8)
                log_batch["compressed"] = True

            # Send logs using the existing client
            self.client.post(
                url,
                data=json.dumps(log_batch),
            )

            # The REST client returns None for successful requests with empty response body (HTTP 200/201/204)
            # If we reach this point without an exception, the request was successful
            logger.debug(
                f"Successfully sent {log_batch['lineCount']} log lines for pipeline {pipeline_fqn}"
            )
            return True

        except Exception as e:
            line_count = log_content.count("\n") + 1
            logger.error(
                f"Failed to send logs to S3 for pipeline {pipeline_fqn}: {e}. "
                f"Log batch size: {len(log_content)} chars, "
                f"Lines: {line_count}, "
                f"Compressed: {log_batch.get('compressed', False)}"
            )
            return False

    def send_logs_batch(
        self,
        pipeline_fqn: str,
        run_id: UUID,
        log_content: str,
        enable_compression: bool = False,
        max_retries: int = 3,
    ) -> dict:
        """
        Send logs batch to S3 storage via OpenMetadata server endpoint with retry logic.

        Args:
            pipeline_fqn: Fully qualified name of the ingestion pipeline
            run_id: Unique identifier for the pipeline run
            log_content: The log content to send
            enable_compression: Whether to compress logs before sending
            max_retries: Maximum number of retry attempts

        Returns:
            dict: Metrics including lines sent and bytes sent
        """
        metrics = {"logs_sent": 0, "bytes_sent": 0}

        for attempt in range(max_retries + 1):
            try:
                success = self.send_logs_to_s3(
                    pipeline_fqn=pipeline_fqn,
                    run_id=run_id,
                    log_content=log_content,
                    compress=enable_compression and len(log_content) > 10240,
                )

                if success:
                    # Update metrics
                    line_count = log_content.count("\n") + 1
                    metrics["logs_sent"] = line_count
                    metrics["bytes_sent"] = len(log_content)

                    if attempt > 0:
                        logger.info(
                            f"Successfully shipped {line_count} log lines to server on attempt {attempt + 1}"
                        )
                    else:
                        logger.debug(
                            f"Successfully shipped {line_count} log lines to server"
                        )
                    return metrics
                else:
                    if attempt < max_retries:
                        wait_time = 2**attempt  # Exponential backoff: 1s, 2s, 4s
                        logger.warning(
                            f"Failed to send logs for pipeline {pipeline_fqn}, "
                            f"attempt {attempt + 1}/{max_retries + 1}. Retrying in {wait_time}s..."
                        )
                        time.sleep(wait_time)
                    else:
                        logger.error(
                            f"Failed to send logs for pipeline {pipeline_fqn} after {max_retries + 1} attempts"
                        )

            except Exception as e:
                if attempt < max_retries:
                    wait_time = 2**attempt  # Exponential backoff: 1s, 2s, 4s
                    logger.warning(
                        f"Error sending logs batch for pipeline {pipeline_fqn}: {e}. "
                        f"Attempt {attempt + 1}/{max_retries + 1}. Retrying in {wait_time}s..."
                    )
                    time.sleep(wait_time)
                else:
                    logger.error(
                        f"Failed to send logs batch for pipeline {pipeline_fqn} after {max_retries + 1} attempts: {e}"
                    )

        return metrics

    def create_log_stream(
        self,
        pipeline_fqn: str,
        run_id: UUID,
    ) -> None:
        """
        Initialize a log stream for a pipeline run.

        This method can be used to set up a log stream session with the server.

        Args:
            pipeline_fqn: Fully qualified name of the ingestion pipeline
            run_id: Unique identifier for the pipeline run
        """
        try:

            # Initialize log stream with the server
            url = (
                f"/services/ingestionPipelines/logs/{pipeline_fqn}/{model_str(run_id)}"
            )

            init_data = {
                "connectorId": f"{socket.gethostname()}-{os.getpid()}",
                "timestamp": int(time.time() * 1000),
            }

            response = self.client.post(
                url,
                data=json.dumps(init_data),
            )

        except Exception as e:
            logger.warning(
                f"Failed to initialize log stream for pipeline {pipeline_fqn}: {e}"
            )

    def close_log_stream(
        self,
        pipeline_fqn: str,
        run_id: UUID,
    ) -> bool:
        """
        Close a log stream for a pipeline run.

        This method signals the server that log streaming has completed
        for a particular pipeline run.

        Args:
            pipeline_fqn: Fully qualified name of the ingestion pipeline
            run_id: Unique identifier for the pipeline run

        Returns:
            bool: True if stream was closed successfully, False otherwise
        """
        try:

            url = f"/services/ingestionPipelines/logs/{pipeline_fqn}/{model_str(run_id)}/close"

            close_data = {
                "connectorId": f"{socket.gethostname()}-{os.getpid()}",
                "timestamp": int(time.time() * 1000),
            }

            self.client.post(
                url,
                data=json.dumps(close_data),
            )

            logger.debug(f"Successfully closed log stream for pipeline {pipeline_fqn}")

            return True

        except Exception as e:
            logger.warning(
                f"Failed to close log stream for pipeline {pipeline_fqn}: {e}"
            )
            return False

    def get_logs_from_s3(
        self,
        pipeline_fqn: str,
        run_id: UUID,
        offset: int = 0,
        limit: int = 1000,
    ) -> Optional[str]:
        """
        Retrieve logs from S3 storage for a pipeline run.

        Args:
            pipeline_fqn: Fully qualified name of the ingestion pipeline
            run_id: Unique identifier for the pipeline run
            offset: Starting offset for log retrieval
            limit: Maximum number of log lines to retrieve

        Returns:
            Optional[str]: Log content if available, None otherwise
        """
        try:

            url = (
                f"/services/ingestionPipelines/logs/{pipeline_fqn}/{model_str(run_id)}"
            )

            params = {
                "offset": offset,
                "limit": limit,
            }

            response = self.client.get(url, data=params)

            if response and isinstance(response, dict):
                log_data = response.get("logs", "")

                # Decompress if necessary
                if response.get("compressed"):
                    try:
                        decoded = base64.b64decode(log_data)
                        log_data = gzip.decompress(decoded).decode(UTF_8)
                    except Exception as e:
                        logger.error(f"Failed to decompress logs: {e}")
                        return None

                return log_data

            return None

        except Exception as e:
            logger.error(
                f"Failed to retrieve logs from S3 for pipeline {pipeline_fqn}: {e}"
            )
            return None
