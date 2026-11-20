#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""The profiler must skip Informix's large objects, and profile everything else.

Skipping is not a quality choice. Informix rejects its large-object types in
COUNT(DISTINCT), MIN, MAX and GROUP BY outright, so a profiler that includes them
loses the whole column's metrics to a failed statement -- and on BYTE and TEXT
even a plain COUNT fails.

Both halves are asserted here. A profiler that skipped everything would pass a
test that only checked the large objects, and would be just as broken.
"""

from copy import deepcopy

import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.profiler import ProfilerWorkflow

SKIPPED_COLUMNS = ["c_text", "c_byte", "c_clob", "c_blob"]
PROFILED_COLUMNS = ["id", "c_char", "c_vchar", "c_lvchar", "c_bool"]


@pytest.fixture(scope="module")
def profiled_table(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    profiler_config,
    metadata,
    db_service,
) -> Table:
    search_cache.clear()
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(ProfilerWorkflow, profiler_config)

    fqn = f"{db_service.fullyQualifiedName.root}.itest.informix.lob_types"
    table = metadata.get_latest_table_profile(fqn)
    assert table is not None, f"no profile written for {fqn}"
    return table


def _profile_of(table: Table, column_name: str):
    column = next((col for col in table.columns if col.name.root == column_name), None)
    assert column is not None, f"{column_name} missing from the profiled table"
    return column.profile


class TestProfilerSkipsLargeObjects:
    @pytest.mark.parametrize("column_name", SKIPPED_COLUMNS)
    def test_large_object_columns_carry_no_metrics(self, profiled_table, column_name):
        assert _profile_of(profiled_table, column_name) is None

    @pytest.mark.parametrize("column_name", PROFILED_COLUMNS)
    def test_every_other_column_is_still_profiled(self, profiled_table, column_name):
        """The skip has to be narrow.

        Informix rejects the large objects specifically; if the whole table
        stopped being profiled the tests above would still pass.
        """
        assert _profile_of(profiled_table, column_name) is not None

    def test_the_table_itself_is_profiled(self, profiled_table):
        assert profiled_table.profile is not None
        assert profiled_table.profile.rowCount == 2


@pytest.fixture(scope="module")
def sampled_profiler_config(profiler_config):
    """Profile a percentage rather than the whole table.

    This is what builds the random-number CTE the profiler uses to draw a
    sample; without a profileSample the workflow reads the table directly and
    never emits the expression at all.
    """
    config = deepcopy(profiler_config)
    config["source"]["sourceConfig"]["config"]["profileSampleConfig"] = {
        "sampleConfigType": "STATIC",
        "config": {"profileSample": 50, "profileSampleType": "PERCENTAGE"},
    }
    config["source"]["sourceConfig"]["config"]["randomizedSample"] = True
    # Asking for these by name is what the UI's profiler agent does, and what
    # forces a metric that does not apply to a column to be sent as a bare NULL.
    config["source"]["sourceConfig"]["config"]["metrics"] = [
        "mean",
        "stddev",
        "sum",
        "min",
        "max",
        "nullCount",
        "valuesCount",
        "distinctCount",
    ]
    return config


@pytest.fixture(scope="module")
def sample_profiled_table(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    sampled_profiler_config,
    metadata,
    db_service,
) -> Table:
    search_cache.clear()
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(ProfilerWorkflow, sampled_profiler_config)

    fqn = f"{db_service.fullyQualifiedName.root}.itest.informix.lob_types"
    table = metadata.get_latest_table_profile(fqn)
    assert table is not None, f"no profile written for {fqn}"
    return table


class TestProfilerCanDrawASample:
    """Informix has no random number function.

    The default sampling expression compiles to ABS(RANDOM()) * 100, which
    Informix rejects with "674: Routine (random) can not be resolved". Every
    metric that samples dies with it, so a profile sample on Informix produced
    nothing at all until the dialect stopped calling a function that
    does not exist.
    """

    def test_a_percentage_sample_still_profiles_the_table(self, sample_profiled_table):
        assert sample_profiled_table.profile is not None

    @pytest.mark.parametrize("column_name", PROFILED_COLUMNS)
    def test_columns_are_profiled_under_a_sample(self, sample_profiled_table, column_name):
        assert _profile_of(sample_profiled_table, column_name) is not None


@pytest.fixture(scope="module")
def opaque_profiled_table(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    sampled_profiler_config,
    metadata,
    db_service,
) -> Table:
    """driver_types carries two opaque columns; the rest must still profile."""
    search_cache.clear()
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(ProfilerWorkflow, sampled_profiler_config)

    fqn = f"{db_service.fullyQualifiedName.root}.itest.informix.driver_types"
    table = metadata.get_latest_table_profile(fqn)
    assert table is not None, f"no profile written for {fqn}"
    return table


class TestProfilerSkipsUnaggregatableTypes:
    """An opaque column supports almost nothing the profiler asks for.

    Measured on 14.10.FC9W1DE against a column of a user-defined opaque type:
    COUNT(col) works, and COUNT(DISTINCT), MIN/MAX, LENGTH, GROUP BY and
    ORDER BY all fail -- "Type (html) is not hashable", or an unresolvable
    equal/compare/lessthanorequal routine. Casting to LVARCHAR rescues the
    aggregates but not GROUP BY, which Informix will not accept as an
    expression, so these columns cannot be profiled at all.
    """

    @pytest.mark.parametrize("column_name", ["d_opaque", "d_tagged"])
    def test_opaque_columns_carry_no_metrics(self, opaque_profiled_table, column_name):
        assert _profile_of(opaque_profiled_table, column_name) is None

    @pytest.mark.parametrize("column_name", ["id", "d_plain"])
    def test_every_other_column_is_still_profiled(self, opaque_profiled_table, column_name):
        """The skip has to be narrow, and the table has to survive it."""
        assert _profile_of(opaque_profiled_table, column_name) is not None

    def test_the_table_itself_is_profiled(self, opaque_profiled_table):
        assert opaque_profiled_table.profile is not None


class TestProfilerHandlesInapplicableMetrics:
    """A metric that does not apply to a column is asked for as a bare NULL.

    Informix rejects that in a SELECT list -- "201: A syntax error has occurred"
    -- and the statement carries every other metric for the column with it, so a
    single date column costs its table the whole profile.
    """

    def test_a_date_column_is_profiled(self, opaque_profiled_table):
        assert _profile_of(opaque_profiled_table, "d_date") is not None

    def test_the_table_still_profiles_around_it(self, opaque_profiled_table):
        assert _profile_of(opaque_profiled_table, "id") is not None

    def test_an_interval_column_is_profiled(self, opaque_profiled_table):
        """Catalogued as CHAR, it was sent LENGTH(), which is ambiguous on an INTERVAL."""
        assert _profile_of(opaque_profiled_table, "d_span").valuesCount == 1


@pytest.fixture(scope="module")
def view_profiled_table(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    profiler_config,
    metadata,
    db_service,
) -> Table:
    search_cache.clear()
    config = deepcopy(profiler_config)
    config["source"]["sourceConfig"]["config"]["includeViews"] = True
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(ProfilerWorkflow, config)

    fqn = f"{db_service.fullyQualifiedName.root}.itest.informix.lob_expr_view"
    table = metadata.get_latest_table_profile(fqn)
    assert table is not None, f"no profile written for {fqn}"
    return table


class TestMedianOverAViewExpression:
    """Ordering a window by LENGTH() of a view's expression column is error 768."""

    def test_median_is_computed(self, view_profiled_table):
        # 'alpha!' and 'beta!'
        assert _profile_of(view_profiled_table, "label").median == 5.5
