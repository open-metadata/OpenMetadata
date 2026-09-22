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
"""
Validate the sampling and partition provenance, and the result messages built from it.
"""

from datetime import datetime
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from metadata.data_quality.validations import result_messages
from metadata.data_quality.validations.column.sqlalchemy.columnValueMeanToBeBetween import (
    ColumnValueMeanToBeBetweenValidator,
)
from metadata.data_quality.validations.column.sqlalchemy.columnValuesToBeNotNull import (
    ColumnValuesToBeNotNullValidator,
)
from metadata.data_quality.validations.models import EvaluationScopeRuntimeParameters
from metadata.data_quality.validations.result_messages import SamplingStability
from metadata.data_quality.validations.runtime_param_setter.evaluation_scope_params_setter import (
    EvaluationScopeParamsSetter,
)
from metadata.data_quality.validations.runtime_param_setter.param_setter_factory import (
    RuntimeParameterSetterFactory,
)
from metadata.data_quality.validations.thresholds import FailureThreshold, ThresholdUnit
from metadata.generated.schema.entity.data.table import (
    PartitionIntervalTypes,
    PartitionProfilerConfig,
)
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.basic import ProfileSampleType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
from metadata.profiler.metrics.registry import Metrics

EXECUTION_DATE = int(datetime.strptime("2021-07-03", "%Y-%m-%d").timestamp() * 1000)
ENTITY_LINK = "<#E::table::service.db.users::columns::amount>"

TEN_PERCENT = EvaluationScopeRuntimeParameters(
    profile_sample=10.0,
    profile_sample_type=ProfileSampleType.PERCENTAGE,
)
FULL_TABLE = EvaluationScopeRuntimeParameters()


def scope_parameter(scope: EvaluationScopeRuntimeParameters) -> TestCaseParameterValue:
    """The scope as the runtime parameter setter injects it"""
    return TestCaseParameterValue(
        name=type(scope).__name__,
        value=scope.model_dump_json(),
    )


def build_validator(validator_class, parameter_values, compute_passed_failed_row_count=False):
    """Build a validator whose only live dependency is its test case"""
    test_case = TestCase(
        name="my_test_case",
        entityLink=ENTITY_LINK,
        testSuite=EntityReference(id=uuid4(), type="TestSuite"),  # type: ignore
        testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),  # type: ignore
        parameterValues=parameter_values,
        computePassedFailedRowCount=compute_passed_failed_row_count,
    )  # type: ignore
    return validator_class(MagicMock(), test_case, EXECUTION_DATE)


def build_not_null_validator(scope, null_count, row_count, threshold=None, unit=None):
    """A not-null validator whose metrics are the ones handed in"""
    parameter_values = [scope_parameter(scope)]
    if threshold is not None:
        parameter_values.append(TestCaseParameterValue(name="threshold", value=str(threshold)))
    if unit is not None:
        parameter_values.append(TestCaseParameterValue(name="thresholdUnit", value=unit))

    validator = build_validator(ColumnValuesToBeNotNullValidator, parameter_values, True)
    validator.get_column = MagicMock()
    validator._run_results = MagicMock(return_value=null_count)
    validator.get_row_count = MagicMock(return_value=row_count)
    return validator


class TestScopeSentence:
    """The sentence that says which rows a verdict was measured on"""

    def test_full_table(self):
        assert result_messages.scope_sentence(FULL_TABLE) == "Evaluated on the full table."

    def test_percentage_sample(self):
        assert result_messages.scope_sentence(TEN_PERCENT) == "Evaluated on a 10% sample of the table."

    def test_row_sample(self):
        scope = EvaluationScopeRuntimeParameters(
            profile_sample=1000,
            profile_sample_type=ProfileSampleType.ROWS,
        )
        assert result_messages.scope_sentence(scope) == "Evaluated on a sample of 1,000 rows of the table."

    def test_sample_query(self):
        scope = EvaluationScopeRuntimeParameters(sample_query="SELECT * FROM users LIMIT 10")
        assert result_messages.scope_sentence(scope) == (
            "Evaluated on the rows returned by the configured sample query."
        )

    def test_compiled_partition_predicate_is_rendered_verbatim(self):
        scope = EvaluationScopeRuntimeParameters(
            profile_sample=10.0,
            profile_sample_type=ProfileSampleType.PERCENTAGE,
            partition_details=PartitionProfilerConfig(enablePartitioning=True, partitionColumnName="event_date"),
            partition_predicate="event_date >= '2026-09-10'",
        )
        assert result_messages.scope_sentence(scope) == (
            "Evaluated on a 10% sample of the table, partitioned on event_date >= '2026-09-10'."
        )

    def test_partition_without_a_predicate_falls_back_to_the_configuration(self):
        scope = EvaluationScopeRuntimeParameters(
            partition_details=PartitionProfilerConfig(
                enablePartitioning=True,
                partitionColumnName="country",
                partitionIntervalType=PartitionIntervalTypes.COLUMN_VALUE,
                partitionValues=["US", "CA"],
            ),
        )
        assert (
            result_messages.scope_sentence(scope) == "Evaluated on the full table, partitioned on country in (US, CA)."
        )

    def test_a_sample_that_scales_says_so(self):
        sentence = result_messages.scope_sentence(TEN_PERCENT, stability=SamplingStability.SCALES_WITH_SAMPLE)
        assert sentence.startswith("Evaluated on a 10% sample of the table.")
        assert "scales with the number of rows read" in sentence

    def test_a_sample_that_biases_extremes_says_so(self):
        sentence = result_messages.scope_sentence(TEN_PERCENT, stability=SamplingStability.BIASED_INWARD)
        assert "biased toward the middle of the distribution" in sentence

    def test_no_sampling_caveat_without_a_sample(self):
        sentence = result_messages.scope_sentence(FULL_TABLE, stability=SamplingStability.SCALES_WITH_SAMPLE)
        assert sentence == "Evaluated on the full table."

    def test_an_absolute_threshold_on_a_sample_is_flagged(self):
        sentence = result_messages.scope_sentence(
            TEN_PERCENT,
            threshold=FailureThreshold(value=5, unit=ThresholdUnit.ABSOLUTE),
        )
        assert "does not carry over to the full table" in sentence

    def test_a_percentage_threshold_on_a_sample_is_not_flagged(self):
        sentence = result_messages.scope_sentence(
            TEN_PERCENT,
            threshold=FailureThreshold(value=5, unit=ThresholdUnit.PERCENTAGE),
        )
        assert "does not carry over" not in sentence

    def test_rule_library_sql_says_it_bypasses_the_sampler(self):
        sentence = result_messages.scope_sentence(TEN_PERCENT, bypasses_sampler=True)
        assert sentence == (
            "Evaluated on the full table. The test's own SQL runs against the full table, "
            "bypassing a 10% sample of the table."
        )


class TestResultMessages:
    """The first sentence: what was measured, against what, under which threshold"""

    def test_a_row_tolerance_message_names_everything(self):
        validator = build_not_null_validator(TEN_PERCENT, 120, 9981, threshold=1, unit="PERCENTAGE")

        result = validator.run_validation()

        assert result.result == (
            "Found 120 null rows out of 9,981 evaluated (1.20%). Threshold is 1%, so this test failed. "
            "Evaluated on a 10% sample of the table."
        )
        assert result.testCaseStatus is TestCaseStatus.Failed

    def test_an_uncounted_population_is_said_rather_than_guessed(self):
        validator = build_validator(ColumnValuesToBeNotNullValidator, [scope_parameter(FULL_TABLE)])
        validator.get_column = MagicMock()
        validator._run_results = MagicMock(return_value=3)

        result = validator.run_validation()

        assert result.result == (
            "Found 3 null rows out of an uncounted population. Threshold is no tolerance, "
            "so this test failed. Evaluated on the full table."
        )

    def test_a_deviation_message_names_the_widened_bounds(self):
        validator = build_validator(
            ColumnValueMeanToBeBetweenValidator,
            [
                TestCaseParameterValue(name="minValueForMeanInCol", value="90"),
                TestCaseParameterValue(name="maxValueForMeanInCol", value="110"),
                TestCaseParameterValue(name="threshold", value="5"),
                TestCaseParameterValue(name="thresholdUnit", value="PERCENTAGE"),
                scope_parameter(FULL_TABLE),
            ],
        )
        validator.get_column = MagicMock()
        validator._run_results = MagicMock(return_value=87.4)

        result = validator.run_validation()

        assert result.result == (
            "Mean of `amount` is 87.4. Expected between 90 and 110, widened by a 5% tolerance to "
            "85.5 and 115.5, so this test passed. Evaluated on the full table."
        )
        assert result.testCaseStatus is TestCaseStatus.Success

    def test_an_unapplied_tolerance_is_visible(self):
        """An agent that ignores the threshold parameter says "no tolerance", never stays silent"""
        validator = build_validator(
            ColumnValueMeanToBeBetweenValidator,
            [
                TestCaseParameterValue(name="minValueForMeanInCol", value="90"),
                TestCaseParameterValue(name="maxValueForMeanInCol", value="110"),
                scope_parameter(FULL_TABLE),
            ],
        )
        validator.get_column = MagicMock()
        validator._run_results = MagicMock(return_value=87.4)

        assert "with no tolerance applied, so this test failed" in validator.run_validation().result

    def test_an_aborted_message_is_left_alone(self):
        validator = build_validator(ColumnValuesToBeNotNullValidator, [scope_parameter(TEN_PERCENT)])
        validator.get_column = MagicMock(side_effect=ValueError("no such column"))

        result = validator.run_validation()

        assert result.testCaseStatus is TestCaseStatus.Aborted
        assert "Evaluated on" not in result.result

    def test_a_missing_scope_reports_the_full_table(self):
        """An older server, or a caller that does not go through the test suite interface"""
        validator = build_validator(ColumnValuesToBeNotNullValidator, [])
        validator.get_column = MagicMock()
        validator._run_results = MagicMock(return_value=0)

        assert validator.run_validation().result.endswith("Evaluated on the full table.")


class TestSampleAgainstFullTable:
    """The same table, with and without a sample.

    120 nulls out of 9,981 rows, and a 10% sample of it: 12 nulls out of 998.
    """

    FULL = (120, 9981)
    SAMPLED = (12, 998)

    @pytest.mark.parametrize("nulls,rows", [FULL, SAMPLED], ids=["full table", "10% sample"])
    def test_a_percentage_threshold_agrees(self, nulls, rows):
        """1.20% either way, so a 1% threshold fails both"""
        scope = FULL_TABLE if rows == self.FULL[1] else TEN_PERCENT
        validator = build_not_null_validator(scope, nulls, rows, threshold=1, unit="PERCENTAGE")

        result = validator.run_validation()

        assert result.testCaseStatus is TestCaseStatus.Failed
        assert f"out of {rows:,} evaluated (1.20%)" in result.result

    def test_an_absolute_threshold_does_not(self):
        """50 rows is more than the sample's 12 violations and fewer than the table's 120"""
        full = build_not_null_validator(FULL_TABLE, *self.FULL, threshold=50).run_validation()
        sampled = build_not_null_validator(TEN_PERCENT, *self.SAMPLED, threshold=50).run_validation()

        assert full.testCaseStatus is TestCaseStatus.Failed
        assert sampled.testCaseStatus is TestCaseStatus.Success

        assert "out of 9,981 evaluated" in full.result
        assert "out of 998 evaluated" in sampled.result
        assert "does not carry over to the full table" in sampled.result
        assert "does not carry over to the full table" not in full.result


class TestEvaluationScopeParamsSetter:
    """Resolving the scope off the sampler the test is about to run against"""

    def build_setter(self, sampler):
        return EvaluationScopeParamsSetter(MagicMock(), MagicMock(), MagicMock(), sampler)

    def test_reads_the_resolved_sample_and_the_partition(self):
        sampler = MagicMock()
        sampler._resolve_sample_config = StaticSamplingConfig(
            profileSample=10.0,
            profileSampleType=ProfileSampleType.PERCENTAGE,
        )
        sampler.partition_details = PartitionProfilerConfig(
            enablePartitioning=True,
            partitionColumnName="event_date",
        )
        sampler.sample_query = None
        sampler.get_partitioned_query.return_value.whereclause.compile.return_value = "event_date >= '2026-09-10'"

        scope = self.build_setter(sampler).get_parameters(MagicMock())

        assert scope.profile_sample == 10.0
        assert scope.profile_sample_type is ProfileSampleType.PERCENTAGE
        assert scope.partition_predicate == "event_date >= '2026-09-10'"
        assert scope.is_sampled and scope.is_partitioned and not scope.is_full_table

    def test_an_unsampled_table_is_the_full_table(self):
        sampler = MagicMock()
        sampler._resolve_sample_config = None
        sampler.partition_details = None
        sampler.sample_query = None

        scope = self.build_setter(sampler).get_parameters(MagicMock())

        assert scope.is_full_table

    def test_a_sampler_that_cannot_resolve_its_config_does_not_fail_the_test_case(self):
        sampler = MagicMock()
        type(sampler)._resolve_sample_config = property(lambda _: (_ for _ in ()).throw(RuntimeError("boom")))
        sampler.partition_details = None
        sampler.sample_query = None

        assert self.build_setter(sampler).get_parameters(MagicMock()).is_full_table


def test_the_scope_setter_runs_for_every_test_case():
    """The scope is a property of the run, not of one test definition"""
    setters = RuntimeParameterSetterFactory().get_runtime_param_setters(
        "columnValuesToBeNotNull",
        MagicMock(),
        MagicMock(),
        MagicMock(),
        MagicMock(),
    )

    assert any(isinstance(setter, EvaluationScopeParamsSetter) for setter in setters)


def test_the_metrics_a_sample_distorts_are_declared():
    """`PERCENTAGE` is sample-stable, a sum is not, and an extreme is biased inward"""
    from metadata.data_quality.validations.column.sqlalchemy.columnValueMaxToBeBetween import (
        ColumnValueMaxToBeBetweenValidator,
    )
    from metadata.data_quality.validations.column.sqlalchemy.columnValuesSumToBeBetween import (
        ColumnValuesSumToBeBetweenValidator,
    )

    assert ColumnValueMeanToBeBetweenValidator.SAMPLING_STABILITY is SamplingStability.STABLE
    assert ColumnValuesSumToBeBetweenValidator.SAMPLING_STABILITY is SamplingStability.SCALES_WITH_SAMPLE
    assert ColumnValueMaxToBeBetweenValidator.SAMPLING_STABILITY is SamplingStability.BIASED_INWARD


def test_the_metric_names_are_not_part_of_the_message():
    """The UI re-derives its sentence from the parameters; nothing parses `nullCount=3`"""
    validator = build_not_null_validator(FULL_TABLE, 3, 100)

    assert "nullCount=" not in validator.run_validation().result
    assert Metrics.nullCount.name not in validator.run_validation().result
