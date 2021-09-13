from great_expectations.core.usage_statistics.anonymizers.anonymizer import Anonymizer
from great_expectations.core.usage_statistics.anonymizers.batch_kwargs_anonymizer import (
    BatchKwargsAnonymizer,
)
from great_expectations.data_asset import DataAsset


class BatchAnonymizer(Anonymizer):
    def __init__(self, salt=None):
        super().__init__(salt=salt)
        self._batch_kwargs_anonymizer = BatchKwargsAnonymizer(salt=salt)

    def anonymize_batch_info(self, batch):
        batch_kwargs = {}
        expectation_suite_name = ""
        datasource_name = ""
        if isinstance(batch, tuple):
            batch_kwargs = batch[0]
            expectation_suite_name = batch[1]
            datasource_name = batch_kwargs.get("datasource")
        if isinstance(batch, DataAsset):
            batch_kwargs = batch.batch_kwargs
            expectation_suite_name = batch.expectation_suite_name
            datasource_name = batch_kwargs.get("datasource")

        anonymized_info_dict = {}

        if batch_kwargs:
            anonymized_info_dict[
                "anonymized_batch_kwarg_keys"
            ] = self._batch_kwargs_anonymizer.anonymize_batch_kwargs(batch_kwargs)
        else:
            anonymized_info_dict["anonymized_batch_kwarg_keys"] = []
        if expectation_suite_name:
            anonymized_info_dict["anonymized_expectation_suite_name"] = self.anonymize(
                expectation_suite_name
            )
        else:
            anonymized_info_dict["anonymized_expectation_suite_name"] = "__not_found__"
        if datasource_name:
            anonymized_info_dict["anonymized_datasource_name"] = self.anonymize(
                datasource_name
            )
        else:
            anonymized_info_dict["anonymized_datasource_name"] = "__not_found__"

        return anonymized_info_dict
