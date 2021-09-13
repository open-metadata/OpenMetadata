import logging
from hashlib import md5
from typing import Optional

from great_expectations.util import load_class

logger = logging.getLogger(__name__)


class Anonymizer:
    """Anonymize string names in an optionally-consistent way."""

    def __init__(self, salt=None):
        if salt is not None and not isinstance(salt, str):
            logger.error("invalid salt: must provide a string. Setting a random salt.")
            salt = None
        if salt is None:
            import secrets

            self._salt = secrets.token_hex(8)
        else:
            self._salt = salt

    @property
    def salt(self):
        return self._salt

    def anonymize(self, string_):
        salted = self._salt + string_
        return md5(salted.encode("utf-8")).hexdigest()

    def anonymize_object_info(
        self,
        anonymized_info_dict,
        ge_classes,
        object_=None,
        object_class=None,
        object_config=None,
    ):
        assert (
            object_ or object_class or object_config
        ), "Must pass either object_ or object_class or object_config."
        try:
            if object_class is None and object_ is not None:
                object_class = object_.__class__
            elif object_class is None and object_config is not None:
                object_class_name = object_config.get("class_name")
                object_module_name = object_config.get("module_name")
                object_class = load_class(object_class_name, object_module_name)
            object_class_name = object_class.__name__

            for ge_class in ge_classes:
                if issubclass(object_class, ge_class):
                    anonymized_info_dict["parent_class"] = ge_class.__name__
                    if not object_class == ge_class:
                        anonymized_info_dict["anonymized_class"] = self.anonymize(
                            object_class_name
                        )
                    break

            if not anonymized_info_dict.get("parent_class"):
                anonymized_info_dict["parent_class"] = "__not_recognized__"
                anonymized_info_dict["anonymized_class"] = self.anonymize(
                    object_class_name
                )
        except AttributeError:
            anonymized_info_dict["parent_class"] = "__not_recognized__"
            anonymized_info_dict["anonymized_class"] = self.anonymize(object_class_name)

        return anonymized_info_dict

    def _is_parent_class_recognized(
        self,
        classes_to_check,
        object_=None,
        object_class=None,
        object_config=None,
    ) -> Optional[str]:
        """
        Check if the parent class is a subclass of any core GE class.
        This private method is intended to be used by anonymizers in a public `is_parent_class_recognized()` method. These anonymizers define and provide the core GE classes_to_check.
        Returns:
            The name of the parent class found, or None if no parent class was found
        """
        assert (
            object_ or object_class or object_config
        ), "Must pass either object_ or object_class or object_config."
        try:
            if object_class is None and object_ is not None:
                object_class = object_.__class__
            elif object_class is None and object_config is not None:
                object_class_name = object_config.get("class_name")
                object_module_name = object_config.get("module_name")
                object_class = load_class(object_class_name, object_module_name)

            for class_to_check in classes_to_check:
                if issubclass(object_class, class_to_check):
                    return class_to_check.__name__

            return None

        except AttributeError:
            return None
