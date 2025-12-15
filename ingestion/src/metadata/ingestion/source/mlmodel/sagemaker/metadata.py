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
from metadata.generated.schema.type.entityReference import EntityReference
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
    training_job_name: Optional[str] = Field(
        None, description="Associated training job name", title="Training Job Name"
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

    def list_registered_models(self):
        """
        Returns a list of dicts, one per registered model (model package group)
        with metadata like name, arn, etc.
        """
        registered_models = []
        try:
            paginator = self.sagemaker.get_paginator("list_model_package_groups")
            for page in paginator.paginate():
                for summary in page.get("ModelPackageGroupSummaryList", []):
                    group_name = summary["ModelPackageGroupName"]

                    # Get full metadata for this registered model
                    desc = self.sagemaker.describe_model_package_group(
                        ModelPackageGroupName=group_name
                    )
                    registered_models.append(
                        {
                            "ModelName": desc["ModelPackageGroupName"],
                            "ModelArn": desc["ModelPackageGroupArn"],
                            "description": desc.get("ModelPackageGroupDescription"),
                            "CreationTime": desc.get("CreationTime"),
                        }
                    )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Failed to fetch unified studio registered models list - {err}"
            )
        return registered_models

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

        # get unified studio registered models
        registered_models = self.list_registered_models()
        if registered_models:
            logger.debug(
                f"Successfully found registered models under sagemaker unified studio"
            )
            models.extend(registered_models)
        else:
            logger.debug(f"No registered models found under sagemaker unified studio")

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
                # Try to find the associated training job
                training_job_name = self._find_training_job_for_model(
                    model["ModelName"]
                )

                yield SageMakerModel(
                    name=model["ModelName"],
                    arn=model["ModelArn"],
                    creation_timestamp=model["CreationTime"].isoformat(),
                    training_job_name=training_job_name,
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
            # Extract datasets from training job if available
            (
                training_datasets,
                validation_datasets,
                test_datasets,
            ) = self._get_datasets_from_training_job(
                model.training_job_name, model.name
            )

            mlmodel_request = CreateMlModelRequest(
                name=EntityName(model.name),
                algorithm=self._get_algorithm(),  # Setting this to a constant
                mlStore=self._get_ml_store(model.name),
                trainingDatasets=training_datasets,
                validationDatasets=validation_datasets,
                testDatasets=test_datasets,
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

    def _find_training_job_for_model(self, model_name: str) -> Optional[str]:
        """
        Find the training job associated with a model by searching for jobs
        that match the model name or were created around the same time.
        """
        try:
            # Try to find training jobs with similar names
            response = self.sagemaker.list_training_jobs(
                MaxResults=100,
                NameContains=model_name[:63],  # SageMaker name length limit
            )

            if response.get("TrainingJobSummaries"):
                # Return the most recent training job
                training_jobs = response["TrainingJobSummaries"]
                if training_jobs:
                    return training_jobs[0]["TrainingJobName"]
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.debug(f"Could not find training job for model {model_name}: {err}")

        return None

    def _find_entity_by_s3_uri(self, s3_uri: str) -> Optional[EntityReference]:
        """
        Search for a table or container entity in OpenMetadata that matches the S3 URI.
        Searches by sourceUrl or location fields that might contain the S3 path.
        Returns None if no entity is found, allowing ingestion to continue.
        """
        try:
            # Extract bucket and key from S3 URI
            # Format: s3://bucket-name/path/to/data
            if not s3_uri or not s3_uri.startswith("s3://"):
                logger.debug(f"Invalid S3 URI format: {s3_uri}")
                return None

            s3_path = s3_uri.replace("s3://", "")
            parts = s3_path.split("/")
            if not parts:
                logger.debug(f"Could not parse S3 URI: {s3_uri}")
                return None

            bucket_name = parts[0]

            # Try to find both table and container entities
            for entity_type in ["table", "container"]:
                # Search for entities with this S3 URI in their sourceUrl or location
                search_query = f'(sourceUrl:"{s3_uri}*" OR location:"{s3_uri}*")'

                try:
                    search_results = self.metadata.es_search_from_fqn(
                        entity_type=entity_type,
                        fqn_search_string=search_query,
                    )

                    if search_results and search_results[0]:
                        entity = search_results[0]
                        logger.info(
                            f"Found {entity_type} entity for S3 URI {s3_uri}: {entity.fullyQualifiedName.root}"
                        )
                        return EntityReference(
                            id=entity.id,
                            name=entity.name.root,
                            fullyQualifiedName=entity.fullyQualifiedName.root,
                            type=entity_type,
                        )
                except Exception as search_err:
                    logger.debug(
                        f"Search failed for {entity_type} with URI query: {search_err}"
                    )

                # If no exact match, try searching by bucket name in the FQN
                try:
                    search_results = self.metadata.es_search_from_fqn(
                        entity_type=entity_type,
                        fqn_search_string=bucket_name,
                    )

                    if search_results and search_results[0]:
                        entity = search_results[0]
                        logger.info(
                            f"Found {entity_type} entity by bucket name for S3 URI {s3_uri}: {entity.fullyQualifiedName.root}"
                        )
                        return EntityReference(
                            id=entity.id,
                            name=entity.name.root,
                            fullyQualifiedName=entity.fullyQualifiedName.root,
                            type=entity_type,
                        )
                except Exception as search_err:
                    logger.debug(
                        f"Search by bucket name failed for {entity_type}: {search_err}"
                    )

        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.debug(f"Error finding entity for S3 URI {s3_uri}: {err}")

        logger.info(
            f"No table or container entity found in OpenMetadata for S3 URI: {s3_uri}"
        )
        return None

    def _get_datasets_from_training_job(
        self, training_job_name: Optional[str], model_name: str
    ) -> tuple[
        Optional[List[EntityReference]],
        Optional[List[EntityReference]],
        Optional[List[EntityReference]],
    ]:
        """
        Extract training, validation, and test datasets from a SageMaker training job.
        Returns tuple of (training_datasets, validation_datasets, test_datasets).
        Only includes datasets that exist as table entities in OpenMetadata.
        """
        if not training_job_name:
            return None, None, None

        try:
            job_details = self.sagemaker.describe_training_job(
                TrainingJobName=training_job_name
            )

            training_datasets = []
            validation_datasets = []
            test_datasets = []

            input_data_config = job_details.get("InputDataConfig", [])

            for channel in input_data_config:
                channel_name = channel.get("ChannelName", "").lower()
                data_source = channel.get("DataSource", {})

                # Get S3 URI from the data source
                s3_data = data_source.get("S3DataSource", {})
                s3_uri = s3_data.get("S3Uri")

                if not s3_uri:
                    continue

                # Search for existing table or container entity with this S3 URI
                dataset_ref = self._find_entity_by_s3_uri(s3_uri)

                if not dataset_ref:
                    logger.debug(
                        f"No table entity found in OpenMetadata for S3 URI: {s3_uri} (channel: {channel_name}, model: {model_name})"
                    )
                    continue

                # Map channel names to dataset types
                if "train" in channel_name:
                    training_datasets.append(dataset_ref)
                elif "validation" in channel_name or "val" in channel_name:
                    validation_datasets.append(dataset_ref)
                elif "test" in channel_name:
                    test_datasets.append(dataset_ref)
                else:
                    # If channel name is ambiguous, default to training
                    logger.debug(
                        f"Ambiguous channel name '{channel_name}' for model {model_name}, defaulting to training dataset"
                    )
                    training_datasets.append(dataset_ref)

            return (
                training_datasets if training_datasets else None,
                validation_datasets if validation_datasets else None,
                test_datasets if test_datasets else None,
            )

        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error extracting datasets from training job {training_job_name} for model {model_name}: {err}"
            )
            return None, None, None
