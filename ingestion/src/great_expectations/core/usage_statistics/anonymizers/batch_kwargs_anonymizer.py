from great_expectations.core.usage_statistics.anonymizers.anonymizer import Anonymizer


class BatchKwargsAnonymizer(Anonymizer):
    def __init__(self, salt=None):
        super().__init__(salt=salt)

        self._ge_batch_kwarg_keys = [
            "datasource",
            "reader_method",
            "reader_options",
            "path",
            "s3",
            "dataset",
            "PandasInMemoryDF",
            "ge_batch_id",
            "query",
            "table",
            "SparkDFRef",
            "limit",
            "query_parameters",
            "offset",
            "snowflake_transient_table",
            "bigquery_temp_table",
            "data_asset_name",
        ]

    def anonymize_batch_kwargs(self, batch_kwargs):
        anonymized_batch_kwarg_keys = []
        for batch_kwarg_key in batch_kwargs.keys():
            if batch_kwarg_key in self._ge_batch_kwarg_keys:
                anonymized_batch_kwarg_keys.append(batch_kwarg_key)
            else:
                anonymized_batch_kwarg_keys.append(self.anonymize(batch_kwarg_key))

        return anonymized_batch_kwarg_keys
