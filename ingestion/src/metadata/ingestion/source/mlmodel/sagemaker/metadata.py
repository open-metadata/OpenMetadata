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
"""SageMaker source module"""

import traceback
from typing import Iterable, List, Optional

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from metadata.generated.schema.api.data.createMlModel import CreateMlModelRequest
from metadata.generated.schema.entity.data.mlmodel import (
    MlFeature,
    MlHyperParameter,
    MlStore,
)
from metadata.generated.schema.entity.services.connections.mlmodel.sageMakerConnection import (
    SageMakerConnection,
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
)
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagFQN,
    TagLabel,
    TagSource,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.mlmodel.mlmodel_service import MlModelServiceSource
from metadata.utils.filters import filter_by_mlmodel
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SageMakerModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )

    name: str = Field(..., description="Model name", title="Model Name")
    arn: str = Field(..., description="Model ARN in AWS account", title="Model ARN")
    creation_timestamp: str = Field(
        ...,
        description="Timestamp of model creation in ISO format",
        title="Creation Timestamp",
    )


class SagemakerSource(MlModelServiceSource):
    """
    Source implementation to ingest SageMaker data.

    We will iterate on the ML Models
    and prepare an iterator of CreateMlModelRequest
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.sagemaker = self.client

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: SageMakerConnection = config.serviceConnection.root.config
        if not isinstance(connection, SageMakerConnection):
            raise InvalidSourceException(
                f"Expected SageMakerConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_mlmodels(  # pylint: disable=arguments-differ
        self,
    ) -> Iterable[SageMakerModel]:
        """List and filters models"""
        args, has_more_models, models = {"MaxResults": 100}, True, []
        try:
            while has_more_models:
                response = self.sagemaker.list_models(**args)
                models.extend(response["Models"])
                has_more_models = response.get("NextToken")
                args["NextToken"] = response.get("NextToken")
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to fetch models list - {err}")

        for model in models:
            try:
                if filter_by_mlmodel(
                    self.source_config.mlModelFilterPattern,
                    mlmodel_name=model["ModelName"],
                ):
                    self.status.filter(
                        model["ModelName"],
                        "MlModel name pattern not allowed",
                    )
                    continue
                yield SageMakerModel(
                    name=model["ModelName"],
                    arn=model["ModelArn"],
                    creation_timestamp=model["CreationTime"].isoformat(),
                )
            except ValidationError as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Validation error while creating SageMakerModel from model details - {err}"
                )
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Wild error while creating SageMakerModel from model details - {err}"
                )
            continue

    def _get_algorithm(self) -> str:  # pylint: disable=arguments-differ
        logger.info(
            "Setting algorithm to default value of `mlmodel` for SageMaker Model"
        )
        return "mlmodel"

    def yield_mlmodel(  # pylint: disable=arguments-differ
        self, model: SageMakerModel
    ) -> Iterable[Either[CreateMlModelRequest]]:
        """
        Prepare the Request model
        """
        try:
            mlmodel_request = CreateMlModelRequest(
                name=EntityName(model.name),
                algorithm=self._get_algorithm(),  # Setting this to a constant
                mlStore=self._get_ml_store(model.name),
                service=FullyQualifiedEntityName(self.context.get().mlmodel_service),
            )
            yield Either(right=mlmodel_request)
            self.register_record(mlmodel_request=mlmodel_request)
        except Exception as exc:  # pylint: disable=broad-except
            yield Either(
                left=StackTraceError(
                    name=model.name,
                    error=f"Error creating mlmodel: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _get_ml_store(  # pylint: disable=arguments-differ
        self,
        model_name: str,
    ) -> Optional[MlStore]:
        """
        Get the Ml Store for the model
        """
        try:
            model_info = self.sagemaker.describe_model(ModelName=model_name)
            storage = model_info.get("PrimaryContainer", {}).get("ModelDataUrl")
            image_repository = model_info.get("PrimaryContainer", {}).get("Image")
            if image_repository or storage:
                return MlStore(storage=storage, imageRepository=image_repository)
        except ValidationError as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Validation error adding the MlModel store from model description: {model_name} - {err}"
            )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Wild error adding the MlModel store from model description: {model_name} - {err}"
            )
        return None

    def _get_tags(self, model_arn: str) -> Optional[List[TagLabel]]:
        try:
            tags = self.sagemaker.list_tags(ResourceArn=model_arn).get("Tags")
            if tags:
                return [
                    TagLabel(
                        tagFQN=TagFQN(tag["Key"]),
                        description=Markdown(tag["Value"]),
                        source=TagSource.Classification,
                        labelType=LabelType.Automated,
                        state=State.Confirmed,
                    )
                    for tag in tags
                ]
        except ValidationError as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Validation error adding TagLabel from model tags: {model_arn} - {err}"
            )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Wild error adding TagLabel from model tags: {model_arn} - {err}"
            )
        return None

    def _get_hyper_params(self, *args, **kwargs) -> Optional[List[MlHyperParameter]]:
        pass

    def _get_ml_features(self, *args, **kwargs) -> Optional[List[MlFeature]]:
        pass
