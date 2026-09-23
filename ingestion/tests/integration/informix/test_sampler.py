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
"""Sampling must survive the types the JDBC driver cannot convert.

A column of a user-defined opaque type does not fail alone: the driver rejects
the whole SELECT it appears in, so a table with one such column loses sample
data for every column, and auto-classification reports the table as an error.

Dropping such a column is the last resort. An opaque type with an output
function has a registered cast to LVARCHAR, and casting in the SELECT keeps the
data -- the driver only ever sees text. d_tagged has that cast and its value
must survive; d_opaque has none and is the only opaque column that may vanish.

The narrowness matters as much as the skip. driver_types also holds a distinct
type, whose name is user-defined exactly like the opaque ones but which the
driver resolves and returns; and ordinary columns either side of them. A fix
that dropped too much would pass the first test here and fail the rest.
"""

import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.workflow.classification import AutoClassificationWorkflow
from metadata.workflow.metadata import MetadataWorkflow

TABLE = "driver_types"

# What the driver can hand back, and what it cannot. Measured on 14.10.FC9W1DE.
# d_tagged is there through the cast; the rest of SAMPLED_COLUMNS need no help.
SAMPLED_COLUMNS = ["id", "d_tagged", "d_distinct", "d_plain", "d_row", "d_set"]
UNSAMPLED_COLUMNS = ["d_opaque", "d_dist_opq"]


@pytest.fixture(scope="module")
def sampled_table(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    classifier_config,
    metadata,
    db_service,
) -> Table:
    """Run the workflow the user runs, and fail the test if it reports errors.

    run_workflow raises from the workflow status, so an opaque column that still
    kills its table fails here rather than quietly producing no sample data.
    """
    search_cache.clear()
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(AutoClassificationWorkflow, classifier_config)

    fqn = f"{db_service.fullyQualifiedName.root}.itest.informix.{TABLE}"
    table = metadata.get_by_name(Table, fqn)
    assert table is not None, f"{fqn} was not ingested"
    return table


@pytest.fixture(scope="module")
def sample_columns(sampled_table, metadata) -> list[str]:
    sample_data = metadata.get_sample_data(sampled_table)
    assert sample_data is not None, f"{TABLE} produced no sample data at all"
    assert sample_data.sampleData is not None
    return [column.root for column in sample_data.sampleData.columns]


class TestSamplerSkipsUnconvertibleTypes:
    def test_the_table_is_sampled_at_all(self, sample_columns):
        """The regression this exists for.

        With d_opaque in the SELECT the driver fails the statement, and the whole
        table -- every column of it -- comes back with nothing.
        """
        assert sample_columns

    @pytest.mark.parametrize("column_name", UNSAMPLED_COLUMNS)
    def test_unconvertible_columns_are_left_out(self, sample_columns, column_name):
        assert column_name not in sample_columns

    @pytest.mark.parametrize("column_name", SAMPLED_COLUMNS)
    def test_every_other_column_is_still_sampled(self, sample_columns, column_name):
        """The skip has to be narrow.

        d_distinct is the one that catches an over-broad fix: it carries a
        user-defined type name just like d_opaque, but the driver returns it.
        """
        assert column_name in sample_columns

    def test_rows_carry_values_not_java_objects(self, sampled_table, metadata):
        """A row or collection column returns a Java object the sink cannot store.

        Asserting on the values, not just the column list, is what proves the
        rows survived the trip rather than arriving empty.
        """
        rows = metadata.get_sample_data(sampled_table).sampleData.rows
        assert rows, f"{TABLE} was sampled but returned no rows"
        assert all(isinstance(cell, (int, str, type(None))) for row in rows for cell in row), rows

    def test_a_row_column_arrives_as_its_sql_rendering(self, sampled_table, sample_columns, metadata):
        """Complex types cast even though syscasts has no row saying so.

        Dropping them on that basis lost the column; the cast keeps whatever the
        server renders -- ROW('Main St','Brussels') rather than a Java object.
        """
        rows = metadata.get_sample_data(sampled_table).sampleData.rows
        value = rows[0][sample_columns.index("d_row")]
        assert value is not None and value.startswith("ROW("), value

    def test_the_castable_opaque_column_keeps_its_data(self, sampled_table, sample_columns, metadata):
        """The point of the cast: the column is present *and* carries its value.

        tagged_probe_out returns 'recovered', so anything else here means the
        column survived the column list but not the round trip.
        """
        rows = metadata.get_sample_data(sampled_table).sampleData.rows
        values = [row[sample_columns.index("d_tagged")] for row in rows]
        assert values == ["recovered"], values

    def test_an_interval_arrives_as_its_text(self, sampled_table, sample_columns, metadata):
        """SQLAlchemy's emulated Interval would subtract an epoch from this string."""
        rows = metadata.get_sample_data(sampled_table).sampleData.rows
        assert rows[0][sample_columns.index("d_span")].strip() == "1:30"
