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
"""Custom Database connector yielding a deterministic in-memory catalog."""

from collections.abc import Iterable

from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.storedProcedure import (
    Language,
    StoredProcedureCode,
)
from metadata.generated.schema.entity.data.table import Column, DataType, TableType
from metadata.generated.schema.entity.services.connections.database.customDatabaseConnection import (
    CustomDatabaseConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import Source as WorkflowSource
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.ometa_lineage import OMetaFQNLineageRequest
from metadata.ingestion.ometa.ometa_api import OpenMetadata

DEFAULT_DATABASE = "my_catalog"
CLASSIFICATION = "CustomConnectorTier"
TAG = "Gold"
TAG_FQN = f"{CLASSIFICATION}.{TAG}"

SCHEMAS: dict[str, tuple[str, dict[str, tuple[str, list[tuple[str, DataType, str]]]]]] = {
    "my_schema": (
        "Landing schema for operational tables",
        {
            "customers": (
                "One row per customer account",
                [
                    ("customer_id", DataType.BIGINT, "Surrogate key of the customer"),
                    ("email", DataType.VARCHAR, "Primary contact address"),
                    ("created_at", DataType.TIMESTAMP, "Account creation instant, UTC"),
                ],
            ),
            "orders": (
                "One row per placed order",
                [
                    ("order_id", DataType.BIGINT, "Surrogate key of the order"),
                    ("customer_id", DataType.BIGINT, "References customers.customer_id"),
                    ("total_amount", DataType.DECIMAL, "Order total in account currency"),
                ],
            ),
        },
    ),
    "my_other_schema": (
        "Curated schema for reporting aggregates",
        {
            "daily_revenue": (
                "Revenue aggregated per calendar day",
                [
                    ("day", DataType.DATE, "Calendar day of the aggregate"),
                    ("revenue", DataType.DECIMAL, "Summed order total for the day"),
                ],
            ),
        },
    ),
}

LINEAGE_FROM = "my_schema.orders"
LINEAGE_TO = "my_other_schema.daily_revenue"
STORED_PROCEDURE = "refresh_daily_revenue"


class CustomDatabaseSource(Source):
    """Yields a tagged catalog of databases, schemas, tables, a stored procedure and lineage."""

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection = config.serviceConnection.root.config
        options = self.service_connection.connectionOptions
        self.database_name = (options.root or {}).get("databaseName", DEFAULT_DATABASE) if options else DEFAULT_DATABASE

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: str | None = None,
    ) -> "CustomDatabaseSource":
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection = config.serviceConnection.root.config
        if not isinstance(connection, CustomDatabaseConnection):
            raise InvalidSourceException(f"Expected CustomDatabaseConnection, but got {connection}")
        return cls(config, metadata)

    def prepare(self):
        """Nothing to prepare"""

    def test_connection(self) -> None:
        """No external system to reach"""

    def close(self) -> None:
        """Nothing to close"""

    def _iter(self, *_, **__) -> Iterable[Either]:
        service_name = self.config.serviceName
        yield Either(
            right=CreateDatabaseServiceRequest(
                name=service_name,
                serviceType=DatabaseServiceType.CustomDatabase,
                connection=self.config.serviceConnection.root,
                displayName="Custom Database Demo",
                description="Catalog served by the custom database connector",
            )
        )
        yield Either(
            right=OMetaTagAndClassification(
                fqn=TAG_FQN,
                classification_request=CreateClassificationRequest(
                    name=CLASSIFICATION,
                    description="Tiering applied by the custom database connector",
                ),
                tag_request=CreateTagRequest(
                    classification=CLASSIFICATION,
                    name=TAG,
                    description="Curated, business-critical asset",
                ),
            )
        )
        yield Either(
            right=CreateDatabaseRequest(
                name=self.database_name,
                service=service_name,
                displayName=self.database_name.replace("_", " ").title(),
                description="Catalog produced by the custom database connector",
            )
        )
        database_fqn = f"{service_name}.{self.database_name}"
        tag_label = TagLabel(
            tagFQN=TAG_FQN,
            source=TagSource.Classification,
            labelType=LabelType.Automated,
            state=State.Confirmed,
        )
        for schema_name, (schema_description, tables) in SCHEMAS.items():
            yield Either(
                right=CreateDatabaseSchemaRequest(
                    name=schema_name,
                    database=database_fqn,
                    displayName=schema_name.replace("_", " ").title(),
                    description=schema_description,
                )
            )
            schema_fqn = f"{database_fqn}.{schema_name}"
            for table_name, (table_description, columns) in tables.items():
                yield Either(
                    right=CreateTableRequest(
                        name=table_name,
                        databaseSchema=schema_fqn,
                        displayName=table_name.replace("_", " ").title(),
                        description=table_description,
                        tableType=TableType.Regular,
                        tags=[tag_label],
                        columns=[
                            Column(
                                name=column_name,
                                dataType=data_type,
                                dataLength=64,
                                description=column_description,
                            )
                            for column_name, data_type, column_description in columns
                        ],
                    )
                )
        yield Either(
            right=CreateStoredProcedureRequest(
                name=STORED_PROCEDURE,
                databaseSchema=f"{database_fqn}.my_other_schema",
                displayName="Refresh Daily Revenue",
                description="Rebuilds the daily revenue aggregate",
                storedProcedureCode=StoredProcedureCode(
                    language=Language.SQL,
                    code=f"INSERT INTO {LINEAGE_TO} SELECT day, sum(total_amount) FROM {LINEAGE_FROM} GROUP BY day",
                ),
            )
        )
        # Lineage resolves both ends by FQN, so the buffered tables must be committed first.
        yield Either(right=Barrier(reason="tables must exist before lineage"))
        yield Either(
            right=OMetaFQNLineageRequest(
                from_entity_fqn=f"{database_fqn}.{LINEAGE_FROM}",
                from_entity_type="table",
                to_entity_fqn=f"{database_fqn}.{LINEAGE_TO}",
                to_entity_type="table",
            )
        )
