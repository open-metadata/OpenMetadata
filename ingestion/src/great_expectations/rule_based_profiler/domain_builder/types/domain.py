import json
from dataclasses import asdict, dataclass
from enum import Enum
from typing import Any, Dict, Optional, Union

from great_expectations.core import IDDict
from great_expectations.core.util import convert_to_json_serializable
from great_expectations.execution_engine.execution_engine import MetricDomainTypes
from great_expectations.types import SerializableDictDot
from great_expectations.types.base import SerializableDotDict
from great_expectations.util import filter_properties_dict


class SemanticDomainTypes(Enum):
    NUMERIC = "numeric"
    TEXT = "text"
    LOGIC = "logic"
    DATETIME = "datetime"
    BINARY = "binary"
    CURRENCY = "currency"
    VALUE_SET = "value_set"
    IDENTIFIER = "identifier"
    MISCELLANEOUS = "miscellaneous"
    UNKNOWN = "unknown"


@dataclass
class InferredSemanticDomainType(SerializableDictDot):
    semantic_domain_type: Optional[Union[str, SemanticDomainTypes]] = None
    details: Optional[Dict[str, Any]] = None

    def to_json_dict(self) -> dict:
        return convert_to_json_serializable(data=asdict(self))


class DomainKwargs(SerializableDotDict):
    def to_json_dict(self) -> dict:
        return convert_to_json_serializable(data=dict(self))


class Domain(SerializableDotDict):
    # Adding an explicit constructor to highlight the specific properties that will be used.
    def __init__(
        self,
        domain_type: Union[str, MetricDomainTypes],
        domain_kwargs: Optional[Union[Dict[str, Any], DomainKwargs]] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        if isinstance(domain_type, str):
            try:
                domain_type = MetricDomainTypes[domain_type]
            except (TypeError, KeyError) as e:
                raise ValueError(
                    f""" \
{e}: Cannot instantiate Domain (domain_type "{str(domain_type)}" of type "{str(type(domain_type))}" is not supported).
                    """
                )
        elif not isinstance(domain_type, MetricDomainTypes):
            raise ValueError(
                f""" \
Cannot instantiate Domain (domain_type "{str(domain_type)}" of type "{str(type(domain_type))}" is not supported).
                """
            )

        if domain_kwargs is None:
            domain_kwargs = DomainKwargs({})
        elif isinstance(domain_kwargs, dict):
            domain_kwargs = DomainKwargs(domain_kwargs)

        domain_kwargs_dot_dict: SerializableDotDict = (
            self._convert_dictionaries_to_domain_kwargs(source=domain_kwargs)
        )

        if details is None:
            details = {}

        super().__init__(
            domain_type=domain_type,
            domain_kwargs=domain_kwargs_dot_dict,
            details=details,
        )

    def __repr__(self):
        return json.dumps(self.to_json_dict(), indent=2)

    def __str__(self):
        return self.__repr__()

    def __eq__(self, other):
        return (other is not None) and (
            (
                hasattr(other, "to_json_dict")
                and self.to_json_dict() == other.to_json_dict()
            )
            or (
                isinstance(other, dict)
                and self.to_json_dict()
                == filter_properties_dict(properties=other, clean_falsy=True)
            )
            or (self.__str__() == str(other))
        )

    def __ne__(self, other):
        return not self.__eq__(other=other)

    # Adding this property for convenience (also, in the future, arguments may not be all set to their default values).
    @property
    def id(self) -> str:
        return IDDict(self.to_json_dict()).to_id()

    def to_json_dict(self) -> dict:
        json_dict: dict = {
            "domain_type": self["domain_type"].value,
            "domain_kwargs": self["domain_kwargs"].to_json_dict(),
            "details": {key: value.value for key, value in self["details"].items()},
        }
        return filter_properties_dict(properties=json_dict, clean_falsy=True)

    def _convert_dictionaries_to_domain_kwargs(
        self, source: Optional[Any] = None
    ) -> Optional[Union[Any, "Domain"]]:
        if source is None:
            return None

        if isinstance(source, dict):
            if not isinstance(source, Domain):
                filter_properties_dict(properties=source, inplace=True)
                source = DomainKwargs(source)
            key: str
            value: Any
            for key, value in source.items():
                source[key] = self._convert_dictionaries_to_domain_kwargs(source=value)

        return source
