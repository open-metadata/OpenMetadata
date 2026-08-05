"""Read-only ClickZetta native test execution."""

from metadata.data_quality.builders.validator_builder import (
    SourceType,
    ValidatorBuilder,
)
from metadata.data_quality.interface.sqlalchemy.sqa_test_suite_interface import (
    SQATestSuiteInterface,
)
from metadata.data_quality.processor.test_case_runner import TestDefinition
from metadata.generated.schema.tests.testCase import TestCase


class ClickzettaTestSuiteInterface(SQATestSuiteInterface):
    """Run standard validators against the bounded ClickZetta sampler.

    Custom SQL, rule-library SQL, and table-diff validators can bypass the
    sampler and issue unbounded statements.  They are therefore rejected
    explicitly; standard column/table validators operate on the sampler's
    bounded dataset and remain read-only.
    """

    _UNSAFE_DEFINITION_MARKERS = ("customsql", "rulelibrary", "tablediff", "datadiff")

    @classmethod
    def validate_test_definition_name(cls, name: str) -> None:
        normalized = str(name).replace("_", "").replace("-", "").lower()
        if any(marker in normalized for marker in cls._UNSAFE_DEFINITION_MARKERS):
            raise ValueError(f"ClickZetta test definition is not supported: {name}")

    def _get_validator_builder(self, test_case: TestCase, entity_type: str) -> ValidatorBuilder:
        test_definition = self.ometa_client.get_by_name(
            entity=TestDefinition,
            fqn=test_case.testDefinition.fullyQualifiedName,
        )
        if test_definition is None:
            raise ValueError(f"Cannot find TestDefinition for test case {test_case.fullyQualifiedName}")

        self.validate_test_definition_name(test_definition.fullyQualifiedName.root)
        return self.validator_builder_class(
            runner=self.runner,
            test_case=test_case,
            test_definition=test_definition,
            entity_type=entity_type,
            source_type=SourceType.SQL,
        )
