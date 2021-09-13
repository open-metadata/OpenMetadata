from great_expectations.core.usage_statistics.anonymizers.anonymizer import Anonymizer
from great_expectations.core.usage_statistics.anonymizers.store_backend_anonymizer import (
    StoreBackendAnonymizer,
)
from great_expectations.data_context.store import (
    CheckpointStore,
    ConfigurationStore,
    EvaluationParameterStore,
    ExpectationsStore,
    HtmlSiteStore,
    MetricStore,
    Store,
    ValidationsStore,
)


class StoreAnonymizer(Anonymizer):
    def __init__(self, salt=None):
        super().__init__(salt=salt)
        # ordered bottom up in terms of inheritance order
        self._ge_classes = [
            CheckpointStore,
            ValidationsStore,
            ExpectationsStore,
            EvaluationParameterStore,
            MetricStore,
            ConfigurationStore,
            Store,
            HtmlSiteStore,
        ]
        self._store_backend_anonymizer = StoreBackendAnonymizer(salt=salt)

    def anonymize_store_info(self, store_name, store_obj):
        anonymized_info_dict = {}
        anonymized_info_dict["anonymized_name"] = self.anonymize(store_name)
        store_backend_obj = store_obj.store_backend

        self.anonymize_object_info(
            object_=store_obj,
            anonymized_info_dict=anonymized_info_dict,
            ge_classes=self._ge_classes,
        )

        anonymized_info_dict[
            "anonymized_store_backend"
        ] = self._store_backend_anonymizer.anonymize_store_backend_info(
            store_backend_obj=store_backend_obj
        )

        return anonymized_info_dict

    def is_parent_class_recognized(self, store_obj):
        return self._is_parent_class_recognized(
            classes_to_check=self._ge_classes, object_=store_obj
        )
