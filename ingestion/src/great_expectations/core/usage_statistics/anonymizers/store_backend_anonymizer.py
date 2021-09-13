from great_expectations.core.usage_statistics.anonymizers.anonymizer import Anonymizer
from great_expectations.data_context.store import (
    DatabaseStoreBackend,
    InMemoryStoreBackend,
    StoreBackend,
    TupleFilesystemStoreBackend,
    TupleGCSStoreBackend,
    TupleS3StoreBackend,
    TupleStoreBackend,
)


class StoreBackendAnonymizer(Anonymizer):
    def __init__(self, salt=None):
        super().__init__(salt=salt)

        # ordered bottom up in terms of inheritance order
        self._ge_classes = [
            TupleFilesystemStoreBackend,
            TupleS3StoreBackend,
            TupleGCSStoreBackend,
            InMemoryStoreBackend,
            DatabaseStoreBackend,
            TupleStoreBackend,
            StoreBackend,
        ]

    def anonymize_store_backend_info(
        self, store_backend_obj=None, store_backend_object_config=None
    ):
        assert (
            store_backend_obj or store_backend_object_config
        ), "Must pass store_backend_obj or store_backend_object_config."
        anonymized_info_dict = {}
        if store_backend_obj is not None:
            self.anonymize_object_info(
                object_=store_backend_obj,
                anonymized_info_dict=anonymized_info_dict,
                ge_classes=self._ge_classes,
            )
        else:
            class_name = store_backend_object_config.get("class_name")
            module_name = store_backend_object_config.get("module_name")
            if module_name is None:
                module_name = "great_expectations.data_context.store"
            self.anonymize_object_info(
                object_config={"class_name": class_name, "module_name": module_name},
                anonymized_info_dict=anonymized_info_dict,
                ge_classes=self._ge_classes,
            )
        return anonymized_info_dict
