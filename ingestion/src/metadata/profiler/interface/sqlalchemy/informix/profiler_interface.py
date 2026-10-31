#  Copyright 2026 OpenMetadata
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Profiler interface for Informix.

Informix rejects these types in most expressions, so the statement errors and
the column's metrics are lost rather than degraded. Measured on 14.10.FC9W1DE
and 15.0.1.0.3:

                      BYTE   TEXT   CLOB   BLOB   OPAQUE
    COUNT(col)         no     no    yes    yes    yes
    COUNT(DISTINCT)    no     no     no     no     no
    MIN / MAX          no     no     no     no     no
    LENGTH(col)       yes    yes     no     no     no
    GROUP BY           no     no     no     no     no
    ORDER BY           no     no     no     no     no

LENGTH would work on BYTE and TEXT, but showing size statistics for two of the
four large objects and nothing for the others reads as a bug rather than a rule.
Casting an opaque column to LVARCHAR rescues the aggregates -- the sampler does
that to keep the data -- but not GROUP BY, which Informix rejects as an
expression.
"""

from metadata.ingestion.ometa.utils import model_str
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.orm.registry import is_blob
from metadata.sampler.sqlalchemy.informix.sampler import InformixSampler
from metadata.utils.logger import profiler_interface_registry_logger

logger = profiler_interface_registry_logger()


class InformixProfilerInterface(SQAProfilerInterface):
    """
    Interface to interact with registry supporting sqlalchemy.
    """

    def _blob_column_names(self) -> set[str]:
        # From the entity, not the ORM table: building the ORM column maps the
        # type through a registry that drops precision, leaving a CLOB
        # undetermined and a BYTE indistinguishable from any other binary.
        return {model_str(column.name) for column in (self.table_entity.columns or []) if is_blob(column.dataType)}

    def _driver_unfriendly_column_names(self) -> set[str]:
        # Via the sampler, which has already asked the catalogue and cached it.
        # These cannot come from the entity: an opaque column is catalogued as
        # the VARCHAR the driver reported.
        sampler = getattr(self, "sampler", None)
        if not isinstance(sampler, InformixSampler):
            return set()
        try:
            return set(sampler.driver_unfriendly_columns())
        except Exception as exc:
            # The per-column backstop below still catches these.
            logger.warning("Could not read column types for %s: %s", model_str(self.table_entity.name), exc)
            return set()

    def get_columns(self):
        """Profile every column except the ones Informix refuses to aggregate."""
        skipped = self._blob_column_names() | self._driver_unfriendly_column_names()
        if not skipped:
            return super().get_columns()

        logger.info(
            "Skipping profiler metrics on %s for the columns Informix will not aggregate: %s",
            model_str(self.table_entity.name),
            ", ".join(sorted(skipped)),
        )
        return [column for column in super().get_columns() if column.name not in skipped]

    def _programming_error_static_metric(  # pyright: ignore[reportIncompatibleMethodOverride]
        self, runner, column, exc, _, __
    ):
        """Backstop for a type the skip above does not know: cost the column's
        metrics, not the whole table's."""
        logger.warning(
            "Skipping profiler metrics for %s.%s: Informix rejected the query (%s)",
            runner.table_name,
            column.name,
            exc,
        )
