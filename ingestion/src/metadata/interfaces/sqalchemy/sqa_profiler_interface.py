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
Interfaces with database for all database engine
supporting sqlalchemy abstraction layer
"""

import concurrent.futures
import threading
import traceback
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, Optional

from sqlalchemy import Column, MetaData

from metadata.generated.schema.entity.data.table import Table, TableData
from metadata.ingestion.api.processor import ProfilerProcessorStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.interfaces.profiler_protocol import ProfilerProtocol
from metadata.interfaces.sqalchemy.mixins.sqa_mixin import SQAInterfaceMixin
from metadata.orm_profiler.api.models import TablePartitionConfig
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.metrics.sqa_metrics_computation_registry import (
    compute_metrics_registry,
)
from metadata.orm_profiler.profiler.runner import QueryRunner
from metadata.orm_profiler.profiler.sampler import Sampler
from metadata.utils.connections import (
    create_and_bind_thread_safe_session,
    get_connection,
)
from metadata.utils.logger import sqa_interface_registry_logger

logger = sqa_interface_registry_logger()
thread_local = threading.local()


class SQAProfilerInterface(SQAInterfaceMixin, ProfilerProtocol):
    """
    Interface to interact with registry supporting
    sqlalchemy.
    """

    # pylint: disable=too-many-arguments
    def __init__(
        self,
        service_connection_config,
        ometa_client: OpenMetadata,
        sqa_metadata_obj: Optional[MetaData] = None,
        thread_count: Optional[float] = 5,
        table_entity: Optional[Table] = None,
        table_sample_precentage: Optional[float] = None,
        table_sample_query: Optional[str] = None,
        table_partition_config: Optional[TablePartitionConfig] = None,
    ):
        """Instantiate SQA Interface object"""
        self._thread_count = thread_count
        self.table_entity = table_entity
        self.ometa_client = ometa_client
        self.service_connection_config = service_connection_config

        self.processor_status = ProfilerProcessorStatus()
        self.processor_status.entity = (
            self.table_entity.fullyQualifiedName.__root__
            if self.table_entity.fullyQualifiedName
            else None
        )

        self._table = self._convert_table_to_orm_object(sqa_metadata_obj)

        self.session_factory = self._session_factory(service_connection_config)
        self.session = self.session_factory()
        self.set_session_tag(self.session)

        self.profile_sample = table_sample_precentage
        self.profile_query = table_sample_query
        self.partition_details = (
            self.get_partition_details(table_partition_config)
            if not self.profile_query
            else None
        )

    @staticmethod
    def _session_factory(service_connection_config):
        """Create thread safe session that will be automatically
        garbage collected once the application thread ends
        """
        engine = get_connection(service_connection_config)
        return create_and_bind_thread_safe_session(engine)

    def _create_thread_safe_sampler(
        self,
        session,
        table,
    ):
        """Create thread safe runner"""
        if not hasattr(thread_local, "sampler"):
            thread_local.sampler = Sampler(
                session=session,
                table=table,
                profile_sample=self.profile_sample,
                partition_details=self.partition_details,
                profile_sample_query=self.profile_query,
            )
        return thread_local.sampler

    def _create_thread_safe_runner(
        self,
        session,
        table,
        sample,
    ):
        """Create thread safe runner"""
        if not hasattr(thread_local, "runner"):
            thread_local.runner = QueryRunner(
                session=session,
                table=table,
                sample=sample,
                partition_details=self.partition_details,
                profile_sample_query=self.profile_query,
            )
        return thread_local.runner

    def compute_metrics_in_thread(
        self,
        metric_funcs,
    ):
        """Run metrics in processor worker"""
        (
            metrics,
            metric_type,
            column,
            table,
        ) = metric_funcs
        logger.debug(
            f"Running profiler for {table.__tablename__} on thread {threading.current_thread()}"
        )
        Session = self.session_factory  # pylint: disable=invalid-name
        with Session() as session:
            self.set_session_tag(session)
            sampler = self._create_thread_safe_sampler(
                session,
                table,
            )
            sample = sampler.random_sample()
            runner = self._create_thread_safe_runner(
                session,
                table,
                sample,
            )

            row = compute_metrics_registry.registry[metric_type.value](
                metrics,
                runner=runner,
                session=session,
                column=column,
                sample=sample,
                processor_status=self.processor_status,
            )

            if column is not None:
                column = column.name

            return row, column

    # pylint: disable=use-dict-literal
    def get_all_metrics(
        self,
        metric_funcs: list,
    ):
        """get all profiler metrics"""
        logger.info(f"Computing metrics with {self._thread_count} threads.")
        profile_results = {"table": dict(), "columns": defaultdict(dict)}
        with concurrent.futures.ThreadPoolExecutor(
            max_workers=self._thread_count
        ) as executor:
            futures = [
                executor.submit(
                    self.compute_metrics_in_thread,
                    metric_func,
                )
                for metric_func in metric_funcs
            ]

        for future in concurrent.futures.as_completed(futures):
            profile, column = future.result()
            if not isinstance(profile, dict):
                profile = dict()
            if not column:
                profile_results["table"].update(profile)
            else:
                profile_results["columns"][column].update(
                    {
                        "name": column,
                        "timestamp": datetime.now(tz=timezone.utc).timestamp(),
                        **profile,
                    }
                )
        return profile_results

    def fetch_sample_data(self, table) -> TableData:
        """Fetch sample data from database

        Args:
            table: ORM declarative table

        Returns:
            TableData: sample table data
        """
        sampler = Sampler(
            session=self.session,
            table=table,
            profile_sample=self.profile_sample,
            partition_details=self.partition_details,
            profile_sample_query=self.profile_query,
        )
        return sampler.fetch_sample_data()

    def get_composed_metrics(
        self, column: Column, metric: Metrics, column_results: Dict
    ):
        """Given a list of metrics, compute the given results
        and returns the values

        Args:
            column: the column to compute the metrics against
            metrics: list of metrics to compute
        Returns:
            dictionnary of results
        """
        try:
            return metric(column).fn(column_results)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unexpected exception computing metrics: {exc}")
            self.session.rollback()
            return None
