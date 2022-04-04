import logging
from abc import abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional
from urllib.parse import quote_plus

from pydantic import SecretStr

from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.operations.pipelines.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.ingestion.api.source import SourceStatus

logger: logging.Logger = logging.getLogger(__name__)


@dataclass
class SQLSourceStatus(SourceStatus):
    """
    Reports the source status after ingestion
    """

    success: List[str] = field(default_factory=list)
    failures: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    filtered: List[str] = field(default_factory=list)

    def scanned(self, record: str) -> None:
        self.success.append(record)
        logger.info(f"Table Scanned: {record}")

    def filter(self, record: str, err: str) -> None:
        self.filtered.append(record)
        logger.warning(f"Filtered Table {record} due to {err}")


def wbuild_sql_source_connection_url(
    host_port: str,
    scheme: str,
    username: Optional[str] = None,
    password: Optional[SecretStr] = None,
    database: Optional[str] = None,
    options: Optional[dict] = None,
) -> str:
    """
    Helper function to prepare the db URL
    """

    url = f"{scheme}://"
    if username is not None:
        url += f"{username}"
        if password is not None:
            url += f":{quote_plus(password.get_secret_value())}"
        url += "@"
    url += f"{host_port}"
    if database:
        url += f"/{database}"

    if options is not None:
        if database is None:
            url += "/"
        params = "&".join(
            f"{key}={quote_plus(value)}" for (key, value) in options.items() if value
        )
        url = f"{url}?{params}"
    return url


class SQLConnectionConfig(DatabaseServiceMetadataPipeline):
    """
    Config class containing all supported
    configurations for an SQL source, including
    data profiling and DBT generated information.
    """

    service_name: str
    db_schema: Optional[str] = None
    options: dict = {}
    connect_args: dict = {}
    include_tables: Optional[bool] = True

    @abstractmethod
    def get_connection_url(self):
        return build_sql_source_connection_url(
            host_port=self.hostPort,
            scheme=self.scheme,
            username=self.username,
            password=self.password,
            database=self.database,
            options=self.options,
        )

    def get_service_type(self) -> DatabaseServiceType:
        return DatabaseServiceType[self.type]

    def get_service_name(self) -> str:
        return self.service_name
