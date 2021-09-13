import datetime
import json
import warnings

from dateutil.parser import parse

from great_expectations.core.data_context_key import DataContextKey
from great_expectations.marshmallow__shade import Schema, fields, post_load


class RunIdentifier(DataContextKey):
    """A RunIdentifier identifies a run (collection of validations) by run_name and run_time."""

    def __init__(self, run_name=None, run_time=None):
        super().__init__()
        assert run_name is None or isinstance(
            run_name, str
        ), "run_name must be an instance of str"
        assert run_time is None or isinstance(run_time, (datetime.datetime, str)), (
            "run_time must be either None or " "an instance of str or datetime"
        )
        self._run_name = run_name

        if isinstance(run_time, str):
            try:
                run_time = parse(run_time)
            except (ValueError, TypeError):
                warnings.warn(
                    f'Unable to parse provided run_time str ("{run_time}") to datetime. Defaulting '
                    f"run_time to current time."
                )
                run_time = datetime.datetime.now(datetime.timezone.utc)

        if not run_time:
            try:
                run_time = parse(run_name)
            except (ValueError, TypeError):
                run_time = None

        run_time = run_time or datetime.datetime.now(datetime.timezone.utc)
        if not run_time.tzinfo:
            # this takes the given time and just adds timezone (no conversion)
            run_time = run_time.replace(tzinfo=datetime.timezone.utc)
        else:
            # this takes given time and converts to utc
            run_time = run_time.astimezone(tz=datetime.timezone.utc)
        self._run_time = run_time

    @property
    def run_name(self):
        return self._run_name

    @property
    def run_time(self):
        return self._run_time

    def to_tuple(self):
        return (
            self._run_name or "__none__",
            self._run_time.strftime("%Y%m%dT%H%M%S.%fZ"),
        )

    def to_fixed_length_tuple(self):
        return (
            self._run_name or "__none__",
            self._run_time.strftime("%Y%m%dT%H%M%S.%fZ"),
        )

    def __repr__(self):
        return json.dumps(self.to_json_dict())

    def __str__(self):
        return json.dumps(self.to_json_dict(), indent=2)

    def to_json_dict(self):
        myself = runIdentifierSchema.dump(self)
        return myself

    @classmethod
    def from_tuple(cls, tuple_):
        return cls(tuple_[0], tuple_[1])

    @classmethod
    def from_fixed_length_tuple(cls, tuple_):
        return cls(tuple_[0], tuple_[1])


class RunIdentifierSchema(Schema):
    run_name = fields.Str()
    run_time = fields.DateTime(format="iso")

    @post_load
    def make_run_identifier(self, data, **kwargs):
        return RunIdentifier(**data)


runIdentifierSchema = RunIdentifierSchema()
