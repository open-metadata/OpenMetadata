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
Module in charge of running the queries against
the session.

This is useful to centralise the running logic
and manage behavior such as timeouts.
"""
from typing import Dict, Optional, Union

from sqlalchemy import Table, text
from sqlalchemy.orm import DeclarativeMeta, Query, Session
from sqlalchemy.orm.util import AliasedClass

from metadata.utils.logger import query_runner_logger
from metadata.utils.sqa_utils import (
    get_query_filter_for_runner,
    get_query_group_by_for_runner,
)

logger = query_runner_logger()


class QueryRunner:
    """
    Handles the query runs and returns the results
    to the caller.

    The goal of this class is abstract a bit
    how to get the query results. Moreover,
    we can then wrap it up with a timeout
    to make sure that methods executed from this class
    won't take more than X seconds to execute.
    """

    def __init__(
        self,
        session: Session,
        dataset: Union[DeclarativeMeta, AliasedClass],
        raw_dataset: Table,
        partition_details: Optional[Dict] = None,
        profile_sample_query: Optional[str] = None,
    ):
        self._session = session
        self._dataset = dataset
        self.partition_details = partition_details
        self.profile_sample_query = profile_sample_query
        self.raw_dataset = raw_dataset

    @property
    def table(self) -> Table:
        """Backward compatibility table attribute access"""
        return self.raw_dataset

    @property
    def _sample(self):
        """Backward compatibility _sample attribute access"""
        return self._dataset

    @property
    def dataset(self):
        """Dataset attribute access"""
        return self._dataset

    @dataset.setter
    def dataset(self, dataset):
        self._dataset = dataset

    @property
    def table_name(self):
        """Table name attribute access"""
        return self.raw_dataset.__table__.name

    @property
    def schema_name(self):
        """Table name attribute access"""
        return self.raw_dataset.__table__.schema

    @property
    def session(self):
        """Table name attribute access"""
        return self._session

    @property
    def dialect(self) -> str:
        """Dialect attribute access"""
        return self._session.get_bind().dialect.name

    def _build_query(self, *entities, **kwargs) -> Query:
        """Build query object

        Args:
            *entities: entities to select
            **kwargs: kwargs to pass to the query
        """
        return self._session.query(*entities, **kwargs)

    def _select_from_sample(self, *entities, **kwargs):
        """This method will use the sample data
        and the partitioning logic if available otherwise it will use the raw table.

        Args:
            *entities: entities to select
            **kwargs: kwargs to pass to the query
        """
        filter_ = get_query_filter_for_runner(kwargs)
        group_by_ = get_query_group_by_for_runner(kwargs)

        query = self._build_query(*entities, **kwargs).select_from(self._dataset)

        if filter_ is not None:
            query = query.filter(filter_)

        if group_by_ is not None:
            query = query.group_by(*group_by_)

        return query

    def _select_from_user_query(self, *entities, **kwargs):
        """Use the user query to select data from the table

        Args:
            *entities: entities to select
            **kwargs: kwargs to pass to the query
        """
        filter_ = get_query_filter_for_runner(kwargs)
        group_by_ = get_query_group_by_for_runner(kwargs)
        user_query = self._session.query(self._dataset).from_statement(
            text(f"{self.profile_sample_query}")
        )

        query = self._build_query(*entities, **kwargs).select_from(user_query)

        if filter_ is not None:
            query = query.filter(filter_)

        if group_by_ is not None:
            query = query.group_by(*group_by_)

        return query

    def select_first_from_table(self, *entities, **kwargs):
        """Select first row from the table. This method will use the raw table and
        omit any sampling or partitioning logic.

        Args:
            *entities: entities to select
            **kwargs: kwargs to pass to the query
        """
        filter_ = get_query_filter_for_runner(kwargs)
        group_by_ = get_query_group_by_for_runner(kwargs)

        if self.profile_sample_query:
            return self._select_from_user_query(*entities, **kwargs).first()
        query = self._build_query(*entities, **kwargs).select_from(self.table)

        if filter_ is not None:
            query = query.filter(filter_)

        if group_by_ is not None:
            query = query.group_by(*group_by_)

        return query.first()

    def select_all_from_table(self, *entities, **kwargs):
        """Select all rows from the table. This method will use the raw table and
        omit any sampling or partitioning logic.

        Args:
            *entities: entities to select
            **kwargs: kwargs to pass to the query
        """
        filter_ = get_query_filter_for_runner(kwargs)
        group_by_ = get_query_group_by_for_runner(kwargs)

        if self.profile_sample_query:
            return self._select_from_user_query(*entities, **kwargs).all()

        query = self._build_query(*entities, **kwargs).select_from(self.table)

        if filter_ is not None:
            query = query.filter(filter_)

        if group_by_ is not None:
            query = query.group_by(*group_by_)

        return query.all()

    def select_first_from_sample(self, *entities, **kwargs):
        """Select first row from the sample data. This method will use the sample data
        and the partitioning logic if available otherwise it will use the raw table.

        Args:
            *entities: entities to select
            **kwargs: kwargs to pass to the query
        """
        return self._select_from_sample(*entities, **kwargs).first()

    def select_all_from_sample(self, *entities, **kwargs):
        """Select all rows from the sample data. This method will use the sample data
        and the partitioning logic if available otherwise it will use the raw table.

        Args:
            *entities: entities to select
            **kwargs: kwargs to pass to the query
        """
        return self._select_from_sample(*entities, **kwargs).all()

    def yield_from_sample(self, *entities, **kwargs):
        """Yield rows from the sample data

        Args:
            *entities: entities to select
            **kwargs: kwargs to pass to the query
        """
        result = self._session.execute(self._select_from_sample(*entities, **kwargs))
        while True:
            rows = result.fetchmany(1000)
            if not rows:
                break
            yield from rows

    def dispatch_query_select_first(self, *entities, **kwargs):
        """Dispatch query to sample or all table.
        Note: Kept for backward compatibility

        Args:
            *entities: entities to select
            **kwargs: kwargs to pass to the query
        """
        return self.select_first_from_sample(*entities, **kwargs)

    @staticmethod
    def select_first_from_query(query: Query):
        """Given a query object, return the first row

        Args:
            query (Query): query object
        """
        return query.first()

    @staticmethod
    def select_all_from_query(query: Query):
        """Given a query object, return all the rows

        Args:
            query (Query): query object
        """
        return query.all()
