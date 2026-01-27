from typing import Any, Dict, Set

import factory
from factory.base import FactoryOptions, OptionDefault

DEFAULT_ROOT_ATTRIBUTE_NAME = "root"


def add_root_prefix(
    parameters: Dict[str, Any], root_attribute_name: str, ignore_keys: Set[str]
) -> Dict[str, Any]:
    params = {}

    for key, value in parameters.items():
        if not key.startswith(root_attribute_name) and key not in ignore_keys:
            key = f"{root_attribute_name}__{key}"

        params[key] = value

    return params


class RootFactoryOptions(FactoryOptions):
    def _build_default_options(self):
        return super()._build_default_options() + [
            OptionDefault(
                "root_attribute_name", DEFAULT_ROOT_ATTRIBUTE_NAME, inherit=False
            ),
        ]


class RootModelFactory(factory.Factory):
    class Meta:
        abstract = True

    _options_class = RootFactoryOptions

    @classmethod
    def _generate(cls, strategy, params):
        return super()._generate(
            strategy,
            add_root_prefix(
                params,
                cls._meta.root_attribute_name,
                set(cls._meta.declarations.keys()),
            ),
        )


class RootSubFactory(factory.SubFactory):
    def __init__(
        self, *args, root_attribute_name: str = DEFAULT_ROOT_ATTRIBUTE_NAME, **kwargs
    ):
        super().__init__(*args, **kwargs)
        self.root_attribute_name = root_attribute_name

    def evaluate(self, instance, step, extra):
        return super().evaluate(
            instance,
            step,
            add_root_prefix(
                extra,
                self.root_attribute_name,
                set(self.get_factory()._meta.declarations.keys()),
            ),
        )
