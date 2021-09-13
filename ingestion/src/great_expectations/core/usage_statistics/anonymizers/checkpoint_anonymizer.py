from great_expectations.checkpoint import Checkpoint, SimpleCheckpoint
from great_expectations.core.usage_statistics.anonymizers.anonymizer import Anonymizer


class CheckpointAnonymizer(Anonymizer):
    def __init__(self, salt=None):
        super().__init__(salt=salt)

        # ordered bottom up in terms of inheritance order
        self._ge_classes = [SimpleCheckpoint, Checkpoint]

    def anonymize_checkpoint_info(self, name, config):
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
