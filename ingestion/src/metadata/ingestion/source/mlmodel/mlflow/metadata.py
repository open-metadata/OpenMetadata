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

import ast  # noqa: I001
import json
import traceback
from collections.abc import Iterable

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

# Guards the version search pagination loop against a backend that keeps
# handing back a page token, which would otherwise spin forever.
MAX_VERSION_PAGES = 100


class MlflowSource(MlModelServiceSource):
    """
    Source implementation to ingest MLFlow data.

    We will iterate on the registered ML Models
    and prepare an iterator of CreateMlModelRequest
    """

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: str | None = None):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: MlflowConnection = config.serviceConnection.root.config
        if not isinstance(connection, MlflowConnection):
            raise InvalidSourceException(f"Expected MlFlowConnection, but got {connection}")
        return cls(config, metadata)

    def get_mlmodels(  # pylint: disable=arguments-differ
        self,
    ) -> Iterable[tuple[RegisteredModel, ModelVersion]]:
        """
        List and filters models from the registry
        """
        for model in self.client.search_registered_models():
            if filter_by_mlmodel(self.source_config.mlModelFilterPattern, mlmodel_name=model.name):
                self.status.filter(
                    model.name,
                    "MlModel name pattern not allowed",
                )
                continue

            latest_version = self._get_latest_version(model)
            if not latest_version:
                self.status.failed(
                    StackTraceError(
                        name=model.name,
                        error="Version not found",
                        stackTrace=f"Unable to ingest model {model.name}: no version could be resolved from "
                        "`latest_versions` nor from searching the model versions.",
                    )
                )
                continue

            # yield_mlmodel resolves the run from this ID, so an unset one would
            # only blow up later, mid-topology.
            if not latest_version.run_id:
                self.status.failed(
                    StackTraceError(
                        name=model.name,
                        error="Run ID not found",
                        stackTrace=f"Unable to ingest model {model.name}: version {latest_version.version} "
                        "has no associated run_id.",
                    )
                )
                continue

            yield model, latest_version

    def _get_latest_version(self, model: RegisteredModel) -> ModelVersion | None:
        """
        Resolve the newest version of a registered model.

        `latest_versions` is a stage-era field that registries without stages —
        Unity Catalog among them — leave unset, so fall back to searching the
        model's versions when it is missing.

        Empty is treated the same as unset on purpose: stage-based backends
        return [] when every version sits outside the requested stages, so an
        empty list is not evidence that the model has no versions.
        """
        return self._pick_newest(model.latest_versions or self._search_versions(model.name))

    def _search_versions(self, model_name: str) -> list[ModelVersion]:
        """
        List every version of a model, following pagination.

        Returns the complete list or nothing at all. A partial list is worse
        than none here: `_pick_newest` would resolve an arbitrary version as
        the latest, which is precisely what paginating is meant to prevent.

        Note the ordering is deliberately left to `_pick_newest`: Unity Catalog
        rejects `order_by` on this call outright.
        """
        versions: list[ModelVersion] = []
        page_token = None

        # Single quotes are mandatory. Unity Catalog does not parse this filter
        # locally -- it forwards the string to the Databricks REST endpoint, whose
        # parser accepts only `name = 'model_name'` and rejects a double-quoted
        # name with INVALID_PARAMETER_VALUE. MLflow's own client-side parser is
        # more permissive, so it cannot be used to validate this.
        filter_string = f"name='{model_name}'"

        try:
            for _ in range(MAX_VERSION_PAGES):
                page = self.client.search_model_versions(filter_string=filter_string, page_token=page_token)
                versions.extend(page)

                page_token = getattr(page, "token", None)
                if not page_token:
                    return versions

            logger.warning(
                f"Gave up paginating versions of {model_name} after {MAX_VERSION_PAGES} pages "
                "with more still pending; skipping the model rather than risking a stale version."
            )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error searching for versions of model {model_name} - {err}")

        return []

    @staticmethod
    def _pick_newest(versions: Iterable[ModelVersion]) -> ModelVersion | None:
        """Pick the highest-numbered version, ignoring any non-numeric ones."""
        numbered = []
        for version in versions:
            try:
                numbered.append((int(version.version), version))
            except (TypeError, ValueError):
                logger.warning(f"Skipping version with non-numeric identifier: {version.version}")

        return max(numbered, key=lambda pair: pair[0], default=(None, None))[1]

    def _get_algorithm(self) -> str:  # pylint: disable=arguments-differ
        logger.info("Setting algorithm with default value `mlmodel` for Mlflow")
        return "mlmodel"

    def yield_mlmodel(  # pylint: disable=arguments-differ
        self,
        model_and_version: tuple[RegisteredModel, ModelVersion],
    ) -> Iterable[Either[CreateMlModelRequest]]:
        """Prepare the Request model"""
        model, latest_version = model_and_version
        run = self.client.get_run(latest_version.run_id)

        source_url = f"{clean_uri(self.service_connection.trackingUri)}/#/models/{model.name}"

        mlmodel_request = CreateMlModelRequest(
            name=EntityName(model.name),
            description=Markdown(model.description) if model.description else None,
            algorithm=self._get_algorithm(),  # Setting this to a constant
            mlHyperParameters=self._get_hyper_params(run.data),
            mlFeatures=self._get_ml_features(run.data, latest_version.run_id, model.name),
            mlStore=self._get_ml_store(latest_version, run),
            service=FullyQualifiedEntityName(self.context.get().mlmodel_service),
            sourceUrl=SourceUrl(source_url),
        )
        yield Either(right=mlmodel_request)
        self.register_record(mlmodel_request=mlmodel_request)

    def _get_hyper_params(  # pylint: disable=arguments-differ
        self,
        data: RunData,
    ) -> list[MlHyperParameter] | None:
        """
        Get the hyper parameters from the parameters
        logged in the run data object.
        """
        try:
            if data.params:
                return [MlHyperParameter(name=param[0], value=param[1]) for param in data.params.items()]
        except ValidationError as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Validation error adding hyper parameters from RunData: {data} - {err}")
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Wild error adding hyper parameters from RunData: {data} - {err}")

        return None

    def _get_ml_store(  # pylint: disable=arguments-differ
        self,
        version: ModelVersion,
        run,
    ) -> MlStore | None:
        """
        Get the Ml Store from the model version object.
        Uses the artifact URI from the run for actual storage location.
        """
        try:
            storage = run.info.artifact_uri if run and run.info else version.source
            if storage:
                return MlStore(storage=storage)
        except ValidationError as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Validation error adding the MlModel store from ModelVersion: {version} - {err}")
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Wild error adding the MlModel store from ModelVersion: {version} - {err}")
        return None

    def _get_ml_features(  # pylint: disable=arguments-differ
        self, data: RunData, run_id: str, model_name: str
    ) -> list[MlFeature] | None:
        """
        The RunData object comes with stringified `tags`.
        Let's transform those and try to extract the `signature`
        information
        """
        if data.tags:
            try:
                props = json.loads(data.tags["mlflow.log-model.history"])
                latest_props = next((prop for prop in props if prop["run_id"] == run_id), None)
                if not latest_props:
                    reason = f"Cannot find the run ID properties for {run_id}"
                    logger.warning(reason)
                    self.status.warning(model_name, reason)
                    return None

                if latest_props.get("signature") and latest_props["signature"].get("inputs"):
                    features = ast.literal_eval(latest_props["signature"]["inputs"])

                    return [
                        MlFeature(
                            name=feature["name"],
                            dataType=FeatureType.categorical if feature["type"] == "string" else FeatureType.numerical,
                        )
                        for feature in features
                    ]

            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                reason = f"Cannot extract properties from RunData: {exc}"
                logger.warning(reason)
                self.status.warning(model_name, reason)

        return None
