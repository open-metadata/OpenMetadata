from typing import Any, Mapping

from factory import SubFactory
from factory.declarations import BaseDeclaration


class PolymorphicSubFactory(BaseDeclaration):
    def __init__(
        self,
        subfactories: Mapping[str, SubFactory],
        default: str,
        discriminator_name: str = "type",
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self.subfactories = subfactories
        self.default = default
        self.discriminator_name = discriminator_name

    def evaluate(self, instance, step, extra):
        discriminator = extra.pop(self.discriminator_name, self.default)

        subfactory = self.subfactories.get(discriminator)

        if subfactory is None:
            raise ValueError(f"Subfactory not found for discriminator {discriminator}")

        return subfactory.evaluate(instance, step, extra)
