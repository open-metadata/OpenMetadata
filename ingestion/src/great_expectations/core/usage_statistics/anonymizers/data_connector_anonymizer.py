# isort:skip_file

from great_expectations.core.usage_statistics.anonymizers.anonymizer import Anonymizer

from great_expectations.datasource.data_connector import (
    DataConnector,
    RuntimeDataConnector,
    FilePathDataConnector,
    ConfiguredAssetFilePathDataConnector,
    InferredAssetFilePathDataConnector,
    ConfiguredAssetFilesystemDataConnector,
    InferredAssetFilesystemDataConnector,
    ConfiguredAssetS3DataConnector,
    InferredAssetS3DataConnector,
    ConfiguredAssetAzureDataConnector,
    InferredAssetAzureDataConnector,
    ConfiguredAssetGCSDataConnector,
    InferredAssetGCSDataConnector,
    ConfiguredAssetSqlDataConnector,
    InferredAssetSqlDataConnector,
)


class DataConnectorAnonymizer(Anonymizer):
    def __init__(self, salt=None):
        super().__init__(salt=salt)

        # This list should contain all DataConnector types. When new DataConnector types
        # are created, please make sure to add ordered bottom up in terms of inheritance order
        self._ge_classes = [
            InferredAssetSqlDataConnector,
            ConfiguredAssetSqlDataConnector,
            InferredAssetGCSDataConnector,
            ConfiguredAssetGCSDataConnector,
            InferredAssetAzureDataConnector,
            ConfiguredAssetAzureDataConnector,
            InferredAssetS3DataConnector,
            ConfiguredAssetS3DataConnector,
            InferredAssetFilesystemDataConnector,
            ConfiguredAssetFilesystemDataConnector,
            InferredAssetFilePathDataConnector,
            ConfiguredAssetFilePathDataConnector,
            FilePathDataConnector,
            RuntimeDataConnector,
            DataConnector,
        ]

    def anonymize_data_connector_info(self, name, config):
        anonymized_info_dict = {}
        anonymized_info_dict["anonymized_name"] = self.anonymize(name)

        self.anonymize_object_info(
            anonymized_info_dict=anonymized_info_dict,
            ge_classes=self._ge_classes,
            object_config=config,
        )

        return anonymized_info_dict

    def is_parent_class_recognized(self, config):
        return self._is_parent_class_recognized(
            classes_to_check=self._ge_classes,
            object_config=config,
        )
