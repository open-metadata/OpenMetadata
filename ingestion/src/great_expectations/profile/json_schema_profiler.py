import logging
from enum import Enum
from typing import Any, Dict, List, Optional

import jsonschema

from great_expectations.core.expectation_configuration import ExpectationConfiguration
from great_expectations.core.expectation_suite import ExpectationSuite
from great_expectations.profile.base import Profiler, ProfilerTypeMapping

logger = logging.getLogger(__name__)


class JsonSchemaTypes(Enum):
    STRING = "string"
    INTEGER = "integer"
    NUMBER = "number"
    ARRAY = "array"
    NULL = "null"
    BOOLEAN = "boolean"
    OBJECT = "object"
    ENUM = "enum"


class JsonSchemaProfiler(Profiler):
    """
    This profiler creates Expectation Suites from JSONSchema artifacts.

    JSON Schema is a vocabulary that allows you to annotate and validate JSON
    documents. https://json-schema.org

    Basic suites can be created from these specifications.

    Note that there is not yet a notion of nested data types in Great
    Expectations so suites generated use column map expectations.

    Also note that this implementation does not traverse nested schemas and
    requires a top level object of type `object`.
    """

    PROFILER_TYPE_LIST_BY_JSON_SCHEMA_TYPE = {
        JsonSchemaTypes.STRING.value: ProfilerTypeMapping.STRING_TYPE_NAMES,
        JsonSchemaTypes.INTEGER.value: ProfilerTypeMapping.INT_TYPE_NAMES,
        JsonSchemaTypes.NUMBER.value: ProfilerTypeMapping.FLOAT_TYPE_NAMES,
        JsonSchemaTypes.BOOLEAN.value: ProfilerTypeMapping.BOOLEAN_TYPE_NAMES,
    }

    def validate(self, schema: dict) -> bool:
        if not isinstance(schema, dict):
            raise TypeError(
                f"This profiler requires a schema of type dict and was passed a {type(schema)}"
            )
        if "type" not in schema.keys():
            raise KeyError(
                f"This profiler requires a json schema with a top level `type` key"
            )
        if schema["type"] != JsonSchemaTypes.OBJECT.value:
            raise TypeError(
                f"This profiler requires a json schema with a top level `type` of `object`"
            )
        validator = jsonschema.validators.validator_for(schema)
        validator.check_schema(schema)
        return True

    def _profile(self, schema: Dict, suite_name: str = None) -> ExpectationSuite:
        if not suite_name:
            raise ValueError("Please provide a suite name when using this profiler.")
        expectations = []
        # TODO add recursion to allow creation of suites for nested schema files
        if schema["type"] == JsonSchemaTypes.OBJECT.value:
            for key, details in schema["properties"].items():
                expectations.append(self._create_existence_expectation(key, details))

                type_expectation = self._create_type_expectation(key, details)
                if type_expectation:
                    expectations.append(type_expectation)

                range_expectation = self._create_range_expectation(key, details)
                if range_expectation:
                    expectations.append(range_expectation)

                boolean_expectation = self._create_boolean_expectation(key, details)
                if boolean_expectation:
                    expectations.append(boolean_expectation)

                set_expectation = self._create_set_expectation(key, details)
                if set_expectation:
                    expectations.append(set_expectation)

                string_len_expectation = self._create_string_length_expectation(
                    key, details
                )
                if string_len_expectation:
                    expectations.append(string_len_expectation)

                null_or_not_null_expectation = (
                    self._create_null_or_not_null_column_expectation(key, details)
                )
                if null_or_not_null_expectation:
                    expectations.append(null_or_not_null_expectation)
        description = schema.get("description", None)
        meta = None
        if description:
            meta = {
                "notes": {
                    "format": "markdown",
                    "content": [f"### Description:\n{description}"],
                }
            }
        suite = ExpectationSuite(suite_name, expectations=expectations, meta=meta)
        suite.add_citation(
            comment=f"This suite was built by the {self.__class__.__name__}",
        )
        return suite

    def _get_object_types(self, details: dict) -> List[str]:
        type_ = details.get("type", None)
        any_of = details.get("anyOf", None)

        types_list = []

        if isinstance(type_, list):
            types_list.extend(type_)
        elif type_:
            types_list.append(type_)
        elif any_of:
            for schema in any_of:
                schema_type = schema.get("type", None)
                if isinstance(schema_type, list):
                    types_list.extend(schema_type)
                elif schema_type:
                    types_list.append(schema_type)

        return types_list

    def _get_enum_list(self, details: dict) -> Optional[List[str]]:
        enum = details.get("enum", None)
        any_of = details.get("anyOf", None)

        enum_list = []

        if enum:
            enum_list.extend(enum)
        elif any_of:
            for schema in any_of:
                enum_options = schema.get("enum", None)
                if enum_options:
                    enum_list.extend(enum_options)
        else:
            return None

        enum_list = [
            JsonSchemaTypes.NULL.value if item is None else item for item in enum_list
        ]

        return enum_list

    def _create_existence_expectation(
        self, key: str, details: dict
    ) -> ExpectationConfiguration:
        kwargs = {"column": key}
        description = details.get("description", None)
        meta = None
        if description:
            meta = {
                "notes": {
                    "format": "markdown",
                    "content": [f"### Description:\n{description}"],
                }
            }
        return ExpectationConfiguration("expect_column_to_exist", kwargs, meta=meta)

    def _create_type_expectation(
        self, key: str, details: dict
    ) -> Optional[ExpectationConfiguration]:
        object_types = self._get_object_types(details=details)
        object_types = list(
            filter(
                lambda object_type: object_type not in [JsonSchemaTypes.NULL.value],
                object_types,
            )
        )

        if len(object_types) == 0:
            return None

        type_list = []

        for type_ in object_types:
            type_list.extend(self.PROFILER_TYPE_LIST_BY_JSON_SCHEMA_TYPE[type_])

        kwargs = {"column": key, "type_list": type_list}
        return ExpectationConfiguration(
            "expect_column_values_to_be_in_type_list", kwargs
        )

    def _create_boolean_expectation(
        self, key: str, details: dict
    ) -> Optional[ExpectationConfiguration]:
        """https://json-schema.org/understanding-json-schema/reference/boolean.html"""
        object_types = self._get_object_types(details=details)

        if JsonSchemaTypes.BOOLEAN.value not in object_types:
            return None

        # TODO map JSONSchema types to which type backend? Pandas? Should this value set be parameterized per back end?
        kwargs = {"column": key, "value_set": [True, False]}
        return ExpectationConfiguration("expect_column_values_to_be_in_set", kwargs)

    def _create_range_expectation(
        self, key: str, details: dict
    ) -> Optional[ExpectationConfiguration]:
        """https://json-schema.org/understanding-json-schema/reference/numeric.html#range"""
        object_types = self._get_object_types(details=details)
        object_types = filter(
            lambda object_type: object_type != JsonSchemaTypes.NULL.value, object_types
        )
        range_types = [JsonSchemaTypes.INTEGER.value, JsonSchemaTypes.NUMBER.value]

        if set(object_types).issubset(set(range_types)) is False:
            return None

        type_ = details.get("type", None)
        any_of = details.get("anyOf", None)

        if not type_ and not any_of:
            return None

        minimum = None
        maximum = None
        exclusive_minimum = None
        exclusive_maximum = None

        if type_:
            minimum = details.get("minimum", None)
            maximum = details.get("maximum", None)
            exclusive_minimum = details.get("exclusiveMinimum", None)
            exclusive_maximum = details.get("exclusiveMaximum", None)
        elif any_of:
            for item in any_of:
                item_type = item.get("type", None)
                if item_type in range_types:
                    minimum = item.get("minimum", None)
                    maximum = item.get("maximum", None)
                    exclusive_minimum = item.get("exclusiveMinimum", None)
                    exclusive_maximum = item.get("exclusiveMaximum", None)
                    break

        if (
            minimum is None
            and maximum is None
            and exclusive_minimum is None
            and exclusive_maximum is None
        ):
            return None

        kwargs: Dict[str, Any] = {"column": key}
        if minimum is not None:
            kwargs["min_value"] = minimum
        if maximum is not None:
            kwargs["max_value"] = maximum
        if exclusive_minimum is not None:
            kwargs["min_value"] = exclusive_minimum
            kwargs["strict_min"] = True
        if exclusive_maximum is not None:
            kwargs["max_value"] = exclusive_maximum
            kwargs["strict_max"] = True

        return ExpectationConfiguration("expect_column_values_to_be_between", kwargs)

    def _create_string_length_expectation(
        self, key: str, details: dict
    ) -> Optional[ExpectationConfiguration]:
        """https://json-schema.org/understanding-json-schema/reference/string.html#length"""
        object_types = self._get_object_types(details=details)

        if JsonSchemaTypes.STRING.value not in object_types:
            return None

        type_ = details.get("type", None)
        any_of = details.get("anyOf", None)

        if not type_ and not any_of:
            return None

        if type_:
            minimum = details.get("minLength", None)
            maximum = details.get("maxLength", None)
        elif any_of:
            for item in any_of:
                item_type = item.get("type", None)
                if item_type == JsonSchemaTypes.STRING.value:
                    minimum = item.get("minLength", None)
                    maximum = item.get("maxLength", None)
                    break

        if minimum is None and maximum is None:
            return None

        kwargs = {
            "column": key,
        }
        if minimum == maximum:
            kwargs["value"] = minimum
            return ExpectationConfiguration(
                "expect_column_value_lengths_to_equal", kwargs
            )
        if minimum is not None:
            kwargs["min_value"] = minimum
        if maximum is not None:
            kwargs["max_value"] = maximum

        return ExpectationConfiguration(
            "expect_column_value_lengths_to_be_between", kwargs
        )

    def _create_set_expectation(
        self, key: str, details: dict
    ) -> Optional[ExpectationConfiguration]:
        """https://json-schema.org/understanding-json-schema/reference/generic.html#enumerated-values"""
        enum_list = self._get_enum_list(details=details)

        if not enum_list:
            return None

        enum_list = list(
            filter(lambda item: item is not JsonSchemaTypes.NULL.value, enum_list)
        )

        kwargs = {"column": key, "value_set": enum_list}
        return ExpectationConfiguration("expect_column_values_to_be_in_set", kwargs)

    def _create_null_or_not_null_column_expectation(
        self, key: str, details: dict
    ) -> Optional[ExpectationConfiguration]:
        """https://json-schema.org/understanding-json-schema/reference/null.html"""
        object_types = self._get_object_types(details=details)
        enum_list = self._get_enum_list(details=details)
        kwargs = {"column": key}

        if enum_list:
            object_types = set(enum_list).union(set(object_types))

        if JsonSchemaTypes.NULL.value not in object_types:
            return ExpectationConfiguration(
                "expect_column_values_to_not_be_null", kwargs
            )

        if len(object_types) == 1:
            return ExpectationConfiguration("expect_column_values_to_be_null", kwargs)

        return None

    def _create_regex_expectation(
        self, key: str, details: dict
    ) -> Optional[ExpectationConfiguration]:
        # TODO https://json-schema.org/understanding-json-schema/reference/regular_expressions.html
        raise NotImplementedError("regex are not yet implemented.")

    def _create_string_format_expectation(
        self, key: str, details: dict
    ) -> Optional[ExpectationConfiguration]:
        # TODO https://json-schema.org/understanding-json-schema/reference/string.html#format
        raise NotImplementedError("string format are not yet implemented.")

    def _create_array_expectation(
        self, key: str, details: dict
    ) -> Optional[ExpectationConfiguration]:
        # TODO Non tabular - how do we validate these? https://json-schema.org/understanding-json-schema/reference/array.html
        raise NotImplementedError("arrays are not yet implemented.")
