import copy
import datetime
import hashlib
import json
from typing import Dict, Optional, Union

from great_expectations.core.id_dict import BatchKwargs, BatchSpec, IDDict
from great_expectations.core.util import convert_to_json_serializable
from great_expectations.exceptions import InvalidBatchIdError
from great_expectations.types import DictDot, SerializableDictDot
from great_expectations.util import filter_properties_dict
from great_expectations.validator.validation_graph import MetricConfiguration


class BatchDefinition(SerializableDictDot):
    def __init__(
        self,
        datasource_name: str,
        data_connector_name: str,
        data_asset_name: str,
        batch_identifiers: IDDict,
        batch_spec_passthrough: Optional[dict] = None,
    ):
        self._validate_batch_definition(
            datasource_name=datasource_name,
            data_connector_name=data_connector_name,
            data_asset_name=data_asset_name,
            batch_identifiers=batch_identifiers,
        )

        assert type(batch_identifiers) == IDDict

        self._datasource_name = datasource_name
        self._data_connector_name = data_connector_name
        self._data_asset_name = data_asset_name
        self._batch_identifiers = batch_identifiers
        self._batch_spec_passthrough = batch_spec_passthrough

    def to_json_dict(self) -> Dict:
        return {
            "datasource_name": self._datasource_name,
            "data_connector_name": self._data_connector_name,
            "data_asset_name": self.data_asset_name,
            "batch_identifiers": self._batch_identifiers,
        }

    def __repr__(self) -> str:
        doc_fields_dict: dict = {
            "datasource_name": self._datasource_name,
            "data_connector_name": self._data_connector_name,
            "data_asset_name": self.data_asset_name,
            "batch_identifiers": self._batch_identifiers,
        }
        return str(doc_fields_dict)

    @staticmethod
    def _validate_batch_definition(
        datasource_name: str,
        data_connector_name: str,
        data_asset_name: str,
        batch_identifiers: IDDict,
    ):
        if datasource_name is None:
            raise ValueError("A valid datasource must be specified.")
        if datasource_name and not isinstance(datasource_name, str):
            raise TypeError(
                f"""The type of an datasource name must be a string (Python "str").  The type given is
"{str(type(datasource_name))}", which is illegal.
            """
            )
        if data_connector_name is None:
            raise ValueError("A valid data_connector must be specified.")
        if data_connector_name and not isinstance(data_connector_name, str):
            raise TypeError(
                f"""The type of a data_connector name must be a string (Python "str").  The type given is
"{str(type(data_connector_name))}", which is illegal.
                """
            )
        if data_asset_name is None:
            raise ValueError("A valid data_asset_name must be specified.")
        if data_asset_name and not isinstance(data_asset_name, str):
            raise TypeError(
                f"""The type of a data_asset name must be a string (Python "str").  The type given is
"{str(type(data_asset_name))}", which is illegal.
                """
            )
        if batch_identifiers and not isinstance(batch_identifiers, IDDict):
            raise TypeError(
                f"""The type of batch_identifiers must be a IDDict object.  The type given is
"{str(type(batch_identifiers))}", which is illegal.
                """
            )

    #         if limit and not isinstance(limit, int):
    #             raise ge_exceptions.BatchDefinitionError(
    #                 f'''The type of limit must be an integer (Python "int").  The type given is "{str(type(limit))}", which
    # is illegal.
    #                 '''
    #             )

    @property
    def datasource_name(self) -> str:
        return self._datasource_name

    @property
    def data_connector_name(self) -> str:
        return self._data_connector_name

    @property
    def data_asset_name(self) -> str:
        return self._data_asset_name

    @property
    def batch_identifiers(self) -> IDDict:
        return self._batch_identifiers

    @property
    def batch_spec_passthrough(self) -> dict:
        return self._batch_spec_passthrough

    @batch_spec_passthrough.setter
    def batch_spec_passthrough(self, batch_spec_passthrough: Optional[dict]):
        self._batch_spec_passthrough = batch_spec_passthrough

    def get_json_dict(self) -> dict:
        return convert_to_json_serializable(
            {
                "datasource_name": self.datasource_name,
                "data_connector_name": self.data_connector_name,
                "data_asset_name": self.data_asset_name,
                "batch_identifiers": self.batch_identifiers,
            }
        )

    @property
    def id(self) -> str:
        return hashlib.md5(
            json.dumps(self.get_json_dict(), sort_keys=True).encode("utf-8")
        ).hexdigest()

    def __eq__(self, other):
        if not isinstance(other, self.__class__):
            # Delegate comparison to the other instance's __eq__.
            return NotImplemented
        return self.id == other.id

    def __str__(self):
        return json.dumps(self.get_json_dict(), indent=2)

    def __hash__(self) -> int:
        """Overrides the default implementation"""
        _result_hash: int = (
            hash(self.datasource_name)
            ^ hash(self.data_connector_name)
            ^ hash(self.data_asset_name)
        )
        if self.batch_identifiers is not None:
            for key, value in self.batch_identifiers.items():
                _result_hash = _result_hash ^ hash(key) ^ hash(str(value))
        return _result_hash


class BatchRequestBase(DictDot):
    """
    This class is for internal inter-object protocol purposes only.
    As such, it contains all attributes of a batch_request, but does not validate them.
    See the BatchRequest class, which extends BatchRequestBase and validates the attributes.

    BatchRequestBase is used for the internal protocol purposes exclusively, not part of API for the developer users.

    Previously, the very same BatchRequest was used for both the internal protocol purposes and as part of the API
    exposed to developers.  However, while convenient for internal data interchange, using the same BatchRequest class
    as arguments to the externally-exported DataContext.get_batch(), DataContext.get_batch_list(), and
    DataContext.get_validator() API calls for obtaining batches and/or validators was insufficiently expressive to
    fulfill the needs of both. In the user-accessible API, BatchRequest, must enforce that all members of the triple,
    consisting of data_source_name, data_connector_name, and data_asset_name, are not NULL.  Whereas for the internal
    protocol, BatchRequest is used as a flexible bag of attributes, in which any fields are allowed to be NULL.  Hence,
    now, BatchRequestBase is dedicated for the use as the bag oof attributes for the internal protocol use, whereby NULL
    values are allowed as per the internal needs.  The BatchRequest class extends BatchRequestBase and adds to it strong
    validation (described above plus additional attribute validation) so as to formally validate user specified fields.
    """

    def __init__(
        self,
        datasource_name: str,
        data_connector_name: str,
        data_asset_name: str,
        data_connector_query: Optional[Union[IDDict, dict]] = None,
        limit: Optional[int] = None,
        batch_spec_passthrough: Optional[dict] = None,
        runtime_parameters: Optional[dict] = None,
        batch_identifiers: Optional[dict] = None,
    ):
        self._datasource_name = datasource_name
        self._data_connector_name = data_connector_name
        self._data_asset_name = data_asset_name
        self._data_connector_query = data_connector_query
        self._limit = limit

        self._batch_spec_passthrough = batch_spec_passthrough
        self._runtime_parameters = runtime_parameters
        self._batch_identifiers = batch_identifiers

    @property
    def runtime_parameters(self) -> dict:
        return self._runtime_parameters

    @property
    def batch_identifiers(self) -> dict:
        return self._batch_identifiers

    @property
    def datasource_name(self) -> str:
        return self._datasource_name

    @property
    def data_connector_name(self) -> str:
        return self._data_connector_name

    @property
    def data_asset_name(self) -> str:
        return self._data_asset_name

    @data_asset_name.setter
    def data_asset_name(self, data_asset_name):
        self._data_asset_name = data_asset_name

    @property
    def data_connector_query(
        self,
    ) -> Union[IDDict, dict]:
        return self._data_connector_query

    @property
    def limit(self) -> int:
        return self._limit

    @property
    def batch_spec_passthrough(self) -> dict:
        return self._batch_spec_passthrough

    def get_json_dict(self) -> dict:
        data_connector_query: Optional[dict] = None
        if self.data_connector_query is not None:
            data_connector_query = copy.deepcopy(self.data_connector_query)
            if data_connector_query.get("custom_filter_function") is not None:
                data_connector_query["custom_filter_function"] = data_connector_query[
                    "custom_filter_function"
                ].__name__
        json_dict: dict = {
            "datasource_name": self.datasource_name,
            "data_connector_name": self.data_connector_name,
            "data_asset_name": self.data_asset_name,
            "data_connector_query": data_connector_query,
        }

        if self.batch_spec_passthrough is not None:
            json_dict["batch_spec_passthrough"] = self.batch_spec_passthrough
        if self.limit is not None:
            json_dict["limit"] = self.limit
        if self.batch_identifiers is not None:
            json_dict["batch_identifiers"] = self.batch_identifiers
        if self.runtime_parameters is not None:
            json_dict["runtime_parameters"] = self.runtime_parameters
            if json_dict["runtime_parameters"].get("batch_data") is not None:
                json_dict["runtime_parameters"]["batch_data"] = str(
                    type(json_dict["runtime_parameters"]["batch_data"])
                )

        filter_properties_dict(properties=json_dict, clean_falsy=True, inplace=True)

        return json_dict

    def __str__(self):
        return json.dumps(self.get_json_dict(), indent=2)

    @property
    def id(self) -> str:
        return hashlib.md5(
            json.dumps(self.get_json_dict(), sort_keys=True).encode("utf-8")
        ).hexdigest()

    def __eq__(self, other):
        if not isinstance(other, self.__class__):
            # Delegate comparison to the other instance's __eq__.
            return NotImplemented
        return self.id == other.id


class BatchRequest(BatchRequestBase):
    """
    This class contains all attributes of a batch_request.  See the comments in BatchRequestBase for design specifics.
    limit: refers to the number of batches requested (not rows per batch)
    """

    def __init__(
        self,
        datasource_name: str,
        data_connector_name: str,
        data_asset_name: str,
        data_connector_query: Optional[Union[IDDict, dict]] = None,
        limit: Optional[int] = None,
        batch_spec_passthrough: Optional[dict] = None,
    ):
        self._validate_init_parameters(
            datasource_name=datasource_name,
            data_connector_name=data_connector_name,
            data_asset_name=data_asset_name,
            data_connector_query=data_connector_query,
            limit=limit,
        )
        super().__init__(
            datasource_name=datasource_name,
            data_connector_name=data_connector_name,
            data_asset_name=data_asset_name,
            data_connector_query=data_connector_query,
            limit=limit,
            batch_spec_passthrough=batch_spec_passthrough,
        )

    @staticmethod
    def _validate_init_parameters(
        datasource_name: str,
        data_connector_name: str,
        data_asset_name: str,
        data_connector_query: Optional[Union[IDDict, dict]] = None,
        limit: Optional[int] = None,
    ):
        # TODO test and check all logic in this validator!
        if not (datasource_name and isinstance(datasource_name, str)):
            raise TypeError(
                f"""The type of an datasource name must be a string (Python "str").  The type given is
"{str(type(datasource_name))}", which is illegal.
            """
            )
        if not (data_connector_name and isinstance(data_connector_name, str)):
            raise TypeError(
                f"""The type of data_connector name must be a string (Python "str").  The type given is
"{str(type(data_connector_name))}", which is illegal.
                """
            )
        if not (data_asset_name and isinstance(data_asset_name, str)):
            raise TypeError(
                f"""The type of data_asset name must be a string (Python "str").  The type given is
        "{str(type(data_asset_name))}", which is illegal.
                        """
            )
        # TODO Abe 20201015: Switch this to DataConnectorQuery.
        if data_connector_query and not isinstance(
            data_connector_query, (dict, IDDict)
        ):
            raise TypeError(
                f"""The type of data_connector_query must be a dict or IDDict object.  The type given is
"{str(type(data_connector_query))}", which is illegal.
                """
            )
        if limit and not isinstance(limit, int):
            raise TypeError(
                f"""The type of limit must be an integer (Python "int").  The type given is "{str(type(limit))}", which
is illegal.
                """
            )

    @staticmethod
    def _validate_runtime_batch_request_specific_init_parameters(
        runtime_parameters: Union[IDDict, dict],
        batch_identifiers: Union[IDDict, dict],
        batch_spec_passthrough: Optional[dict] = None,
    ):
        if not (
            runtime_parameters and (isinstance(runtime_parameters, (dict, IDDict)))
        ):
            raise TypeError(
                f"""The type for runtime_parameters must be dict or IDDict.
                The type given is "{str(type(runtime_parameters))}", which is illegal."""
            )

        if not (batch_identifiers and isinstance(batch_identifiers, (dict, IDDict))):
            raise TypeError(
                f"""The type for batch_identifiers must be a dict or IDDict, with keys being identifiers defined in the
                data connector configuration.  The type given is "{str(type(batch_identifiers))}", which is illegal."""
            )

        if batch_spec_passthrough and not (
            isinstance(batch_spec_passthrough, (dict, IDDict))
        ):
            raise TypeError(
                f"""The type for batch_spec_passthrough must be a dict or IDDict. The type given is "{str(type(batch_spec_passthrough))}", which is illegal."""
            )


class RuntimeBatchRequest(BatchRequest):
    def __init__(
        self,
        datasource_name: str,
        data_connector_name: str,
        data_asset_name: str,
        runtime_parameters: dict,
        batch_identifiers: dict,
        batch_spec_passthrough: Optional[dict] = None,
    ):
        super().__init__(
            datasource_name=datasource_name,
            data_connector_name=data_connector_name,
            data_asset_name=data_asset_name,
            batch_spec_passthrough=batch_spec_passthrough,
        )

        self._validate_runtime_batch_request_specific_init_parameters(
            runtime_parameters, batch_identifiers, batch_spec_passthrough
        )
        self._runtime_parameters = runtime_parameters
        self._batch_identifiers = batch_identifiers


# TODO: <Alex>The following class is to support the backward compatibility with the legacy design.</Alex>
class BatchMarkers(BatchKwargs):
    """A BatchMarkers is a special type of BatchKwargs (so that it has a batch_fingerprint) but it generally does
    NOT require specific keys and instead captures information about the OUTPUT of a datasource's fetch
    process, such as the timestamp at which a query was executed."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if "ge_load_time" not in self:
            raise InvalidBatchIdError("BatchMarkers requires a ge_load_time")

    @property
    def ge_load_time(self):
        return self.get("ge_load_time")


# TODO: <Alex>This module needs to be cleaned up.
#  We have Batch used for the legacy design, and we also need Batch for the new design.
#  However, right now, the Batch from the legacy design is imported into execution engines of the new design.
#  As a result, we have multiple, inconsistent versions of BatchMarkers, extending legacy/new classes.</Alex>
# TODO: <Alex>See also "great_expectations/datasource/types/batch_spec.py".</Alex>
class Batch(DictDot):
    def __init__(
        self,
        data,
        batch_request: BatchRequest = None,
        batch_definition: BatchDefinition = None,
        batch_spec: BatchSpec = None,
        batch_markers: BatchMarkers = None,
        # The remaining parameters are for backward compatibility.
        data_context=None,
        datasource_name=None,
        batch_parameters=None,
        batch_kwargs=None,
    ):
        self._data = data
        if batch_request is None:
            batch_request = {}
        self._batch_request = batch_request
        if batch_definition is None:
            batch_definition = IDDict()
        self._batch_definition = batch_definition
        if batch_spec is None:
            batch_spec = BatchSpec()
        self._batch_spec = batch_spec

        if batch_markers is None:
            batch_markers = BatchMarkers(
                {
                    "ge_load_time": datetime.datetime.now(
                        datetime.timezone.utc
                    ).strftime("%Y%m%dT%H%M%S.%fZ")
                }
            )
        self._batch_markers = batch_markers

        # The remaining parameters are for backward compatibility.
        self._data_context = data_context
        self._datasource_name = datasource_name
        self._batch_parameters = batch_parameters
        self._batch_kwargs = batch_kwargs or BatchKwargs()

    @property
    def data(self):
        return self._data

    @property
    def batch_request(self):
        return self._batch_request

    @batch_request.setter
    def batch_request(self, batch_request):
        self._batch_request = batch_request

    @property
    def batch_definition(self):
        return self._batch_definition

    @batch_definition.setter
    def batch_definition(self, batch_definition):
        self._batch_definition = batch_definition

    @property
    def batch_spec(self):
        return self._batch_spec

    @property
    def batch_markers(self):
        return self._batch_markers

    # The remaining properties are for backward compatibility.
    @property
    def data_context(self):
        return self._data_context

    @property
    def datasource_name(self):
        return self._datasource_name

    @property
    def batch_parameters(self):
        return self._batch_parameters

    @property
    def batch_kwargs(self):
        return self._batch_kwargs

    @property
    def id(self):
        batch_definition = self._batch_definition
        return (
            batch_definition.id
            if isinstance(batch_definition, BatchDefinition)
            else batch_definition.to_id()
        )

    def __str__(self):
        json_dict = {
            "data": str(self.data),
            "batch_request": self.batch_request.get_json_dict(),
            "batch_definition": self.batch_definition.get_json_dict()
            if isinstance(self.batch_definition, BatchDefinition)
            else {},
            "batch_spec": str(self.batch_spec),
            "batch_markers": str(self.batch_markers),
        }
        return json.dumps(json_dict, indent=2)

    def head(self, n_rows=5, fetch_all=False):
        # FIXME - we should use a Validator after resolving circularity
        # Validator(self._data.execution_engine, batches=(self,)).get_metric(MetricConfiguration("table.head", {"batch_id": self.id}, {"n_rows": n_rows, "fetch_all": fetch_all}))
        metric = MetricConfiguration(
            "table.head",
            {"batch_id": self.id},
            {"n_rows": n_rows, "fetch_all": fetch_all},
        )
        return self._data.execution_engine.resolve_metrics((metric,))[metric.id]
