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
"""Module that defines the EvaluationScopeParamsSetter class."""

from metadata.data_quality.validations.models import EvaluationScopeRuntimeParameters
from metadata.data_quality.validations.runtime_param_setter.param_setter import (
    RuntimeParameterSetter,
)
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class EvaluationScopeParamsSetter(RuntimeParameterSetter):
    """Resolve what a test case is actually measured against.

    Unlike the other setters this one runs for every test case: the scope is not a parameter
    of one test definition but a property of the run, and a result message that does not say
    which rows it read cannot be read correctly.

    Everything is resolved from the sampler that the test suite interface is about to use, so
    the scope reported is the one the metrics were computed on.
    """

    def get_parameters(self, test_case) -> EvaluationScopeRuntimeParameters:
        sample_config = self._resolve_sample_config()
        partition_details = getattr(self.sampler, "partition_details", None)

        return EvaluationScopeRuntimeParameters(
            profile_sample=sample_config.profileSample if sample_config else None,
            profile_sample_type=sample_config.profileSampleType if sample_config else None,
            sampling_applied=self._sampling_applied(),
            partition_details=partition_details,
            partition_predicate=self._compile_partition_predicate(partition_details),
            sample_query=getattr(self.sampler, "sample_query", None),
        )

    def _resolve_sample_config(self):
        """Read the sample the sampler resolved, static or dynamic.

        A DYNAMIC configuration only becomes a percentage once the row count is known, and the
        sampler computes and caches that itself, so ask it rather than re-deriving it here.
        """
        try:
            return self.sampler._resolve_sample_config
        except Exception as exc:
            logger.debug(
                "Could not resolve the sample configuration for %s: %s", self.table_entity.fullyQualifiedName, exc
            )
            return None

    def _sampling_applied(self) -> bool:
        """Whether the sampler actually reads a subset, not just whether one is configured.

        A configured amount is not enough to tell: a 100% percentage that is not randomized
        resolves to the asset itself, and reporting that verdict as a sample's would invite
        sampling caveats on a run that read every row. Only the sampler knows, so ask it.
        """
        try:
            return bool(self.sampler.applies_sampling)
        except Exception as exc:
            logger.debug(
                "Could not tell whether %s was sampled: %s. Reporting the full table.",
                self.table_entity.fullyQualifiedName,
                exc,
            )
            return False

    def _compile_partition_predicate(self, partition_details) -> str | None:
        """Render the partition filter as SQL, the way `TableDiffParamsSetter` does.

        Only the SQLAlchemy samplers can compile one. Anything else falls back to the
        `partition_details` the message renders from instead.
        """
        if not (partition_details and partition_details.enablePartitioning):
            return None

        try:
            where_clause = self.sampler.get_partitioned_query().whereclause
            return str(where_clause.compile(compile_kwargs={"literal_binds": True}))
        except Exception as exc:
            logger.debug(
                "Could not compile the partition predicate for %s: %s", self.table_entity.fullyQualifiedName, exc
            )
            return None
