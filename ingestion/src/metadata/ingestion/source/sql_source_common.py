import logging
from abc import abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional
from urllib.parse import quote_plus

from pydantic import SecretStr

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.ingestion.api.common import IncludeFilterPattern
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
        logger.warning(f"Dropped Table {record} due to {err}")


def build_sql_source_connection_url(
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


class SQLConnectionConfig(ConfigModel):
    """
    Config class containing all supported
    configurations for an SQL source, including
    data profiling and DBT generated information.
    """

    username: Optional[str] = None
    password: Optional[SecretStr] = None
    host_port: str
    db_schema: Optional[str] = None
    database: Optional[str] = None
    scheme: str
    service_name: str
    service_type: str
    query: Optional[str] = "select * from {}.{} limit 50"
    options: dict = {}
    connect_args: dict = {}
    include_views: Optional[bool] = True
    include_tables: Optional[bool] = True
    generate_sample_data: Optional[bool] = True
    data_profiler_enabled: Optional[bool] = False
    data_profiler_date: Optional[str] = datetime.now().strftime("%Y-%m-%d")
    data_profiler_offset: Optional[int] = 0
    data_profiler_limit: Optional[int] = 50000
    table_filter_pattern: IncludeFilterPattern = IncludeFilterPattern.allow_all()
    schema_filter_pattern: IncludeFilterPattern = IncludeFilterPattern.allow_all()
    dbt_manifest_file: Optional[str] = None
    dbt_catalog_file: Optional[str] = None
    mark_deleted_tables_as_deleted: Optional[bool] = True

    @abstractmethod
    def get_connection_url(self):
        return build_sql_source_connection_url(
            host_port=self.host_port,
            scheme=self.scheme,
            username=self.username,
            password=self.password,
            database=self.database,
            options=self.options,
        )

    def get_service_type(self) -> DatabaseServiceType:
        return DatabaseServiceType[self.service_type]

    def get_service_name(self) -> str:
        return self.service_name
