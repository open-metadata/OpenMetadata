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
Prepare a timer to report on the workflow status
"""
import traceback
from logging import Logger

from metadata.ingestion.api.bulk_sink import BulkSinkStatus
from metadata.ingestion.api.sink import SinkStatus
from metadata.ingestion.api.source import SourceStatus
from metadata.timer.repeated_timer import RepeatedTimer


def report_ingestion_status(logger: Logger, workflow: "Workflow") -> None:
    """
    Given a logger, use it to INFO the workflow status
    """
    try:
        source_status: SourceStatus = workflow.source.get_status()
        logger.info(
            f"Source: Processed {len(source_status.success)} records,"
            f" filtered {len(source_status.filtered)} records,"
            f" found {len(source_status.failures)} errors"
        )
        if hasattr(workflow, "sink"):
            sink_status: SinkStatus = workflow.sink.get_status()
            logger.info(
                f"Sink: Processed {len(sink_status.records)} records,"
                f" found {len(sink_status.failures)} errors"
            )
        if hasattr(workflow, "bulk_sink"):
            bulk_sink_status: BulkSinkStatus = workflow.bulk_sink.get_status()
            logger.info(
                f"Bulk Sink: Processed {len(bulk_sink_status.records)} records,"
                f" found {len(bulk_sink_status.failures)} errors"
            )

    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.error(f"Wild exception reporting status - {exc}")


def get_ingestion_status_timer(
    interval: int, logger: Logger, workflow: "Workflow"
) -> RepeatedTimer:
    """
    Prepare the threading Timer to execute the report_ingestion_status
    """
    return RepeatedTimer(interval, report_ingestion_status, logger, workflow)
