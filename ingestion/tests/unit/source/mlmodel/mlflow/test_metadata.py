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

from unittest.mock import MagicMock

import pytest
from mlflow.entities.model_registry import ModelVersion, RegisteredModel
from mlflow.exceptions import MlflowException
from mlflow.store.entities import PagedList
from mlflow.utils.search_utils import SearchModelUtils

from metadata.ingestion.source.mlmodel.mlflow.metadata import MAX_VERSION_PAGES, MlflowSource

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
    assert kwargs["filter_string"] == f'name="{MODEL_NAME}"'


@pytest.mark.parametrize(
    "model_name",
    ["catalog.schema.o'brien_model", "catalog.schema.it's_a_model"],
)
def test_search_filter_survives_quotes_in_model_name(model_name):
    """A quote in the name must not corrupt the filter, or the model silently vanishes."""
    source = make_source(search_result=PagedList([make_version("2")], None), model_name=model_name)

    results = list(source.get_mlmodels())

    assert results[0][1].version == "2"
    filter_string = source.client.search_model_versions.call_args[1]["filter_string"]
    # The parser must recover the name byte-for-byte; the SQL-style '' escape
    # parses cleanly but hands back a doubled quote, matching nothing.
    parsed = SearchModelUtils.parse_search_filter(filter_string)
    assert parsed[0]["value"] == model_name


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
