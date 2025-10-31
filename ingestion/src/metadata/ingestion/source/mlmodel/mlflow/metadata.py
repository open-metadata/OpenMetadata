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
from metadata.generated.schema.type.entityReference import EntityReference
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

        # Extract datasets from MLflow run
        (
            training_datasets,
            validation_datasets,
            test_datasets,
        ) = self._get_datasets_from_run(run, model.name)

        mlmodel_request = CreateMlModelRequest(
            name=EntityName(model.name),
            description=Markdown(model.description) if model.description else None,
            algorithm=self._get_algorithm(),  # Setting this to a constant
            mlHyperParameters=self._get_hyper_params(run.data),
            mlFeatures=self._get_ml_features(
                run.data, latest_version.run_id, model.name
            ),
            mlStore=self._get_ml_store(latest_version),
            trainingDatasets=training_datasets,
            validationDatasets=validation_datasets,
            testDatasets=test_datasets,
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

    def _find_entity_by_uri(
        self, uri: str, dataset_name: Optional[str] = None
    ) -> Optional[EntityReference]:
        """
        Search for a table or container entity in OpenMetadata that matches the dataset URI.
        Supports S3, GCS, file paths, and other storage URIs.
        Returns None if no entity is found, allowing ingestion to continue.
        """
        try:
            # Try to extract meaningful search terms from the URI
            search_terms = []

            # Handle different URI formats
            if uri and uri.startswith(("s3://", "gs://", "hdfs://", "file://")):
                # Extract path components
                path = uri.split("//", 1)[-1]
                # Get bucket/container name and file path
                parts = path.split("/")
                if parts:
                    search_terms.append(parts[0])  # bucket/container name
                    if len(parts) > 1:
                        search_terms.append(parts[-1])  # file name
            elif dataset_name:
                search_terms.append(dataset_name)

            # Try to find both table and container entities
            for entity_type in ["table", "container"]:
                # Try searching with URI-based terms
                for search_term in search_terms:
                    if not search_term:
                        continue

                    try:
                        # Search by sourceUrl, location, or FQN
                        search_query = f'(sourceUrl:"{search_term}*" OR location:"{search_term}*" OR {search_term})'
                        search_results = self.metadata.es_search_from_fqn(
                            entity_type=entity_type,
                            fqn_search_string=search_query,
                        )

                        if search_results and search_results[0]:
                            entity = search_results[0]
                            logger.info(
                                f"Found {entity_type} entity for URI {uri}: {entity.fullyQualifiedName.root}"
                            )
                            return EntityReference(
                                id=entity.id,
                                name=entity.name.root,
                                fullyQualifiedName=entity.fullyQualifiedName.root,
                                type=entity_type,
                            )
                    except Exception as search_err:
                        logger.debug(
                            f"Search failed for {entity_type} with term {search_term}: {search_err}"
                        )

                # If dataset_name provided, try exact name search
                if dataset_name:
                    try:
                        search_results = self.metadata.es_search_from_fqn(
                            entity_type=entity_type,
                            fqn_search_string=dataset_name,
                        )

                        if search_results and search_results[0]:
                            entity = search_results[0]
                            logger.info(
                                f"Found {entity_type} entity by name for {dataset_name}: {entity.fullyQualifiedName.root}"
                            )
                            return EntityReference(
                                id=entity.id,
                                name=entity.name.root,
                                fullyQualifiedName=entity.fullyQualifiedName.root,
                                type=entity_type,
                            )
                    except Exception as search_err:
                        logger.debug(
                            f"Search by name failed for {entity_type}: {search_err}"
                        )

        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.debug(f"Error finding entity for URI {uri}: {err}")

        logger.info(
            f"No table or container entity found in OpenMetadata for URI: {uri}"
        )
        return None

    def _get_datasets_from_run(
        self, run, model_name: str
    ) -> tuple[
        Optional[List[EntityReference]],
        Optional[List[EntityReference]],
        Optional[List[EntityReference]],
    ]:
        """
        Extract training, validation, and test datasets from an MLflow run.
        MLflow logs datasets using mlflow.log_input() with context labels.
        Returns tuple of (training_datasets, validation_datasets, test_datasets).
        Only includes datasets that exist as table entities in OpenMetadata.
        """
        try:
            training_datasets = []
            validation_datasets = []
            test_datasets = []

            # MLflow 2.0+ provides dataset tracking through inputs
            if hasattr(run, "inputs") and run.inputs:
                for dataset_input in run.inputs.dataset_inputs:
                    # Get the dataset name and context
                    dataset_name = (
                        dataset_input.dataset.name
                        if hasattr(dataset_input.dataset, "name")
                        else None
                    )
                    dataset_source = (
                        dataset_input.dataset.source
                        if hasattr(dataset_input.dataset, "source")
                        else None
                    )

                    # Context labels like "training", "validation", "test", "evaluation"
                    context_tags = (
                        dataset_input.tags if hasattr(dataset_input, "tags") else []
                    )

                    if not dataset_name and not dataset_source:
                        continue

                    # Search for existing table or container entity
                    dataset_ref = self._find_entity_by_uri(
                        dataset_source or dataset_name, dataset_name
                    )

                    if not dataset_ref:
                        logger.debug(
                            f"No table entity found in OpenMetadata for dataset: {dataset_name or dataset_source} (model: {model_name})"
                        )
                        continue

                    # Map based on context tags
                    context_str = " ".join(str(tag).lower() for tag in context_tags)

                    if "training" in context_str or "train" in context_str:
                        training_datasets.append(dataset_ref)
                    elif "validation" in context_str or "val" in context_str:
                        validation_datasets.append(dataset_ref)
                    elif (
                        "test" in context_str
                        or "evaluation" in context_str
                        or "eval" in context_str
                    ):
                        test_datasets.append(dataset_ref)
                    else:
                        # If no clear context, check dataset name
                        name_lower = (dataset_name or dataset_source or "").lower()
                        if "train" in name_lower:
                            training_datasets.append(dataset_ref)
                        elif "val" in name_lower:
                            validation_datasets.append(dataset_ref)
                        elif "test" in name_lower:
                            test_datasets.append(dataset_ref)
                        else:
                            # Default to training if ambiguous
                            logger.debug(
                                f"Ambiguous dataset context for {dataset_name or dataset_source} in model {model_name}, defaulting to training"
                            )
                            training_datasets.append(dataset_ref)

            # Also check run tags for dataset information (legacy approach)
            if run.data.tags:
                for tag_key, tag_value in run.data.tags.items():
                    if any(
                        keyword in tag_key.lower()
                        for keyword in ["dataset", "data_path", "data_uri"]
                    ):
                        context_lower = tag_key.lower()

                        # Search for the table or container entity
                        dataset_ref = self._find_entity_by_uri(tag_value)

                        if not dataset_ref:
                            logger.debug(
                                f"No table entity found for tag {tag_key}={tag_value} (model: {model_name})"
                            )
                            continue

                        if "train" in context_lower:
                            training_datasets.append(dataset_ref)
                        elif "val" in context_lower or "validation" in context_lower:
                            validation_datasets.append(dataset_ref)
                        elif "test" in context_lower:
                            test_datasets.append(dataset_ref)

            return (
                training_datasets if training_datasets else None,
                validation_datasets if validation_datasets else None,
                test_datasets if test_datasets else None,
            )

        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error extracting datasets from MLflow run for model {model_name}: {err}"
            )
            return None, None, None
