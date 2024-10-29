#  Copyright 2024 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Module that defines the TableDiffParamsSetter class."""
from ast import literal_eval
from typing import List, Optional
from urllib.parse import urlparse

from metadata.data_quality.validations import utils
from metadata.data_quality.validations.models import (
    Column,
    TableDiffRuntimeParameters,
    TableParameter,
)
from metadata.data_quality.validations.runtime_param_setter.param_setter import (
    RuntimeParameterSetter,
)
from metadata.generated.schema.entity.data.table import Constraint, Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.source.connections import get_connection
from metadata.profiler.orm.registry import Dialects
from metadata.utils import fqn
from metadata.utils.collections import CaseInsensitiveList


class TableDiffParamsSetter(RuntimeParameterSetter):
    """
    Set runtime parameters for a the table diff test.
    Sets the following variables:
    - service1Url: The url of the first service (data diff compliant)
    - service2Url: The url of the second service (data diff compliant)
    - table1: The table path for the first service (only schema and table name)
    - table2: The table path for the second service (only schema and table name)
    - keyColumns: If not defined, construct the key columns based on primary key or unique constraint.
    - extraColumns: If not defined, construct the extra columns as all columns except the key columns.
    - whereClause: Exrtact where clause based on partitioning and user input
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._table_columns = {
            column.name.root: column for column in self.table_entity.columns
        }

    def get_parameters(self, test_case) -> TableDiffRuntimeParameters:
        service1_url = (
            str(get_connection(self.service_connection_config).url)
            if self.service_connection_config
            else None
        )
        service1: DatabaseService = self.ometa_client.get_by_id(
            DatabaseService, self.table_entity.service.id, nullable=False
        )
        table2_fqn = self.get_parameter(test_case, "table2")
        case_sensitive_columns: bool = utils.get_bool_test_case_param(
            test_case.parameterValues, "caseSensitiveColumns"
        )
        if table2_fqn is None:
            raise ValueError("table2 not set")
        table2: Table = self.ometa_client.get_by_name(
            Table, fqn=table2_fqn, nullable=False
        )
        service2_url = (
            service1_url if table2.service == self.table_entity.service else None
        )
        service2: DatabaseService = self.ometa_client.get_by_id(
            DatabaseService, table2.service.id, nullable=False
        )
        key_columns = self.get_key_columns(test_case)
        extra_columns = self.get_extra_columns(key_columns, test_case)
        return TableDiffRuntimeParameters(
            table1=TableParameter(
                path=self.get_data_diff_table_path(
                    self.table_entity.fullyQualifiedName.root
                ),
                serviceUrl=self.get_data_diff_url(
                    service1,
                    self.table_entity.fullyQualifiedName.root,
                    override_url=service1_url,
                ),
                columns=self.filter_relevant_columns(
                    self.table_entity.columns,
                    key_columns,
                    extra_columns,
                    case_sensitive=case_sensitive_columns,
                ),
            ),
            table2=TableParameter(
                path=self.get_data_diff_table_path(table2_fqn),
                serviceUrl=self.get_data_diff_url(
                    service2,
                    table2_fqn,
                    override_url=self.get_parameter(test_case, "service2Url")
                    or service2_url,
                ),
                columns=self.filter_relevant_columns(
                    table2.columns,
                    key_columns,
                    extra_columns,
                    case_sensitive=case_sensitive_columns,
                ),
            ),
            keyColumns=key_columns,
            extraColumns=extra_columns,
            whereClause=self.build_where_clause(test_case),
        )

    # pylint: disable=protected-access
    def build_where_clause(self, test_case) -> Optional[str]:
        param_where_clause = self.get_parameter(test_case, "where", None)
        partition_where_clause = (
            None
            if not self.sampler._partition_details
            or not self.sampler._partition_details.enablePartitioning
            else self.sampler.get_partitioned_query().whereclause.compile(
                compile_kwargs={"literal_binds": True}
            )
        )
        where_clauses = [param_where_clause, partition_where_clause]
        where_clauses = [x for x in where_clauses if x]
        where_clauses = [f"({x})" for x in where_clauses]
        return " AND ".join(where_clauses)

    def get_extra_columns(
        self, key_columns: List[str], test_case
    ) -> Optional[List[str]]:
        extra_columns_param = self.get_parameter(test_case, "useColumns", None)
        if extra_columns_param is not None:
            extra_columns: List[str] = literal_eval(extra_columns_param)
            self.validate_columns(extra_columns)
            return extra_columns
        if extra_columns_param is None:
            extra_columns_param = []
            for column in self.table_entity.columns:
                if column.name.root not in key_columns:
                    extra_columns_param.insert(0, column.name.root)
        return extra_columns_param

    def get_key_columns(self, test_case) -> List[str]:
        key_columns_param = self.get_parameter(test_case, "keyColumns", "[]")
        key_columns: List[str] = literal_eval(key_columns_param)
        if key_columns:
            self.validate_columns(key_columns)
        if not key_columns:
            for column in self.table_entity.columns:
                if column.constraint == Constraint.PRIMARY_KEY:
                    key_columns.append(column.name.root)
        if not key_columns:
            for column in self.table_entity.columns:
                if column.constraint == Constraint.UNIQUE:
                    key_columns.append(column.name.root)
        if not key_columns:
            raise ValueError(
                "Failed to resolve key columns for table diff.\n",
                "Could not find primary key or unique constraint columns.\n",
                "Specify 'keyColumns' to explicitly set the columns to use as keys.",
            )
        return key_columns

    @staticmethod
    def filter_relevant_columns(
        columns: List[Column],
        key_columns: List[str],
        extra_columns: List[str],
        case_sensitive: bool,
    ) -> List[Column]:
        validated_columns = (
            [*key_columns, *extra_columns]
            if case_sensitive
            else CaseInsensitiveList([*key_columns, *extra_columns])
        )
        return [c for c in columns if c.name.root in validated_columns]

    @staticmethod
    def get_parameter(test_case: TestCase, key: str, default=None):
        return next(
            (p.value for p in test_case.parameterValues if p.name == key), default
        )

    @staticmethod
    def get_data_diff_url(
        db_service: DatabaseService, table_fqn, override_url: Optional[str] = None
    ) -> str:
        """Get the url for the data diff service.

        Args:
            db_service (DatabaseService): The database service entity
            table_fqn (str): The fully qualified name of the table
            override_url (Optional[str], optional): Override the url. Defaults to None.

        Returns:
            str: The url for the data diff service
        """
        source_url = (
            str(get_connection(db_service.connection.config).url)
            if not override_url
            else override_url
        )
        url = urlparse(source_url)
        # remove the driver name from the url because table-diff doesn't support it
        kwargs = {"scheme": url.scheme.split("+")[0]}
        service, database, schema, table = fqn.split(  # pylint: disable=unused-variable
            table_fqn
        )
        # path needs to include the database AND schema in some of the connectors
        if hasattr(db_service.connection.config, "supportsDatabase"):
            kwargs["path"] = f"/{database}"
        if kwargs["scheme"] in {Dialects.MSSQL, Dialects.Snowflake}:
            kwargs["path"] = f"/{database}/{schema}"
        return url._replace(**kwargs).geturl()

    @staticmethod
    def get_data_diff_table_path(table_fqn: str) -> str:
        service, database, schema, table = fqn.split(  # pylint: disable=unused-variable
            table_fqn
        )
        return fqn._build(  # pylint: disable=protected-access
            "___SERVICE___", "__DATABASE__", schema, table
        ).replace("___SERVICE___.__DATABASE__.", "")

    def validate_columns(self, column_names: List[str]):
        for column in column_names:
            if not self._table_columns.get(column):
                raise ValueError(
                    f"Failed to resolve key columns for table diff.\n"
                    f"Column '{column}' not found in table '{self.table_entity.name.root}'.\n"
                )
