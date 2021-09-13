import copy
import logging

from ruamel.yaml import YAML, yaml_object

logger = logging.getLogger(__name__)
yaml = YAML()


@yaml_object(yaml)
class DotDict(dict):
    """This class provides dot.notation access to dictionary attributes.

    It is also serializable by the ruamel.yaml library used in Great Expectations for managing
    configuration objects.
    """

    def __getattr__(self, item):
        return self.get(item)

    __setattr__ = dict.__setitem__
    __delattr__ = dict.__delitem__

    def __dir__(self):
        return self.keys()

    # Cargo-cultishly copied from: https://github.com/spindlelabs/pyes/commit/d2076b385c38d6d00cebfe0df7b0d1ba8df934bc
    def __deepcopy__(self, memo):
        return DotDict(
            [(copy.deepcopy(k, memo), copy.deepcopy(v, memo)) for k, v in self.items()]
        )

    # The following are required to support yaml serialization, since we do not raise
    # AttributeError from __getattr__ in DotDict. We *do* raise that AttributeError when it is possible to know
    # a given attribute is not allowed (because it's not in _allowed_keys)
    _yaml_merge = []

    @classmethod
    def yaml_anchor(cls):
        # This is required since our dotdict allows *any* access via dotNotation, blocking the normal
        # behavior of raising an AttributeError when trying to access a nonexistent function
        return None

    @classmethod
    def to_yaml(cls, representer, node):
        """Use dict representation for DotDict (and subtypes by default)"""
        return representer.represent_dict(node)


class SerializableDotDict(DotDict):
    """
    Analogously to the way "SerializableDictDot" extends "DictDot" to provide JSON serialization, the present class,
    "SerializableDotDict" extends "DotDict" to provide JSON-serializable version of the "DotDict" class as well.
    Since "DotDict" is already YAML-serializable, "SerializableDotDict" is both YAML-serializable and JSON-serializable.
    """

    def to_json_dict(self) -> dict:
        raise NotImplementedError
