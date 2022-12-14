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
Module in charge of running the queries against
the session.

This is useful to centralise the running logic
and manage behavior such as timeouts.
"""
import traceback
from typing import Dict, Optional, Union, List, Tuple, Any

from sqlalchemy import Column, or_, text, and_
from sqlalchemy.orm import DeclarativeMeta, Query, Session
from sqlalchemy.orm.util import AliasedClass
from sqlalchemy.sql.elements import BinaryExpression

from metadata.orm_profiler.profiler.handle_partition import partition_filter_handler
from metadata.utils.logger import query_runner_logger

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
        table: DeclarativeMeta,
        sample: Union[DeclarativeMeta, AliasedClass],
        partition_details: Optional[Dict] = None,
        profile_sample_query: Optional[str] = None,
    ):
        self._session = session
        self.table = table
        self._sample = sample
        self._partition_details = partition_details
        self._profile_sample_query = profile_sample_query

    def _build_query_filter(
        self,
        filters: List[Tuple[Column, str, Any]],
        or_filter: bool = False
        ) -> Optional[BinaryExpression]:
        """Dynamically build query filter

        Args:
            filters (List[Tuple[Column, str, Any]]): list of tuples representing filters
            or_filter (bool, optional): whether to perform an OR or AND condition. Defaults to False.

        Returns:
            BinaryExpression: a filter pattern
        """
        list_of_filters = []
        for filter_ in filters:
            column, operator, value = filter_
            try:
                filter_attr = next(
                    filter(
                        lambda x: hasattr(column, x % operator),
                        ["%s", "%s_", "__%s__"]
                        ),
                    None
                ) % operator  # type: ignore
            except TypeError as err:
                logger.debug(traceback.format_exc())
                logger.error(f"Error when looking for operator {operator} - {err}")
            else:
                list_of_filters.append(
                    getattr(column,filter_attr)(value)
                )

        if not list_of_filters:
            logger.debug("No filters found.")
            return None

        if or_filter:
            return or_(*list_of_filters)
        return and_(*list_of_filters)


    def _build_query(self, *entities, **kwargs) -> Query:
        return self._session.query(*entities, **kwargs)

    def _select_from_sample(self, *entities, **kwargs):
        query = self._build_query(*entities, **kwargs).select_from(self._sample)

        if kwargs.get("query_filters_"):
            filter_ = self._build_query_filter(kwargs.get("query_filters_"))
            if filter_:
                return query.filter(filter_)

        return query


    def _select_from_user_query(self, *entities, **kwargs):
        user_query = self._session.query(self.table).from_statement(
            text(f"{self._profile_sample_query}")
        )

        query = self._build_query(*entities, **kwargs).select_from(user_query)

        if kwargs.get("query_filters_"):
            filter_ = self._build_query_filter(kwargs.get("query_filters_"))
            if filter_:
                return query.filter(filter_)

        return query

    @partition_filter_handler()
    def select_first_from_table(self, *entities, **kwargs):
        if self._profile_sample_query:
            return self._select_from_user_query(*entities, **kwargs).first()

        query = self._build_query(*entities, **kwargs).select_from(self.table)

        if kwargs.get("query_filters_"):
            filter_ = self._build_query_filter(kwargs.get("query_filters_"))
            if filter_:
                return query.filter(filter_).first()

        return query.first()

    @partition_filter_handler(first=False)
    def select_all_from_table(self, *entities, **kwargs):
        if self._profile_sample_query:
            return self._select_from_user_query(*entities, **kwargs).all()

        query = self._build_query(*entities, **kwargs).select_from(self.table)

        if kwargs.get("query_filters_"):
            filter_ = self._build_query_filter(kwargs.get("query_filters_"))
            if filter_:
                return query.filter(filter_).all()

        return query.all()

    @partition_filter_handler(sampled=True)
    def select_first_from_sample(self, *entities, **kwargs):
        return self._select_from_sample(*entities, **kwargs).first()

    @partition_filter_handler(first=False, sampled=True)
    def select_all_from_sample(self, *entities, **kwargs):
        return self._select_from_sample(*entities, **kwargs).all()

    def dispatch_query_select_first(self, *entities, **kwargs):
        """dispatch query to sample or all table"""
        if isinstance(self._sample, AliasedClass):
            return self.select_first_from_sample(*entities, **kwargs)
        return self.select_first_from_table(*entities, **kwargs)

    @staticmethod
    def select_first_from_query(query: Query):
        return query.first()

    @staticmethod
    def select_all_from_query(query: Query):
        return query.all()
