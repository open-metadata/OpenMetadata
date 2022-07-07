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
"""ml flow source module"""

import ast
import json
import traceback
from dataclasses import dataclass, field
from typing import Iterable, List, Optional

from mlflow.entities import RunData
from mlflow.entities.model_registry import ModelVersion
from mlflow.tracking import MlflowClient

from metadata.generated.schema.api.data.createMlModel import CreateMlModelRequest
from metadata.generated.schema.entity.data.mlmodel import (
    FeatureType,
    MlFeature,
    MlHyperParameter,
    MlStore,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.mlmodel.mlflowConnection import (
    MlflowConnection,
)
from metadata.generated.schema.entity.services.mlmodelService import MlModelService
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException, Source, SourceStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.connections import get_connection
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


@dataclass
class MlFlowStatus(SourceStatus):
    """
    ML Model specific Status
    """

    success: List[str] = field(default_factory=list)
    failures: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def scanned(self, record: str) -> None:
        """
        Log successful ML Model scans
        """
        self.success.append(record)
        logger.info("ML Model scanned: %s", record)

    def failed(self, model_name: str, reason: str) -> None:
        """
        Log failed ML Model scans
        """
        self.failures.append(model_name)
        logger.error("ML Model failed: %s - %s", model_name, reason)

    def warned(self, model_name: str, reason: str) -> None:
        """
        Log Ml Model with warnings
        """
        self.warnings.append(model_name)
        logger.warning("ML Model warning: %s - %s", model_name, reason)


class MlflowSource(Source[CreateMlModelRequest]):
    """
    Source implementation to ingest MLFlow data.

    We will iterate on the registered ML Models
    and prepare an iterator of CreateMlModelRequest
    """

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__()
        self.config = config
        self.service_connection = self.config.serviceConnection.__root__.config

        self.metadata = OpenMetadata(metadata_config)

        self.connection = get_connection(self.service_connection)
        self.test_connection()
        self.client = self.connection.client

        self.status = MlFlowStatus()
        self.service = self.metadata.get_service_or_create(
            entity=MlModelService, config=config
        )

    def prepare(self):
        pass

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: MlflowConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, MlflowConnection):
            raise InvalidSourceException(
                f"Expected MysqlConnection, but got {connection}"
            )

        return cls(config, metadata_config)

    def next_record(self) -> Iterable[CreateMlModelRequest]:
        """
        Fetch all registered models from MlFlow.

        We are setting the `algorithm` to a constant
        as there is not a non-trivial generic approach
        for retrieving the algorithm from the registry.
        """
        for model in self.client.list_registered_models():

            # Get the latest version
            latest_version: Optional[ModelVersion] = next(
                (
                    ver
                    for ver in model.latest_versions
                    if ver.last_updated_timestamp == model.last_updated_timestamp
                ),
                None,
            )
            if not latest_version:
                self.status.failed(model.name, reason="Invalid version")
                continue

            run = self.client.get_run(latest_version.run_id)

            self.status.scanned(model.name)

            yield CreateMlModelRequest(
                name=model.name,
                description=model.description,
                algorithm="mlflow",  # Setting this to a constant
                mlHyperParameters=self._get_hyper_params(run.data),
                mlFeatures=self._get_ml_features(
                    run.data, latest_version.run_id, model.name
                ),
                mlStore=self._get_ml_store(latest_version),
                service=EntityReference(id=self.service.id, type="mlmodelService"),
            )

    @staticmethod
    def _get_hyper_params(data: RunData) -> Optional[List[MlHyperParameter]]:
        """
        Get the hyper parameters from the parameters
        logged in the run data object.
        """
        if data.params:
            return [
                MlHyperParameter(name=param[0], value=param[1])
                for param in data.params.items()
            ]

        return None

    @staticmethod
    def _get_ml_store(version: ModelVersion) -> Optional[MlStore]:
        """
        Get the Ml Store from the model version object
        """
        if version.source:
            return MlStore(storage=version.source)
        return None

    def _get_ml_features(
        self, data: RunData, run_id: str, model_name: str
    ) -> Optional[List[MlFeature]]:
        """
        The RunData object comes with stringified `tags`.
        Let's transform those and try to extract the `signature`
        information
        """
        if data.tags:
            try:
                props = json.loads(data.tags["mlflow.log-model.history"])
                latest_props = next(
                    (prop for prop in props if prop["run_id"] == run_id), None
                )
                if not latest_props:
                    reason = f"Cannot find the run ID properties for {run_id}"
                    logger.warning(reason)
                    self.status.warned(model_name, reason)
                    return None

                if latest_props.get("signature") and latest_props["signature"].get(
                    "inputs"
                ):

                    features = ast.literal_eval(latest_props["signature"]["inputs"])

                    return [
                        MlFeature(
                            name=feature["name"],
                            dataType=FeatureType.categorical
                            if feature["type"] == "string"
                            else FeatureType.numerical,
                        )
                        for feature in features
                    ]

            # pylint: disable=broad-except)
            except Exception as exc:
                reason = f"Cannot extract properties from RunData {exc}"
                logger.warning(reason)
                logger.debug(traceback.format_exc())
                self.status.warned(model_name, reason)

        return None

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self) -> None:
        """
        Don't need to close the client
        """

    def test_connection(self) -> None:
        pass
