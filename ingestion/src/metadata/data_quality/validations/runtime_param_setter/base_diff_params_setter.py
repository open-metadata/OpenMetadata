"""Base class for param setter logic for table data diff"""

from typing import List, Optional, Set, Type, Union
from urllib.parse import urlparse

from metadata.data_quality.validations.models import Column, TableParameter
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.connections import get_connection
from metadata.profiler.orm.registry import Dialects
from metadata.utils import fqn
from metadata.utils.collections import CaseInsensitiveList
from metadata.utils.importer import get_module_dir, import_from_module


# TODO: Refactor to avoid the circular import that makes us unable to use the BaseSpec class and the helper methods.
# Using the specs class method causes circular import as TestSuiteInterface
# imports RuntimeParameterSetter
class ServiceSpecPatch:
    def __init__(self, service_type: ServiceType, source_type: str):
        self.service_type = service_type
        self.source_type = source_type
        self._service_spec = None

    @property
    def service_spec(self):
        if self._service_spec is None:
            self._service_spec = self.get_for_source()
        return self._service_spec

    def get_for_source(self):
        return import_from_module(
            "metadata.{}.source.{}.{}.{}.ServiceSpec".format(  # pylint: disable=C0209
                "ingestion",
                self.service_type.name.lower(),
                get_module_dir(self.source_type),
                "service_spec",
            )
        )

    def get_data_diff_class(self) -> Type["BaseTableParameter"]:
        return import_from_module(self.service_spec.data_diff)

    def get_connection_class(self) -> Optional[Type[BaseConnection]]:
        if self.service_spec.connection_class:
            return import_from_module(self.service_spec.connection_class)
        return None


class BaseTableParameter:
    """Base table parameter setter for the table diff test."""

    def get(
        self,
        service: DatabaseService,
        entity: Table,
        key_columns,
        extra_columns,
        case_sensitive_columns,
        service_url: Optional[Union[str, dict]],
    ) -> TableParameter:
        """Getter table parameter for the table diff test.

        Returns:
            TableParameter
        """
        return TableParameter(
            database_service_type=service.serviceType,
            path=self.get_data_diff_table_path(entity.fullyQualifiedName.root),
            serviceUrl=self.get_data_diff_url(
                service,
                entity.fullyQualifiedName.root,
                override_url=service_url,
            ),
            columns=self.filter_relevant_columns(
                entity.columns,
                key_columns,
                extra_columns,
                case_sensitive=case_sensitive_columns,
            ),
            privateKey=None,
            passPhrase=None,
        )

    @staticmethod
    def get_data_diff_table_path(table_fqn: str) -> str:
        """Get the data diff table path.

        Args:
            table_fqn (str): The fully qualified name of the table

        Returns:
            str
        """
        _, _, schema, table = fqn.split(table_fqn)
        return fqn._build(  # pylint: disable=protected-access
            "___SERVICE___", "__DATABASE__", schema, table
        ).replace("___SERVICE___.__DATABASE__.", "")

    @staticmethod
    def _get_service_connection_config(
        db_service: DatabaseService,
    ) -> Optional[Union[str, dict]]:
        """
        Get the connection dictionary for the service.
        """
        service_connection_config = db_service.connection.config
        service_spec_patch = ServiceSpecPatch(
            ServiceType.Database, service_connection_config.type.value.lower()
        )

        try:
            connection_class = service_spec_patch.get_connection_class()
            if not connection_class:
                return (
                    str(get_connection(service_connection_config).url)
                    if service_connection_config
                    else None
                )
            connection = connection_class(service_connection_config)
            return connection.get_connection_dict()
        except (ValueError, AttributeError, NotImplementedError):
            return (
                str(get_connection(service_connection_config).url)
                if service_connection_config
                else None
            )

    @staticmethod
    def get_data_diff_url(
        db_service: DatabaseService,
        table_fqn,
        override_url: Optional[Union[str, dict]] = None,
    ) -> Union[str, dict]:
        """Get the url for the data diff service.

        Args:
            db_service (DatabaseService): The database service entity
            table_fqn (str): The fully qualified name of the table
            override_url (Optional[str], optional): Override the url. Defaults to None.

        Returns:
            str: The url for the data diff service
        """
        source_url = (
            BaseTableParameter._get_service_connection_config(db_service)
            if not override_url
            else override_url
        )
        if isinstance(source_url, dict):
            source_url["driver"] = source_url["driver"].split("+")[0]
            return source_url

        url = urlparse(source_url)
        # remove the driver name from the url because table-diff doesn't support it
        kwargs = {"scheme": url.scheme.split("+")[0]}
        service, database, schema, table = fqn.split(  # pylint: disable=unused-variable
            table_fqn
        )
        # path needs to include the database AND schema in some of the connectors
        if hasattr(db_service.connection.config, "supportsDatabase"):
            kwargs["path"] = f"/{database}"
        if kwargs["scheme"] in {Dialects.MSSQL, Dialects.Snowflake, Dialects.Trino}:
            kwargs["path"] = f"/{database}/{schema}"
        return url._replace(**kwargs).geturl()

    @staticmethod
    def filter_relevant_columns(
        columns: List[Column],
        key_columns: Set[str],
        extra_columns: Set[str],
        case_sensitive: bool,
    ) -> List[Column]:
        """Filter relevant columns.

        Args:
            columns (List[Column]): list of columns
            key_columns (Set[str]): set of key columns
            extra_columns (Set[str]): set of extra columns
            case_sensitive (bool): case sensitive flag

        Returns:
            List[Column]
        """
        validated_columns = (
            [*key_columns, *extra_columns]
            if case_sensitive
            else CaseInsensitiveList([*key_columns, *extra_columns])
        )
        return [c for c in columns if c.name.root in validated_columns]
