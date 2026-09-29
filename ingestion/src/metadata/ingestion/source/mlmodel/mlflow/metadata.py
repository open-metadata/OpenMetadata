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
import os
import tempfile
import traceback
from collections.abc import Iterable
from contextlib import contextmanager
from pathlib import Path

import yaml
from mlflow.artifacts import download_artifacts
from mlflow.entities import RunData
from mlflow.entities.model_registry import ModelVersion, RegisteredModel
from pydantic import ValidationError

from metadata.generated.schema.api.data.createMlModel import CreateMlModelRequest
from metadata.generated.schema.entity.data.mlmodel import FeatureType, MlFeature, MlHyperParameter, MlStore
from metadata.generated.schema.entity.services.connections.mlmodel.mlflowConnection import MlflowConnection
from metadata.generated.schema.entity.services.ingestionPipelines.status import StackTraceError
from metadata.generated.schema.metadataIngestion.workflow import Source as WorkflowSource
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName, Markdown, SourceUrl
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.delete_entity import DeleteEntity
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.mlmodel.mlmodel_service import MlModelServiceSource
from metadata.utils.filters import filter_by_mlmodel
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Guards the version search pagination loop against a backend that keeps
# handing back a page token, which would otherwise spin forever.
MAX_VERSION_PAGES = 100
# Same guard for the registry listing: a backend that keeps handing back a page token
# would otherwise spin forever.
MAX_MODEL_PAGES = 100

# MLflow 2.x published a model's signature in this run tag. MLflow 3.x dropped it in
# favour of LoggedModel entities, so the signature now has to be read from the MLmodel
# metadata file that ships alongside the model artifacts.
LOG_MODEL_HISTORY_TAG = "mlflow.log-model.history"
MLMODEL_METADATA_FILE = "MLmodel"
LOGGED_MODEL_URI_PREFIX = "models:/"
SIGNATURE_STRING_TYPE = "string"
# Status key for conditions that concern the registry as a whole rather than one model.
REGISTRY_STATUS_KEY = "MLflow registry"
# MLflow renders a tqdm progress bar on every artifact fetch, which lands in the
# middle of the ingestion logs. The signature file is a few hundred bytes, so the
# bar carries no information worth the noise.
ARTIFACT_PROGRESS_BAR_ENV = "MLFLOW_ENABLE_ARTIFACTS_PROGRESS_BAR"


@contextmanager
def suppress_artifact_progress_bar():
    """Keep MLflow's artifact progress bar out of the ingestion logs."""
    previous = os.environ.get(ARTIFACT_PROGRESS_BAR_ENV)
    os.environ[ARTIFACT_PROGRESS_BAR_ENV] = "false"
    try:
        yield
    finally:
        if previous is None:
            os.environ.pop(ARTIFACT_PROGRESS_BAR_ENV, None)
        else:
            os.environ[ARTIFACT_PROGRESS_BAR_ENV] = previous


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
        for model in self._iter_registered_models():
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

    # What the last listing managed to see, for the deletion pass to consult. Both are
    # recorded positively -- a listing that is truncated, abandoned mid-walk or never
    # started leaves them at these defaults, so the unsafe cases fail closed.
    listing_complete: bool = False
    listed_model_count: int = 0

    def _iter_registered_models(self) -> Iterable[RegisteredModel]:
        """
        Walk every page of the registry listing.

        `search_registered_models` answers with one bounded page, so calling it once caps
        ingestion at the page size and drops the rest without a word. Pages are streamed
        rather than collected so ingestion starts on the first one.
        """
        self.listing_complete = False
        self.listed_model_count = 0

        page_token = None
        total = 0
        pages = 0

        while pages < MAX_MODEL_PAGES:
            page = self.client.search_registered_models(page_token=page_token)
            total += len(page)
            self.listed_model_count = total
            pages += 1
            yield from page

            page_token = getattr(page, "token", None)
            if not page_token:
                self.listing_complete = True
                break

        if page_token:
            reason = (
                f"Stopped listing registered models after {MAX_MODEL_PAGES} pages with more still "
                f"pending; only {total} model(s) were listed. Narrow the run with "
                "`mlModelFilterPattern`."
            )
            logger.warning(reason)
            self.status.warning(REGISTRY_STATUS_KEY, reason)

        self._log_model_total(total, pages)

    @staticmethod
    def _log_model_total(total: int, pages: int) -> None:
        """
        State how many models the registry handed over, before any filtering.

        Without this an empty registry is indistinguishable from a registry with nothing
        new to ingest: both yield zero records and a 100% successful run, which reads as
        "working" when in fact the credentials cannot see a single model.
        """
        logger.info(f"Listed {total} registered model(s) from the MLflow registry over {pages} page(s)")

        if total == 0:
            logger.warning(
                "The MLflow registry returned no registered models, so there is nothing to ingest. "
                "If models are expected, check that `registryUri` points at the registry holding them, "
                "and that the credentials in use may list models -- a registry filters the listing by "
                "the caller's permissions and returns an empty list rather than an error."
            )

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

    def mark_mlmodels_as_deleted(self) -> Iterable[Either[DeleteEntity]]:
        """
        Reconcile deletions only off a listing that saw the whole registry.

        The base implementation deletes every model in OpenMetadata that this run did not
        yield, which is only sound when the absence of a model means the registry no longer
        has it. A listing that stopped early or came back empty cannot support that
        reading, and acting on it soft-deletes healthy entities.
        """
        if not self.listing_complete:
            logger.warning(
                "Skipping deleted-model reconciliation: the registry listing did not complete, so "
                "models it never reached would be wrongly marked as deleted."
            )
            return

        if not self.listed_model_count:
            logger.warning(
                "Skipping deleted-model reconciliation: the registry listed no models at all. "
                "Reading that as `every model was deleted` would soft-delete every model under "
                "this service, when the likelier cause is a `registryUri` pointing at a registry "
                "that holds none of them, or credentials that may not list models."
            )
            return

        yield from super().mark_mlmodels_as_deleted()

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
            mlFeatures=self._get_ml_features(run.data, latest_version.run_id, model.name, latest_version),
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
        self,
        data: RunData,
        run_id: str,
        model_name: str,
        version: ModelVersion | None = None,
    ) -> list[MlFeature] | None:
        """
        Resolve the model's input signature into ML features.

        The run tag is tried first since it needs no extra call, and the model artifacts
        only afterwards: MLflow 3.x no longer writes the tag, so on those servers the
        signature is only available from the MLmodel metadata file.
        """
        columns = self._signature_columns_from_run_tags(data, run_id)
        if columns is None and version is not None:
            columns = self._signature_columns_from_artifacts(version, model_name)

        # A signature this cannot be built from must cost the features, not the model.
        # Raising here would escape yield_mlmodel into the topology runner, which logs
        # and drops the entity without recording a failure -- the model would vanish
        # from the run with nothing to show why.
        try:
            return self._build_ml_features(columns)
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            reason = f"Cannot build ML features for {model_name} from its signature - {exc}"
            logger.warning(reason)
            self.status.warning(model_name, reason)
            return None

    def _signature_columns_from_run_tags(self, data: RunData, run_id: str) -> list[dict] | None:
        """
        Read the signature off the MLflow 2.x `mlflow.log-model.history` run tag.

        A missing tag or a tag with no entry for this run is not an error: it is the norm
        on MLflow 3.x. Both cases return None so the caller can fall back to the artifacts.
        """
        history = (data.tags or {}).get(LOG_MODEL_HISTORY_TAG)
        if not history:
            logger.debug(f"Run {run_id} has no {LOG_MODEL_HISTORY_TAG} tag, as expected on MLflow 3.x")
            return None

        columns = None
        try:
            entry = next(
                (prop for prop in self._parse_signature_payload(history) if prop.get("run_id") == run_id), None
            )
            if entry is None:
                logger.debug(f"No {LOG_MODEL_HISTORY_TAG} entry matches run {run_id}")
            else:
                inputs = (entry.get("signature") or {}).get("inputs")
                columns = self._parse_signature_payload(inputs) if inputs else None
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.debug(f"Could not read the signature from the {LOG_MODEL_HISTORY_TAG} tag of run {run_id} - {exc}")

        return columns

    def _signature_columns_from_artifacts(self, version: ModelVersion, model_name: str) -> list[dict] | None:
        """
        Read the signature from the model's MLmodel metadata file.

        `mlflow.models.get_model_info` is deliberately not used: it resolves `models:/`
        URIs through MLflow's global tracking config, which this connector never sets, and
        it imports pandas, which `mlflow-skinny` does not ship. Fetching the single
        metadata file keeps the lookup on the configured client and free of both.
        """
        columns = None
        try:
            location = self._resolve_artifact_location(version)
            if location:
                columns = self._read_signature_columns(location)
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            reason = f"Cannot read the model signature of {model_name} from its artifacts - {exc}"
            logger.warning(reason)
            self.status.warning(model_name, reason)

        return columns

    def _read_signature_columns(self, artifact_location: str) -> list[dict] | None:
        """
        Fetch only the MLmodel file from the artifact store and pull out the inputs.

        No metadata API exposes the signature -- not the MLflow logged-model endpoint
        nor the Unity Catalog model-version ones -- so it can only be read from the
        model's own metadata file. Only that one file is fetched, never the weights.

        `mlflow.artifacts.load_text` would be tidier but takes no `tracking_uri`, so it
        would resolve against MLflow's global config instead of this connector's client.
        """
        artifact_uri = f"{artifact_location}/{MLMODEL_METADATA_FILE}"
        logger.debug(f"Reading the model signature from {artifact_uri}")

        with tempfile.TemporaryDirectory() as tmp_dir, suppress_artifact_progress_bar():
            local_path = download_artifacts(
                artifact_uri=artifact_uri,
                dst_path=tmp_dir,
                tracking_uri=self.service_connection.trackingUri,
            )
            metadata = yaml.safe_load(Path(local_path).read_text(encoding="utf-8")) or {}

        inputs = (metadata.get("signature") or {}).get("inputs")

        return self._parse_signature_payload(inputs) if inputs else None

    def _resolve_artifact_location(self, version: ModelVersion) -> str | None:
        """
        Find where a version's artifacts live.

        MLflow 3.x points `source` at a `models:/<model_id>` URI that only the registry can
        resolve, so the LoggedModel has to be fetched to get a real location. Older
        versions already carry a direct artifact URI.
        """
        source = version.source
        if source and source.startswith(LOGGED_MODEL_URI_PREFIX):
            model_id = source[len(LOGGED_MODEL_URI_PREFIX) :]
            return self.client.get_logged_model(model_id).artifact_location

        return source

    @staticmethod
    def _parse_signature_payload(raw: str) -> list[dict]:
        """Signatures are JSON, but runs written by older clients hold a Python repr."""
        try:
            return json.loads(raw)
        except (TypeError, ValueError):
            return ast.literal_eval(raw)

    @staticmethod
    def _build_ml_features(columns: list[dict] | None) -> list[MlFeature] | None:
        """
        Map signature columns onto ML features.

        Unnamed columns are skipped: tensor-based signatures have no column names and
        cannot be represented as an MlFeature. So is anything that is not a column
        mapping at all, so one malformed entry does not cost the whole signature.
        """
        features = [
            MlFeature(
                name=column["name"],
                dataType=(
                    FeatureType.categorical if column.get("type") == SIGNATURE_STRING_TYPE else FeatureType.numerical
                ),
            )
            for column in columns or []
            if isinstance(column, dict) and column.get("name")
        ]

        return features or None
