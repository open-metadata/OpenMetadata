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

from tkinter.messagebox import NO
from typing import Optional, List, Dict, Union
from metadata.orm_profiler.profiler.runner import QueryRunner
from sqlalchemy import Column
from sqlalchemy.orm import Session, DeclarativeMeta
from sqlalchemy.engine.row import Row

from metadata.utils.logger import sqa_interface_registry_logger
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiler.sampler import Sampler
from metadata.utils.connections import (
    get_connection,
    test_connection,
    create_and_bind_session,
)

logger = sqa_interface_registry_logger()

class SQAProfilerInterface:
    """
    Interface to interact with registry supporting
    sqlalchemy.
    """
    def __init__(self, service_connection_config):
        """Instantiate SQA Interface object"""
        self._sample = None
        self._sampler = None
        self._runner = None
        self.session: Session = create_and_bind_session(
                self._get_engine(service_connection_config),
        )

    @property
    def sample(self):
        """Getter method for sample attribute"""
        if not self.sampler:
            raise RuntimeError("You must create a sampler first `<instance>.create_sampler(...)`.")
        if not self._sample:
            self._sample = self.sampler.random_sample()

        return self._sample

    
    @property
    def runner(self):
        """Getter method for runner attribute"""
        return self._runner


    @property
    def sampler(self):
        """Getter methid for sampler attribute"""
        return self._sampler


    def _get_engine(self, service_connection_config):
        """Get engine for database
        
        Args:
            service_connection_config: connection details for the specific service
        Returns:
            sqlalchemy engine
        """
        engine = get_connection(service_connection_config)
        test_connection(engine)

        return engine

    def create_sampler(
        self,
        table: DeclarativeMeta,
        profile_sample: Optional[float] = None, 
        partition_details: Optional[dict] = None,
        profile_sample_query: Optional[str] = None,
        ) -> None:
        """Create sampler instance
        
        Args:
            table: sqlalchemy declarative table of the database table,
            profile_sample: percentage to use for the table sample (between 0-100)
            partition_details: details about the table partition
            profile_sample_query: custom query used for table sampling
        """
        self._sampler =  Sampler(
                            session=self.session,
                            table=table,
                            profile_sample=profile_sample,
                            partition_details=partition_details,
                            profile_sample_query=profile_sample_query
                        )

    
    def create_runner(
        self,
        table: DeclarativeMeta,
        partition_details: Optional[dict] = None,
        profile_sample_query: Optional[str] = None,
        ) -> None:
        """Create a QueryRunner Instance
        
        Args:
            table: sqlalchemy declarative table of the database table,
            profile_sample: percentage to use for the table sample (between 0-100)
            partition_details: details about the table partition
            profile_sample_query: custom query used for table sampling
        """

        self._runner = QueryRunner(
                        session=self.session,
                        table=table,
                        sample=self.sample,
                        partition_details=partition_details,
                        profile_sample_query=profile_sample_query
                    )


    def get_table_metrics(
        self,
        metrics: List[Metrics],
        ) -> Dict[str, Union[str, int]]:
        """Given a list of metrics, compute the given results 
        and returns the values

        Args:
            metrics: list of metrics to compute
        Returns:
            dictionnary of results
        """
        row = self.runner.select_all_from_table(
            *[
                metric().fn() for metric in metrics
            ]
        )

        if row:
            return dict(row)


    def get_static_metrics(
        self,
        column: Column,
        metrics: List[Metrics],
        ) -> Dict[str, Union[str, int]]:
        """Given a list of metrics, compute the given results 
        and returns the values

        Args:
            column: the column to compute the metrics against 
            metrics: list of metrics to compute
        Returns:
            dictionnary of results
        """
        row = self.runner.select_first_from_sample(
            *[
                metric(column).fn()
                for metric in metrics
                if not metric.is_window_metric()
            ]
        )
        return dict(row)


    def get_query_metrics(
        self,
        column: Column,
        metric: Metrics,
        ) -> Dict[str, Union[str, int]]:
        """Given a list of metrics, compute the given results 
        and returns the values

        Args:
            column: the column to compute the metrics against 
            metrics: list of metrics to compute
        Returns:
            dictionnary of results
        """
        col_metric = metric(column)
        metric_query = col_metric.query(
            sample=self.sample, session=self.session
        )

        if not metric_query:
            return
        if col_metric.metric_type == dict:
            results = self.runner.select_all_from_query(metric_query)
            data = {
                k: [result[k] for result in results] for k in dict(results[0])
            }
            return {metric.name(): data}

        else:
            row = self.runner.select_first_from_query(metric_query)
            return dict(row)


    def get_composed_metrics(
        self,
        column: Column,
        metric: Metrics,
        column_results: Dict
        ):
        """Given a list of metrics, compute the given results 
        and returns the values

        Args:
            column: the column to compute the metrics against 
            metrics: list of metrics to compute
        Returns:
            dictionnary of results
        """
        return metric(column).fn(column_results)


    def get_window_metrics(
        self,
        column: Column,
        metric: Metrics,
        ) -> Dict[str, Union[str, int]]:
        """Given a list of metrics, compute the given results 
        and returns the values

        Args:
            column: the column to compute the metrics against 
            metrics: list of metrics to compute
        Returns:
            dictionnary of results
        """
        row = self.runner.select_first_from_sample(metric(column).fn())
        if not isinstance(row, Row):
            return {metric.name(): row}
        return dict(row)