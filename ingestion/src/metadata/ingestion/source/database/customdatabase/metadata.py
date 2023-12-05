from typing import Iterable

from metadata.generated.schema.entity.services.connections.database.customDatabaseConnection import (
    CustomDatabaseConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.sasConnection import (
    SASConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SASDB(Source):
    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__()
        self.config = config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.service_connection = self.config.serviceConnection.__root__.config

        self.sas_connection = SASConnection(
            username=self.service_connection.connectionOptions.__root__.get("username"),
            password=self.service_connection.connectionOptions.__root__.get("password"),
            serverHost=self.service_connection.connectionOptions.__root__.get(
                "serverHost"
            ),
        )

        self.sas_client = get_connection(self.sas_connection)
        logger.info("initing...")
        # self.test_connection()

    @classmethod
    def create(
        cls, config_dict: dict, metadata_config: OpenMetadataConnection
    ) -> "Source":
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: CustomDatabaseConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, CustomDatabaseConnection):
            raise InvalidSourceException(
                f"Expected CustomDatabaseConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[Entity]:
        pass

    def test_connection(self) -> None:
        test_connection_fn = get_connection(self.service_connection)
        test_connection_fn(
            self.metadata, self.sas_client, self.service_connection
        )

    def close(self):
        pass
