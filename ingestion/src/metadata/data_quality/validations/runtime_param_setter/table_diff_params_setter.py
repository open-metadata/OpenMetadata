from ast import literal_eval
from typing import List, Optional
from urllib.parse import urlparse

from sqlalchemy.engine import Engine

from metadata.data_quality.validations.runtime_param_setter.param_setter import (
    RuntimeParameterSetter,
)
from metadata.data_quality.validations.table.sqlalchemy.models import (
    TableDiffRuntimeParameters,
)
from metadata.generated.schema.entity.data.table import Constraint, Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.source.connections import get_connection
from metadata.utils import fqn


class TableDiffParamsSetter(RuntimeParameterSetter):
    def get_parameters(self, test_case) -> TableDiffRuntimeParameters:
        service1: Engine = get_connection(self.service_connection_config)
        table2_fqn = self.get_parameter(test_case, "table2")
        table2: Table = self.ometa_client.get_by_name(
            Table, fqn=table2_fqn, nullable=False
        )
        service2 = self.get_service2_url(service1, table2, test_case)
        key_columns = self.get_key_columns(test_case)
        return TableDiffRuntimeParameters(
            service1Url=self.get_data_diff_url(
                str(service1.url), self.table_entity.fullyQualifiedName.root
            ),
            service2Url=self.get_data_diff_url(service2, table2_fqn),
            table1=self.get_data_diff_table_path(
                self.table_entity.fullyQualifiedName.root
            ),
            table2=self.get_data_diff_table_path(table2_fqn),
            keyColumns=key_columns,
            extraColumns=self.get_extra_columns(key_columns, test_case),
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
        where_clauses = [x for x in where_clauses if x is not None]
        where_clauses = [f"({q})" for q in where_clauses]
        if len(where_clauses) == 0:
            return None
        return " AND ".join(where_clauses)

    def get_service2_url(self, service1, table2, test_case):
        service2 = self.get_parameter(test_case, "service2Url")
        if service2 is not None:
            pass
        elif self.table_entity.service.id == table2.service.id:
            service2 = str(service1.url)
        else:
            table2_service = self.ometa_client.get_by_id(
                DatabaseService, table2.service.id
            )
            service2 = str(get_connection(table2_service.connection.config).url)
        return service2

    def get_extra_columns(
        self, key_columns: List[str], test_case
    ) -> Optional[List[str]]:
        extra_columns = self.get_parameter(test_case, "useColumns", None)
        if extra_columns is not None:
            return literal_eval(extra_columns)
        if extra_columns is None:
            extra_columns = []
            for column in self.table_entity.columns:
                if column.name.root not in key_columns:
                    extra_columns.insert(0, column.name.root)
        return extra_columns

    def get_key_columns(self, test_case) -> List[str]:
        key_columns = self.get_parameter(test_case, "keyColumns", "[]")
        key_columns = literal_eval(key_columns)
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
    def get_parameter(test_case: TestCase, key: str, default=None):
        return next(
            (p.value for p in test_case.parameterValues if p.name == key), default
        )

    @staticmethod
    def get_data_diff_url(service_url: str, table_fqn) -> str:
        url = urlparse(service_url)
        # remove the drivername from the url becuase table-diff doesn't support it
        kwargs = {"scheme": url.scheme.split("+")[0]}
        service, database, schema, table = fqn.split(  # pylint: disable=unused-variable
            table_fqn
        )
        # path needs to include the database AND schema in some of the connectors
        if kwargs["scheme"] in ["mssql"]:
            kwargs["path"] = f"/{database}/{schema}"
        return url._replace(**kwargs).geturl()

    @staticmethod
    def get_data_diff_table_path(table_fqn: str):
        service, database, schema, table = fqn.split(  # pylint: disable=unused-variable
            table_fqn
        )
        return fqn._build(  # pylint: disable=protected-access
            "___SERVICE___", "__DATABASE__", schema, table
        ).replace("___SERVICE___.__DATABASE__.", "")
