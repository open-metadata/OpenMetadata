from great_expectations.core.usage_statistics.anonymizers.anonymizer import Anonymizer
from great_expectations.dataset import Dataset
from great_expectations.expectations.registry import (
    list_registered_expectation_implementations,
)

v2_batchkwargs_api_supported_expectation_types = [
    el for el in Dataset.__dict__.keys() if el.startswith("expect_")
]

v3_batchrequest_api_supported_expectation_types = (
    list_registered_expectation_implementations()
)

GE_EXPECTATION_TYPES = set(v2_batchkwargs_api_supported_expectation_types).union(
    set(v3_batchrequest_api_supported_expectation_types)
)


class ExpectationSuiteAnonymizer(Anonymizer):
    def __init__(self, salt=None):
        super().__init__(salt=salt)
        self._ge_expectation_types = GE_EXPECTATION_TYPES

    def anonymize_expectation_suite_info(self, expectation_suite):
        anonymized_info_dict = {}
        anonymized_expectation_counts = list()

        expectations = expectation_suite.expectations
        expectation_types = [
            expectation.expectation_type for expectation in expectations
        ]
        for expectation_type in set(expectation_types):
            expectation_info = {"count": expectation_types.count(expectation_type)}
            if expectation_type in self._ge_expectation_types:
                expectation_info["expectation_type"] = expectation_type
            else:
                expectation_info["anonymized_expectation_type"] = self.anonymize(
                    expectation_type
                )
            anonymized_expectation_counts.append(expectation_info)

        anonymized_info_dict["anonymized_name"] = self.anonymize(
            expectation_suite.expectation_suite_name
        )
        anonymized_info_dict["expectation_count"] = len(expectations)
        anonymized_info_dict[
            "anonymized_expectation_counts"
        ] = anonymized_expectation_counts

        return anonymized_info_dict
