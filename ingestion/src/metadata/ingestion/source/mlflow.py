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

import ast
import logging
from dataclasses import dataclass, field
from typing import Iterable, List, Optional

from mlflow.entities import RunData
from mlflow.entities.model_registry import ModelVersion
from mlflow.tracking import MlflowClient

from metadata.generated.schema.api.data.createMlModel import CreateMlModelEntityRequest
from metadata.generated.schema.entity.data.mlmodel import (
    FeatureType,
    MlFeature,
    MlHyperParameter,
    MlStore,
)
from metadata.ingestion.api.common import ConfigModel, WorkflowContext
from metadata.ingestion.api.source import Source, SourceStatus

logger: logging.Logger = logging.getLogger(__name__)


@dataclass
class MlFlowStatus(SourceStatus):
    """
    ML Model specific Status
    """

    success: List[str] = field(default_factory=list)
    failures: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def scanned(self, model_name: str) -> None:
        """
        Log successful ML Model scans
        """
        self.success.append(model_name)
        logger.info(f"ML Model scanned: {model_name}")

    def failed(self, model_name: str, reason: str) -> None:
        """
        Log failed ML Model scans
        """
        self.failures.append(model_name)
        logger.error(f"ML Model failed: {model_name} - {reason}")

    def warned(self, model_name: str, reason: str) -> None:
        """
        Log Ml Model with warnings
        """
        self.warnings.append(model_name)
        logger.warning(f"ML Model warning: {model_name} - {reason}")


class MlFlowConnectionConfig(ConfigModel):
    """
    Required information to extract data from MLFlow
    """

    tracking_uri: str
    registry_uri: Optional[str]


class MlflowSource(Source[CreateMlModelEntityRequest]):
    """
    Source implementation to ingest MLFlow data.

    We will iterate on the registered ML Models
    and prepare an iterator of CreateMlModelEntityRequest
    """

    def __init__(self, config: MlFlowConnectionConfig, ctx: WorkflowContext):
        super().__init__(ctx)
        self.client = MlflowClient(
            tracking_uri=config.tracking_uri,
            registry_uri=config.registry_uri if config.registry_uri else None,
        )
        self.status = MlFlowStatus()

    def prepare(self):
        pass

    @classmethod
    def create(
        cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext
    ):
        config = MlFlowConnectionConfig.parse_obj(config_dict)
        return cls(config, ctx)

    def next_record(self) -> Iterable[CreateMlModelEntityRequest]:
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

            yield CreateMlModelEntityRequest(
                name=model.name,
                description=model.description,
                algorithm="mlflow",  # Setting this to a constant
                mlHyperParameters=self._get_hyper_params(run.data),
                mlFeatures=self._get_ml_features(
                    run.data, latest_version.run_id, model.name
                ),
                mlStore=self._get_ml_store(latest_version),
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
                props = ast.literal_eval(data.tags["mlflow.log-model.history"])
                latest_props = next(
                    (prop for prop in props if prop["run_id"] == run_id), None
                )
                if not latest_props:
                    reason = f"Cannot find the run ID properties for {run_id}"
                    logging.warning(reason)
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

            except Exception as exc:
                reason = f"Cannot extract properties from RunData {exc}"
                logging.warning(reason)
                self.status.warned(model_name, reason)

        return None

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self) -> None:
        """
        Don't need to close the client
        """
        pass
