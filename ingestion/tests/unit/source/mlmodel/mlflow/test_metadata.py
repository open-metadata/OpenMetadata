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
"""Unit tests for the MLflow source version resolution."""

import json
import logging
from unittest.mock import MagicMock, patch

import pytest
from mlflow.entities import RunData, RunTag
from mlflow.entities.model_registry import ModelVersion, RegisteredModel
from mlflow.exceptions import MlflowException
from mlflow.store.entities import PagedList

from metadata.generated.schema.entity.data.mlmodel import FeatureType
from metadata.ingestion.source.mlmodel.mlflow.metadata import (
    LOG_MODEL_HISTORY_TAG,
    MAX_MODEL_PAGES,
    MAX_VERSION_PAGES,
    MlflowSource,
)

MODEL_NAME = "catalog.schema.wine_model"


def make_version(version: str | None, run_id: str | None = "run-id") -> ModelVersion:
    return ModelVersion(name=MODEL_NAME, version=version, creation_timestamp=1, run_id=run_id)


def make_source(search_result=None, latest_versions=None, model_name: str = MODEL_NAME) -> MlflowSource:
    """
    Build an MlflowSource with the MLflow client stubbed out.

    __init__ opens a real connection, so bypass it and wire only the pieces
    the version-resolution path touches.
    """
    source = MlflowSource.__new__(MlflowSource)
    source.client = MagicMock()
    source.status = MagicMock()
    source.source_config = MagicMock(mlModelFilterPattern=None)

    if isinstance(search_result, Exception):
        source.client.search_model_versions.side_effect = search_result
    else:
        source.client.search_model_versions.return_value = search_result

    model = RegisteredModel(name=model_name, latest_versions=latest_versions)
    source.client.search_registered_models.return_value = [model]
    return source


def test_falls_back_to_search_when_latest_versions_is_none():
    """Unity Catalog leaves latest_versions unset -- this used to raise TypeError."""
    source = make_source(search_result=PagedList([make_version("1"), make_version("3"), make_version("2")], None))

    results = list(source.get_mlmodels())

    assert len(results) == 1
    assert results[0][1].version == "3"
    source.status.failed.assert_not_called()


def test_prefers_latest_versions_without_searching():
    source = make_source(latest_versions=[make_version("7")])

    results = list(source.get_mlmodels())

    assert results[0][1].version == "7"
    source.client.search_model_versions.assert_not_called()


def test_empty_latest_versions_still_searches():
    """
    An empty list is not proof that no versions exist: stage-based backends
    return [] when every version sits outside the requested stages. Searching
    recovers those, where the old code recorded a spurious "Version not found".
    """
    source = make_source(latest_versions=[], search_result=PagedList([make_version("5")], None))

    results = list(source.get_mlmodels())

    assert results[0][1].version == "5"
    source.status.failed.assert_not_called()


def test_search_follows_pagination():
    source = make_source()
    source.client.search_model_versions.side_effect = [
        PagedList([make_version("1")], "token-1"),
        PagedList([make_version("9")], None),
    ]

    results = list(source.get_mlmodels())

    assert results[0][1].version == "9"
    assert source.client.search_model_versions.call_count == 2


def test_partial_pagination_failure_does_not_ingest_stale_version():
    """
    A failure on page 2 must not leave page 1's newest standing in as "latest" --
    that is the stale-version bug pagination exists to prevent.
    """
    source = make_source()
    source.client.search_model_versions.side_effect = [
        PagedList([make_version("1")], "token-1"),
        MlflowException("backend blew up mid-scan"),
    ]

    results = list(source.get_mlmodels())

    assert results == []
    source.status.failed.assert_called_once()


def test_exhausting_the_page_budget_does_not_ingest_stale_version():
    """Running out of page budget is also a partial read, so skip rather than guess."""
    source = make_source()
    # Never stops handing back a token, so the loop burns its full budget.
    source.client.search_model_versions.side_effect = lambda **_: PagedList([make_version("1")], "more")

    results = list(source.get_mlmodels())

    assert results == []
    assert source.client.search_model_versions.call_count == MAX_VERSION_PAGES
    source.status.failed.assert_called_once()


def test_search_never_passes_order_by():
    """Unity Catalog raises outright if order_by is supplied."""
    source = make_source(search_result=PagedList([make_version("1")], None))

    list(source.get_mlmodels())

    _, kwargs = source.client.search_model_versions.call_args
    assert "order_by" not in kwargs


@pytest.mark.parametrize(
    "model_name",
    ["catalog.schema.model", "engagement_dev.curated-ai-shared.instruments-similarity"],
)
def test_search_filter_uses_single_quotes(model_name):
    """
    Unity Catalog forwards this filter to the Databricks REST endpoint, which
    accepts only `name = 'model_name'` and rejects a double-quoted name with
    INVALID_PARAMETER_VALUE. MLflow's client-side parser is more permissive and
    would happily accept the double-quoted form, so it cannot vouch for this.
    """
    source = make_source(search_result=PagedList([make_version("2")], None), model_name=model_name)

    results = list(source.get_mlmodels())

    assert results[0][1].version == "2"
    assert source.client.search_model_versions.call_args[1]["filter_string"] == f"name='{model_name}'"


def test_search_failure_is_recorded_and_does_not_raise():
    source = make_source(search_result=MlflowException("unsupported"))

    results = list(source.get_mlmodels())

    assert results == []
    source.status.failed.assert_called_once()
    assert "Version not found" in source.status.failed.call_args[0][0].error


def test_no_versions_found_is_recorded():
    source = make_source(search_result=PagedList([], None))

    results = list(source.get_mlmodels())

    assert results == []
    source.status.failed.assert_called_once()


def test_version_without_run_id_is_recorded():
    source = make_source(search_result=PagedList([make_version("1", run_id=None)], None))

    results = list(source.get_mlmodels())

    assert results == []
    assert "Run ID not found" in source.status.failed.call_args[0][0].error


@pytest.mark.parametrize("bad_version", ["not-a-number", None])
def test_non_numeric_versions_are_skipped(bad_version):
    source = make_source(search_result=PagedList([make_version(bad_version), make_version("4")], None))

    results = list(source.get_mlmodels())

    assert results[0][1].version == "4"


# ---------------------------------------------------------------------------
# Feature extraction
#
# MLflow 3.x stopped writing the mlflow.log-model.history run tag, so the signature
# has to come from the model's MLmodel metadata file instead.
# ---------------------------------------------------------------------------

RUN_ID = "run-id"
SIGNATURE_COLUMNS = [
    {"type": "string", "name": "store_id", "required": True},
    {"type": "long", "name": "week_of_year", "required": True},
    {"type": "double", "name": "prior_sales", "required": True},
]


def make_run_data(tags: dict | None = None) -> RunData:
    return RunData(metrics=None, params=None, tags=[RunTag(k, v) for k, v in (tags or {}).items()])


def history_tag(run_id: str = RUN_ID, columns=SIGNATURE_COLUMNS) -> dict:
    """The MLflow 2.x run tag: a JSON list whose `signature.inputs` is itself JSON."""
    entry = {"run_id": run_id, "signature": {"inputs": json.dumps(columns)}}

    return {LOG_MODEL_HISTORY_TAG: json.dumps([entry])}


def make_feature_source(artifact_location: str | None = None) -> MlflowSource:
    """An MlflowSource wired with only what the signature lookup touches."""
    source = MlflowSource.__new__(MlflowSource)
    source.client = MagicMock()
    source.status = MagicMock()
    source.service_connection = MagicMock(trackingUri="databricks")
    source.client.get_logged_model.return_value = MagicMock(artifact_location=artifact_location)

    return source


def write_mlmodel(tmp_path, columns=SIGNATURE_COLUMNS, signature: bool = True) -> str:
    """Write an MLmodel file the way MLflow does, and return its path."""
    body = "flavors:\n  python_function: {}\n"
    if signature:
        body += f"signature:\n  inputs: '{json.dumps(columns)}'\n"
    path = tmp_path / "MLmodel"
    path.write_text(body, encoding="utf-8")

    return str(path)


def test_features_come_from_the_run_tag_when_present(tmp_path):
    """MLflow 2.x path: the tag is authoritative and no artifact call is made."""
    source = make_feature_source()

    with patch("metadata.ingestion.source.mlmodel.mlflow.metadata.download_artifacts") as download:
        features = source._get_ml_features(make_run_data(history_tag()), RUN_ID, MODEL_NAME, make_version("1"))

    assert [f.name.root for f in features] == ["store_id", "week_of_year", "prior_sales"]
    download.assert_not_called()


def test_features_read_from_mlmodel_when_the_tag_is_absent(tmp_path):
    """MLflow 3.x drops the tag; without the fallback this returned None."""
    source = make_feature_source(artifact_location="dbfs:/logged_models/m-1/artifacts")
    version = make_version("1")
    version._source = "models:/m-1"

    with patch(
        "metadata.ingestion.source.mlmodel.mlflow.metadata.download_artifacts",
        return_value=write_mlmodel(tmp_path),
    ):
        features = source._get_ml_features(make_run_data({"mlflow.user": "me"}), RUN_ID, MODEL_NAME, version)

    assert [f.name.root for f in features] == ["store_id", "week_of_year", "prior_sales"]
    assert [f.dataType for f in features] == [
        FeatureType.categorical,
        FeatureType.numerical,
        FeatureType.numerical,
    ]


def test_a_missing_tag_alone_is_not_reported_as_a_problem(tmp_path):
    """The tag is absent on every MLflow 3.x run -- that must not raise a warning."""
    source = make_feature_source(artifact_location="dbfs:/logged_models/m-1/artifacts")
    version = make_version("1")
    version._source = "models:/m-1"

    with patch(
        "metadata.ingestion.source.mlmodel.mlflow.metadata.download_artifacts",
        return_value=write_mlmodel(tmp_path),
    ):
        source._get_ml_features(make_run_data(), RUN_ID, MODEL_NAME, version)

    source.status.warning.assert_not_called()


def test_logged_model_uri_is_resolved_through_the_registry(tmp_path):
    """`models:/<id>` is not an artifact path; the LoggedModel supplies the real one."""
    source = make_feature_source(artifact_location="dbfs:/logged_models/m-abc/artifacts")
    version = make_version("1")
    version._source = "models:/m-abc"

    with patch(
        "metadata.ingestion.source.mlmodel.mlflow.metadata.download_artifacts",
        return_value=write_mlmodel(tmp_path),
    ) as download:
        source._get_ml_features(make_run_data(), RUN_ID, MODEL_NAME, version)

    source.client.get_logged_model.assert_called_once_with("m-abc")
    assert download.call_args.kwargs["artifact_uri"] == "dbfs:/logged_models/m-abc/artifacts/MLmodel"
    assert download.call_args.kwargs["tracking_uri"] == "databricks"


def test_direct_artifact_source_needs_no_registry_lookup(tmp_path):
    """MLflow 2.x sources already point at the artifact store."""
    source = make_feature_source()
    version = make_version("1")
    version._source = "s3://bucket/models/1"

    with patch(
        "metadata.ingestion.source.mlmodel.mlflow.metadata.download_artifacts",
        return_value=write_mlmodel(tmp_path),
    ) as download:
        source._get_ml_features(make_run_data(), RUN_ID, MODEL_NAME, version)

    source.client.get_logged_model.assert_not_called()
    assert download.call_args.kwargs["artifact_uri"] == "s3://bucket/models/1/MLmodel"


def test_tag_without_an_entry_for_this_run_falls_back_to_the_artifacts(tmp_path):
    """A tag that does not mention this run must not block the fallback."""
    source = make_feature_source(artifact_location="dbfs:/logged_models/m-1/artifacts")
    version = make_version("1")
    version._source = "models:/m-1"

    with patch(
        "metadata.ingestion.source.mlmodel.mlflow.metadata.download_artifacts",
        return_value=write_mlmodel(tmp_path),
    ):
        features = source._get_ml_features(
            make_run_data(history_tag(run_id="a-different-run")), RUN_ID, MODEL_NAME, version
        )

    assert [f.name.root for f in features] == ["store_id", "week_of_year", "prior_sales"]


def test_unnamed_columns_are_skipped(tmp_path):
    """Tensor signatures carry no column names and cannot become MlFeatures."""
    source = make_feature_source()
    version = make_version("1")
    version._source = "s3://bucket/models/1"
    columns = [{"type": "tensor"}, {"type": "string", "name": "store_id"}]

    with patch(
        "metadata.ingestion.source.mlmodel.mlflow.metadata.download_artifacts",
        return_value=write_mlmodel(tmp_path, columns=columns),
    ):
        features = source._get_ml_features(make_run_data(), RUN_ID, MODEL_NAME, version)

    assert [f.name.root for f in features] == ["store_id"]


def test_a_model_without_a_signature_yields_no_features(tmp_path):
    source = make_feature_source()
    version = make_version("1")
    version._source = "s3://bucket/models/1"

    with patch(
        "metadata.ingestion.source.mlmodel.mlflow.metadata.download_artifacts",
        return_value=write_mlmodel(tmp_path, signature=False),
    ):
        assert source._get_ml_features(make_run_data(), RUN_ID, MODEL_NAME, version) is None


def test_artifact_read_failure_is_recorded_and_does_not_raise():
    """A registry that will not hand over the MLmodel must not abort the model."""
    source = make_feature_source()
    version = make_version("1")
    version._source = "s3://bucket/models/1"

    with patch(
        "metadata.ingestion.source.mlmodel.mlflow.metadata.download_artifacts",
        side_effect=MlflowException("no access"),
    ):
        assert source._get_ml_features(make_run_data(), RUN_ID, MODEL_NAME, version) is None

    source.status.warning.assert_called_once()


def test_no_version_means_no_artifact_lookup():
    """yield_mlmodel always passes a version, but the parameter stays optional."""
    source = make_feature_source()

    with patch("metadata.ingestion.source.mlmodel.mlflow.metadata.download_artifacts") as download:
        assert source._get_ml_features(make_run_data(), RUN_ID, MODEL_NAME) is None

    download.assert_not_called()


# ---------------------------------------------------------------------------
# Registry visibility
#
# A registry that returns nothing produces the same 0-record, 100%-success run as a
# registry with nothing new, so the count has to be stated in the logs.
# ---------------------------------------------------------------------------


def named_model(name: str) -> RegisteredModel:
    return RegisteredModel(name=name, latest_versions=[make_version("1")])


def test_the_number_of_models_listed_is_logged(caplog):
    source = make_source(latest_versions=[make_version("1")])

    with caplog.at_level(logging.INFO):
        list(source.get_mlmodels())

    assert "Listed 1 registered model(s) from the MLflow registry over 1 page(s)" in caplog.text


def test_an_empty_registry_is_logged_as_a_warning(caplog):
    """The reporter's case: nothing listed, yet the run reported success."""
    source = make_source()
    source.client.search_registered_models.return_value = PagedList([], None)

    with caplog.at_level(logging.WARNING):
        assert list(source.get_mlmodels()) == []

    assert "returned no registered models" in caplog.text
    assert "registryUri" in caplog.text


def test_every_page_of_the_registry_is_ingested(caplog):
    """A single call returns one page; the models after it used to be dropped silently."""
    source = make_source(latest_versions=[make_version("1")])
    source.client.search_registered_models.side_effect = [
        PagedList([named_model("a"), named_model("b")], "token-1"),
        PagedList([named_model("c")], None),
    ]

    with caplog.at_level(logging.INFO):
        results = list(source.get_mlmodels())

    assert [model.name for model, _ in results] == ["a", "b", "c"]
    assert "Listed 3 registered model(s) from the MLflow registry over 2 page(s)" in caplog.text


def test_the_page_token_is_passed_back_to_the_registry():
    source = make_source(latest_versions=[make_version("1")])
    source.client.search_registered_models.side_effect = [
        PagedList([named_model("a")], "token-1"),
        PagedList([named_model("b")], None),
    ]

    list(source.get_mlmodels())

    tokens = [call.kwargs.get("page_token") for call in source.client.search_registered_models.call_args_list]
    assert tokens == [None, "token-1"]


def test_an_empty_page_carrying_a_token_is_followed(caplog):
    """
    The reporter's registry: page 1 came back as ``{"next_page_token": "..."}`` with no
    ``registered_models`` at all, which the SDK hands over as an empty page that still has
    a token. Stopping there reported a 100% successful run over zero models.
    """
    source = make_source(latest_versions=[make_version("1")])
    source.client.search_registered_models.side_effect = [
        PagedList([], "token-1"),
        PagedList([], "token-2"),
        PagedList([named_model("a"), named_model("b")], None),
    ]

    with caplog.at_level(logging.INFO):
        results = list(source.get_mlmodels())

    assert [model.name for model, _ in results] == ["a", "b"]
    assert "Listed 2 registered model(s) from the MLflow registry over 3 page(s)" in caplog.text
    assert "returned no registered models" not in caplog.text


def test_pagination_stops_at_the_page_budget(caplog):
    """A backend that always returns a token must not spin forever."""
    source = make_source(latest_versions=[make_version("1")])
    source.client.search_registered_models.return_value = PagedList([named_model("a")], "always-more")

    with caplog.at_level(logging.WARNING):
        results = list(source.get_mlmodels())

    assert len(results) == MAX_MODEL_PAGES
    assert source.client.search_registered_models.call_count == MAX_MODEL_PAGES
    assert f"after {MAX_MODEL_PAGES} pages" in caplog.text


def test_a_complete_listing_is_not_flagged(caplog):
    source = make_source(latest_versions=[make_version("1")])
    source.client.search_registered_models.return_value = PagedList([named_model("a")], None)

    with caplog.at_level(logging.WARNING):
        list(source.get_mlmodels())

    assert "pages with more still pending" not in caplog.text
    assert "returned no registered models" not in caplog.text


def test_a_malformed_history_tag_falls_back_to_the_artifacts(tmp_path):
    """A tag that is not valid JSON must not sink the model."""
    source = make_feature_source(artifact_location="dbfs:/logged_models/m-1/artifacts")
    version = make_version("1")
    version._source = "models:/m-1"

    with patch(
        "metadata.ingestion.source.mlmodel.mlflow.metadata.download_artifacts",
        return_value=write_mlmodel(tmp_path),
    ):
        features = source._get_ml_features(
            make_run_data({LOG_MODEL_HISTORY_TAG: "not-json-at-all"}), RUN_ID, MODEL_NAME, version
        )

    assert [f.name.root for f in features] == ["store_id", "week_of_year", "prior_sales"]


def test_a_python_repr_signature_is_still_parsed():
    """Older clients stored the signature as a Python repr rather than JSON."""
    source = make_feature_source()
    entry = {"run_id": RUN_ID, "signature": {"inputs": str(SIGNATURE_COLUMNS)}}

    features = source._get_ml_features(make_run_data({LOG_MODEL_HISTORY_TAG: json.dumps([entry])}), RUN_ID, MODEL_NAME)

    assert [f.name.root for f in features] == ["store_id", "week_of_year", "prior_sales"]


# ---------------------------------------------------------------------------
# Wiring
# ---------------------------------------------------------------------------


def test_models_outside_the_filter_pattern_are_reported_as_filtered():
    source = make_source(latest_versions=[make_version("1")])
    source.source_config = MagicMock(mlModelFilterPattern=MagicMock(includes=["^nothing-matches$"], excludes=None))

    assert list(source.get_mlmodels()) == []
    source.status.filter.assert_called_once_with(MODEL_NAME, "MlModel name pattern not allowed")


def test_yield_mlmodel_carries_the_signature_onto_the_request(tmp_path):
    """The end the whole fix serves: features reaching the CreateMlModelRequest."""
    source = make_feature_source(artifact_location="dbfs:/logged_models/m-1/artifacts")
    source.metadata = MagicMock()
    source.mlmodel_source_state = set()
    source.context = MagicMock()
    source.context.get.return_value = MagicMock(mlmodel_service="mlflow_svc")
    source.client.get_run.return_value = MagicMock(
        data=make_run_data({"mlflow.user": "me"}),
        info=MagicMock(artifact_uri="dbfs:/runs/1/artifacts"),
    )

    model = RegisteredModel(name=MODEL_NAME, latest_versions=None)
    version = make_version("2")
    version._source = "models:/m-1"

    with patch(
        "metadata.ingestion.source.mlmodel.mlflow.metadata.download_artifacts",
        return_value=write_mlmodel(tmp_path),
    ):
        results = list(source.yield_mlmodel((model, version)))

    request = results[0].right
    assert [f.name.root for f in request.mlFeatures] == ["store_id", "week_of_year", "prior_sales"]
    assert request.name.root == MODEL_NAME


# ---------------------------------------------------------------------------
# Review follow-ups
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "payload",
    [
        pytest.param(["store_id", "week_of_year"], id="list-of-strings"),
        pytest.param([{"type": "string"}, "loose-string"], id="mixed-entries"),
        pytest.param(42, id="not-iterable"),
        pytest.param({"name": "store_id"}, id="mapping-not-a-list"),
    ],
)
def test_a_malformed_signature_costs_the_features_not_the_model(payload):
    """
    Raising here would escape yield_mlmodel; the topology runner logs it and drops the
    entity without recording a failure, so the model would vanish from the run.
    """
    source = make_feature_source()
    entry = {"run_id": RUN_ID, "signature": {"inputs": json.dumps(payload)}}

    features = source._get_ml_features(make_run_data({LOG_MODEL_HISTORY_TAG: json.dumps([entry])}), RUN_ID, MODEL_NAME)

    assert features is None


def test_one_bad_column_does_not_discard_the_good_ones():
    source = make_feature_source()
    columns = ["not-a-column", {"type": "string", "name": "store_id"}]
    entry = {"run_id": RUN_ID, "signature": {"inputs": json.dumps(columns)}}

    features = source._get_ml_features(make_run_data({LOG_MODEL_HISTORY_TAG: json.dumps([entry])}), RUN_ID, MODEL_NAME)

    assert [f.name.root for f in features] == ["store_id"]


def test_an_invalid_feature_name_is_reported_as_a_warning():
    """A name pydantic rejects must degrade to no features, not lose the model."""
    source = make_feature_source()
    columns = [{"type": "string", "name": "x" * 1024}]
    entry = {"run_id": RUN_ID, "signature": {"inputs": json.dumps(columns)}}

    features = source._get_ml_features(make_run_data({LOG_MODEL_HISTORY_TAG: json.dumps([entry])}), RUN_ID, MODEL_NAME)

    assert features is None
    source.status.warning.assert_called_once()


def wire_deletion(source: MlflowSource) -> MlflowSource:
    """Attach what `mark_mlmodels_as_deleted` reads on top of a listing source."""
    source.metadata = MagicMock()
    source.context = MagicMock()
    source.context.get.return_value = MagicMock(mlmodel_service="mlflow_svc")
    source.mlmodel_source_state = set()
    source.source_config.markDeletedMlModels = True

    return source


def make_deletion_source(listing_complete: bool = True, listed_model_count: int = 1) -> MlflowSource:
    source = wire_deletion(make_source())
    source.listing_complete = listing_complete
    source.listed_model_count = listed_model_count

    return source


def test_a_truncated_listing_never_drives_deletions():
    """
    Every model past the page budget is absent from the source state, so reconciling
    deletions off a partial listing would soft-delete perfectly good entities.
    """
    source = make_deletion_source(listing_complete=False)

    with patch("metadata.ingestion.source.mlmodel.mlmodel_service.delete_entity_from_source") as delete:
        assert list(source.mark_mlmodels_as_deleted()) == []

    delete.assert_not_called()


def test_a_listing_that_saw_no_models_never_drives_deletions():
    """
    Credentials that cannot list models, or a `registryUri` pointing elsewhere, both look
    exactly like an empty registry. Reconciling against that empties the service.
    """
    source = make_deletion_source(listed_model_count=0)

    with patch("metadata.ingestion.source.mlmodel.mlmodel_service.delete_entity_from_source") as delete:
        assert list(source.mark_mlmodels_as_deleted()) == []

    delete.assert_not_called()


def test_a_complete_listing_still_reconciles_deletions():
    source = make_deletion_source()

    with patch(
        "metadata.ingestion.source.mlmodel.mlmodel_service.delete_entity_from_source",
        return_value=iter([]),
    ) as delete:
        list(source.mark_mlmodels_as_deleted())

    delete.assert_called_once()


def test_exhausting_the_page_budget_leaves_the_listing_incomplete():
    source = make_source(latest_versions=[make_version("1")])
    source.client.search_registered_models.return_value = PagedList([named_model("a")], "always-more")

    list(source.get_mlmodels())

    assert source.listing_complete is False
    source.status.warning.assert_called_once()


def test_a_listing_that_reaches_the_end_is_marked_complete():
    source = make_source(latest_versions=[make_version("1")])
    source.client.search_registered_models.return_value = PagedList([named_model("a")], None)

    list(source.get_mlmodels())

    assert source.listing_complete is True
    assert source.listed_model_count == 1


def test_abandoning_the_listing_part_way_never_drives_deletions():
    """
    Why completion is tracked positively rather than truncation negatively: a caller that
    walks away mid-listing has seen just as partial a registry as a truncated run, and the
    page budget was never reached to say so.
    """
    source = wire_deletion(make_source(latest_versions=[make_version("1")]))
    source.client.search_registered_models.side_effect = [
        PagedList([named_model("a")], "more"),
        PagedList([named_model("b")], None),
    ]

    next(source.get_mlmodels())
    assert source.listing_complete is False

    with patch("metadata.ingestion.source.mlmodel.mlmodel_service.delete_entity_from_source") as delete:
        assert list(source.mark_mlmodels_as_deleted()) == []

    delete.assert_not_called()


def test_a_fresh_listing_clears_a_stale_completion_flag():
    """A reused source must not inherit the previous run's verdict."""
    source = make_source(latest_versions=[make_version("1")])
    source.listing_complete = True
    source.listed_model_count = 7
    source.client.search_registered_models.return_value = PagedList([named_model("a")], "always-more")

    list(source.get_mlmodels())

    assert source.listing_complete is False
