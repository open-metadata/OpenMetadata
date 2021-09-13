import logging
import warnings
from typing import Optional, Union
from uuid import UUID

from dateutil.parser import parse

from great_expectations.core.data_context_key import DataContextKey
from great_expectations.core.id_dict import BatchKwargs, IDDict
from great_expectations.core.run_identifier import RunIdentifier, RunIdentifierSchema
from great_expectations.exceptions import DataContextError, InvalidDataContextKeyError
from great_expectations.marshmallow__shade import Schema, fields, post_load

logger = logging.getLogger(__name__)


class ExpectationSuiteIdentifier(DataContextKey):
    def __init__(self, expectation_suite_name: str):
        super().__init__()
        if not isinstance(expectation_suite_name, str):
            raise InvalidDataContextKeyError(
                f"expectation_suite_name must be a string, not {type(expectation_suite_name).__name__}"
            )
        self._expectation_suite_name = expectation_suite_name

    @property
    def expectation_suite_name(self):
        return self._expectation_suite_name

    def to_tuple(self):
        return tuple(self.expectation_suite_name.split("."))

    def to_fixed_length_tuple(self):
        return (self.expectation_suite_name,)

    @classmethod
    def from_tuple(cls, tuple_):
        return cls(".".join(tuple_))

    @classmethod
    def from_fixed_length_tuple(cls, tuple_):
        return cls(expectation_suite_name=tuple_[0])

    def __repr__(self):
        return self.__class__.__name__ + "::" + self._expectation_suite_name


class ExpectationSuiteIdentifierSchema(Schema):
    expectation_suite_name = fields.Str()

    # noinspection PyUnusedLocal
    @post_load
    def make_expectation_suite_identifier(self, data, **kwargs):
        return ExpectationSuiteIdentifier(**data)


class BatchIdentifier(DataContextKey):
    """A BatchIdentifier tracks"""

    def __init__(
        self,
        batch_identifier: Union[BatchKwargs, dict, str],
        data_asset_name: str = None,
    ):
        super().__init__()
        # if isinstance(batch_identifier, (BatchKwargs, dict)):
        #     self._batch_identifier = batch_identifier.batch_fingerprint

        self._batch_identifier = batch_identifier
        self._data_asset_name = data_asset_name

    @property
    def batch_identifier(self):
        return self._batch_identifier

    @property
    def data_asset_name(self):
        return self._data_asset_name

    def to_tuple(self):
        return (self.batch_identifier,)

    @classmethod
    def from_tuple(cls, tuple_):
        return cls(batch_identifier=tuple_[0])


class BatchIdentifierSchema(Schema):
    batch_identifier = fields.Str()
    data_asset_name = fields.Str()

    # noinspection PyUnusedLocal
    @post_load
    def make_batch_identifier(self, data, **kwargs):
        return BatchIdentifier(**data)


class ValidationResultIdentifier(DataContextKey):
    """A ValidationResultIdentifier identifies a validation result by the fully-qualified expectation_suite_identifier
    and run_id.
    """

    def __init__(self, expectation_suite_identifier, run_id, batch_identifier):
        """Constructs a ValidationResultIdentifier

        Args:
            expectation_suite_identifier (ExpectationSuiteIdentifier, list, tuple, or dict):
                identifying information for the fully-qualified expectation suite used to validate
            run_id (RunIdentifier): The run_id for which validation occurred
        """
        super().__init__()
        self._expectation_suite_identifier = expectation_suite_identifier
        if isinstance(run_id, str):
            warnings.warn(
                "String run_ids will be deprecated in the future. Please provide a run_id of type "
                "RunIdentifier(run_name=None, run_time=None), or a dictionary containing run_name "
                "and run_time (both optional).",
                DeprecationWarning,
            )
            try:
                run_time = parse(run_id)
            except (ValueError, TypeError):
                run_time = None
            run_id = RunIdentifier(run_name=run_id, run_time=run_time)
        elif isinstance(run_id, dict):
            run_id = RunIdentifier(**run_id)
        elif run_id is None:
            run_id = RunIdentifier()
        elif not isinstance(run_id, RunIdentifier):
            run_id = RunIdentifier(run_name=str(run_id))

        self._run_id = run_id
        self._batch_identifier = batch_identifier

    @property
    def expectation_suite_identifier(self):
        return self._expectation_suite_identifier

    @property
    def run_id(self):
        return self._run_id

    @property
    def batch_identifier(self):
        return self._batch_identifier

    def to_tuple(self):
        return tuple(
            list(self.expectation_suite_identifier.to_tuple())
            + list(self.run_id.to_tuple())
            + [self.batch_identifier or "__none__"]
        )

    def to_fixed_length_tuple(self):
        return tuple(
            [self.expectation_suite_identifier.expectation_suite_name]
            + list(self.run_id.to_tuple())
            + [self.batch_identifier or "__none__"]
        )

    @classmethod
    def from_tuple(cls, tuple_):
        return cls(
            ExpectationSuiteIdentifier.from_tuple(tuple_[0:-3]),
            RunIdentifier.from_tuple((tuple_[-3], tuple_[-2])),
            tuple_[-1],
        )

    @classmethod
    def from_fixed_length_tuple(cls, tuple_):
        return cls(
            ExpectationSuiteIdentifier(tuple_[0]),
            RunIdentifier.from_tuple((tuple_[1], tuple_[2])),
            tuple_[3],
        )

    @classmethod
    def from_object(cls, validation_result):
        batch_kwargs = validation_result.meta.get("batch_kwargs", {})
        if isinstance(batch_kwargs, IDDict):
            batch_identifier = batch_kwargs.to_id()
        elif isinstance(batch_kwargs, dict):
            batch_identifier = IDDict(batch_kwargs).to_id()
        else:
            raise DataContextError(
                "Unable to construct ValidationResultIdentifier from provided object."
            )
        return cls(
            expectation_suite_identifier=ExpectationSuiteIdentifier(
                validation_result.meta["expectation_suite_name"]
            ),
            run_id=validation_result.meta.get("run_id"),
            batch_identifier=batch_identifier,
        )


class GeCloudIdentifier(DataContextKey):
    def __init__(self, resource_type: str, ge_cloud_id: Optional[str] = None):
        super().__init__()

        self._resource_type = resource_type
        self._ge_cloud_id = ge_cloud_id if ge_cloud_id is not None else ""

    @property
    def resource_type(self):
        return self._resource_type

    @property
    def ge_cloud_id(self):
        return self._ge_cloud_id

    def to_tuple(self):
        return (self.resource_type, self.ge_cloud_id)

    def to_fixed_length_tuple(self):
        return self.to_tuple()

    @classmethod
    def from_tuple(cls, tuple_):
        return cls(resource_type=tuple_[0], ge_cloud_id=tuple_[1])

    @classmethod
    def from_fixed_length_tuple(cls, tuple_):
        return cls.from_tuple(tuple_)

    def __repr__(self):
        return f"{self.__class__.__name__}::{self.resource_type}::{self.ge_cloud_id}"


class ValidationResultIdentifierSchema(Schema):
    expectation_suite_identifier = fields.Nested(
        ExpectationSuiteIdentifierSchema,
        required=True,
        error_messages={
            "required": "expectation_suite_identifier is required for a ValidationResultIdentifier"
        },
    )
    run_id = fields.Nested(
        RunIdentifierSchema,
        required=True,
        error_messages={
            "required": "run_id is required for a " "ValidationResultIdentifier"
        },
    )
    batch_identifier = fields.Nested(BatchIdentifierSchema, required=True)

    # noinspection PyUnusedLocal
    @post_load
    def make_validation_result_identifier(self, data, **kwargs):
        return ValidationResultIdentifier(**data)


class SiteSectionIdentifier(DataContextKey):
    def __init__(self, site_section_name, resource_identifier):
        self._site_section_name = site_section_name
        if site_section_name in ["validations", "profiling"]:
            if isinstance(resource_identifier, ValidationResultIdentifier):
                self._resource_identifier = resource_identifier
            elif isinstance(resource_identifier, (tuple, list)):
                self._resource_identifier = ValidationResultIdentifier(
                    *resource_identifier
                )
            else:
                self._resource_identifier = ValidationResultIdentifier(
                    **resource_identifier
                )
        elif site_section_name == "expectations":
            if isinstance(resource_identifier, ExpectationSuiteIdentifier):
                self._resource_identifier = resource_identifier
            elif isinstance(resource_identifier, (tuple, list)):
                self._resource_identifier = ExpectationSuiteIdentifier(
                    *resource_identifier
                )
            else:
                self._resource_identifier = ExpectationSuiteIdentifier(
                    **resource_identifier
                )
        else:
            raise InvalidDataContextKeyError(
                "SiteSectionIdentifier only supports 'validations' and 'expectations' as site section names"
            )

    @property
    def site_section_name(self):
        return self._site_section_name

    @property
    def resource_identifier(self):
        return self._resource_identifier

    def to_tuple(self):
        site_section_identifier_tuple_list = [self.site_section_name] + list(
            self.resource_identifier.to_tuple()
        )
        return tuple(site_section_identifier_tuple_list)

    @classmethod
    def from_tuple(cls, tuple_):
        if tuple_[0] == "validations":
            return cls(
                site_section_name=tuple_[0],
                resource_identifier=ValidationResultIdentifier.from_tuple(tuple_[1:]),
            )
        elif tuple_[0] == "expectations":
            return cls(
                site_section_name=tuple_[0],
                resource_identifier=ExpectationSuiteIdentifier.from_tuple(tuple_[1:]),
            )
        else:
            raise InvalidDataContextKeyError(
                "SiteSectionIdentifier only supports 'validations' and 'expectations' as site section names"
            )


class ConfigurationIdentifier(DataContextKey):
    def __init__(self, configuration_key: Union[str, UUID]):
        super().__init__()
        if isinstance(configuration_key, UUID):
            configuration_key = str(configuration_key)
        if not isinstance(configuration_key, str):
            raise InvalidDataContextKeyError(
                f"configuration_key must be a string, not {type(configuration_key).__name__}"
            )
        self._configuration_key = configuration_key

    @property
    def configuration_key(self) -> str:
        return self._configuration_key

    def to_tuple(self):
        return tuple(self.configuration_key.split("."))

    def to_fixed_length_tuple(self):
        return (self.configuration_key,)

    @classmethod
    def from_tuple(cls, tuple_):
        return cls(".".join(tuple_))

    @classmethod
    def from_fixed_length_tuple(cls, tuple_):
        return cls(configuration_key=tuple_[0])

    def __repr__(self):
        return self.__class__.__name__ + "::" + self._configuration_key


class ConfigurationIdentifierSchema(Schema):
    configuration_key = fields.Str()

    # noinspection PyUnusedLocal
    @post_load
    def make_configuration_identifier(self, data, **kwargs):
        return ConfigurationIdentifier(**data)


expectationSuiteIdentifierSchema = ExpectationSuiteIdentifierSchema()
validationResultIdentifierSchema = ValidationResultIdentifierSchema()
runIdentifierSchema = RunIdentifierSchema()
batchIdentifierSchema = BatchIdentifierSchema()
configurationIdentifierSchema = ConfigurationIdentifierSchema()
