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
"""ml flow source module"""

import ast
import json
import traceback
from typing import Iterable, List, Optional, Tuple, cast

from mlflow.entities import RunData
from mlflow.entities.model_registry import ModelVersion, RegisteredModel
from pydantic import ValidationError

from metadata.generated.schema.api.data.createMlModel import CreateMlModelRequest
from metadata.generated.schema.entity.data.mlmodel import (
    FeatureType,
    MlFeature,
    MlHyperParameter,
    MlStore,
)
from metadata.generated.schema.entity.services.connections.mlmodel.mlflowConnection import (
    MlflowConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
    SourceUrl,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.mlmodel.mlmodel_service import MlModelServiceSource
from metadata.utils.filters import filter_by_mlmodel
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class MlflowSource(MlModelServiceSource):
    """
    Source implementation to ingest MLFlow data.

    We will iterate on the registered ML Models
    and prepare an iterator of CreateMlModelRequest
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: MlflowConnection = config.serviceConnection.root.config
        if not isinstance(connection, MlflowConnection):
            raise InvalidSourceException(
                f"Expected MlFlowConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_mlmodels(  # pylint: disable=arguments-differ
        self,
    ) -> Iterable[Tuple[RegisteredModel, ModelVersion]]:
        """
        List and filters models from the registry
        """
        for model in cast(RegisteredModel, self.client.search_registered_models()):
            if filter_by_mlmodel(
                self.source_config.mlModelFilterPattern, mlmodel_name=model.name
            ):
                self.status.filter(
                    model.name,
                    "MlModel name pattern not allowed",
                )
                continue

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
                self.status.failed(
                    StackTraceError(
                        name=model.name,
                        error="Version not found",
                        stackTrace=f"Unable to ingest model {model.name} due to missing version from version list {model.latest_versions}",  # pylint: disable=line-too-long
                    )
                )
                continue

            yield model, latest_version

    def _get_algorithm(self) -> str:  # pylint: disable=arguments-differ
        logger.info("Setting algorithm with default value `mlmodel` for Mlflow")
        return "mlmodel"

    def yield_mlmodel(  # pylint: disable=arguments-differ
        self, model_and_version: Tuple[RegisteredModel, ModelVersion]
    ) -> Iterable[Either[CreateMlModelRequest]]:
        """Prepare the Request model"""
        model, latest_version = model_and_version
        run = self.client.get_run(latest_version.run_id)

        source_url = (
            f"{clean_uri(self.service_connection.trackingUri)}/"
            f"#/models/{model.name}"
        )

        mlmodel_request = CreateMlModelRequest(
            name=EntityName(model.name),
            description=Markdown(model.description) if model.description else None,
            algorithm=self._get_algorithm(),  # Setting this to a constant
            mlHyperParameters=self._get_hyper_params(run.data),
            mlFeatures=self._get_ml_features(
                run.data, latest_version.run_id, model.name
            ),
            mlStore=self._get_ml_store(latest_version),
            service=FullyQualifiedEntityName(self.context.get().mlmodel_service),
            sourceUrl=SourceUrl(source_url),
        )
        yield Either(right=mlmodel_request)
        self.register_record(mlmodel_request=mlmodel_request)

    def _get_hyper_params(  # pylint: disable=arguments-differ
        self,
        data: RunData,
    ) -> Optional[List[MlHyperParameter]]:
        """
        Get the hyper parameters from the parameters
        logged in the run data object.
        """
        try:
            if data.params:
                return [
                    MlHyperParameter(name=param[0], value=param[1])
                    for param in data.params.items()
                ]
        except ValidationError as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Validation error adding hyper parameters from RunData: {data} - {err}"
            )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Wild error adding hyper parameters from RunData: {data} - {err}"
            )

        return None

    def _get_ml_store(  # pylint: disable=arguments-differ
        self,
        version: ModelVersion,
    ) -> Optional[MlStore]:
        """
        Get the Ml Store from the model version object
        """
        try:
            if version.source:
                return MlStore(storage=version.source)
        except ValidationError as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Validation error adding the MlModel store from ModelVersion: {version} - {err}"
            )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Wild error adding the MlModel store from ModelVersion: {version} - {err}"
            )
        return None

    def _get_ml_features(  # pylint: disable=arguments-differ
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
                    self.status.warning(model_name, reason)
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

            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                reason = f"Cannot extract properties from RunData: {exc}"
                logger.warning(reason)
                self.status.warning(model_name, reason)

        return None
