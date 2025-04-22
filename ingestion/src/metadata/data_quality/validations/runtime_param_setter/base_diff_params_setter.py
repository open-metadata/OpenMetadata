"""Base class for param setter logic for table data diff"""

from typing import List, Optional, Set
from urllib.parse import urlparse

from metadata.data_quality.validations.models import Column, TableParameter
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.ingestion.source.connections import get_connection
from metadata.profiler.orm.registry import Dialects
from metadata.utils import fqn
from metadata.utils.collections import CaseInsensitiveList


class BaseTableParameter:
    """Base table parameter setter for the table diff test."""

    def get(
        self,
        service: DatabaseService,
        entity: Table,
        key_columns,
        extra_columns,
        case_sensitive_columns,
        service_url: Optional[str],
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
