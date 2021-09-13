import json
from copy import deepcopy
from typing import Dict, List, Optional, Union

from great_expectations.core.expectation_validation_result import (
    ExpectationSuiteValidationResult,
)
from great_expectations.core.run_identifier import RunIdentifier, RunIdentifierSchema
from great_expectations.core.util import convert_to_json_serializable
from great_expectations.data_context.types.base import (
    CheckpointConfig,
    CheckpointConfigSchema,
)
from great_expectations.data_context.types.resource_identifiers import (
    ValidationResultIdentifier,
)
from great_expectations.marshmallow__shade import Schema, fields, post_load, pre_dump
from great_expectations.types import DictDot


class CheckpointResult(DictDot):
    """
    The run_results property forms the backbone of this type and defines the basic contract for what a checkpoint's
    run method returns. It is a dictionary where the top-level keys are the ValidationResultIdentifiers of
    the validation results generated in the run. Each value is a dictionary having at minimum,
    a "validation_result" key containing an ExpectationSuiteValidationResult and an "actions_results" key
    containing a dictionary where the top-level keys are names of actions performed after that particular
    validation, with values containing any relevant outputs of that action (at minimum and in many cases,
    this would just be a dictionary with the action's class_name).

    The run_results dictionary can contain other keys that are relevant for a specific checkpoint
    implementation. For example, the run_results dictionary from a WarningAndFailureExpectationSuiteCheckpoint
    might have an extra key named "expectation_suite_severity_level" to indicate if the suite is at either a
    "warning" or "failure" level.

    e.g.
    {
        ValidationResultIdentifier: {
            "validation_result": ExpectationSuiteValidationResult,
            "actions_results": {
                "my_action_name_that_stores_validation_results": {
                    "class": "StoreValidationResultAction"
                }
            }
        }
    }
    """

    # JC: I think this needs to be changed to be an instance of a new type called CheckpointResult,
    # which would include the top-level keys run_id, config, name, and a list of results.

    def __init__(
        self,
        run_id: RunIdentifier,
        run_results: Dict[
            ValidationResultIdentifier,
            Dict[str, Union[ExpectationSuiteValidationResult, dict, str]],
        ],
        checkpoint_config: CheckpointConfig,
        success: Optional[bool] = None,
    ) -> None:
        self._run_id = run_id
        self._run_results = run_results
        self._checkpoint_config = checkpoint_config
        if success is None:
            self._success = all(
                [
                    run_result["validation_result"].success
                    for run_result in run_results.values()
                ]
            )
        else:
            self._success = success

        self._validation_results = None
        self._data_assets_validated = None
        self._data_assets_validated_by_batch_id = None
        self._validation_result_identifiers = None
        self._expectation_suite_names = None
        self._data_asset_names = None
        self._validation_results_by_expectation_suite_name = None
        self._validation_results_by_data_asset_name = None
        self._batch_identifiers = None
        self._statistics = None
        self._validation_statistics = None
        self._validation_results_by_validation_result_identifier = None

    @property
    def name(self):
        return self.checkpoint_config.name

    @property
    def checkpoint_config(self) -> CheckpointConfig:
        return self._checkpoint_config

    @property
    def run_results(
        self,
    ) -> Dict[
        ValidationResultIdentifier,
        Dict[str, Union[ExpectationSuiteValidationResult, dict]],
    ]:
        return self._run_results

    @property
    def run_id(self) -> RunIdentifier:
        return self._run_id

    @property
    def success(self) -> bool:
        return self._success

    def list_batch_identifiers(self) -> List[str]:
        if self._batch_identifiers is None:
            self._batch_identifiers = list(
                {
                    validation_result_identifier.batch_identifier
                    for validation_result_identifier in self.list_validation_result_identifiers()
                }
            )
        return self._batch_identifiers

    def list_data_asset_names(self) -> List[str]:
        if self._data_asset_names is None:
            self._data_asset_names = list(
                {
                    data_asset["batch_definition"].data_asset_name or "__none__"
                    for data_asset in self.list_data_assets_validated()
                }
            )
        return self._data_asset_names

    def list_expectation_suite_names(self) -> List[str]:
        if self._expectation_suite_names is None:
            self._expectation_suite_names = list(
                {
                    validation_result_identifier.expectation_suite_identifier.expectation_suite_name
                    for validation_result_identifier in self.run_results.keys()
                }
            )
        return self._expectation_suite_names

    def list_validation_result_identifiers(self) -> List[ValidationResultIdentifier]:
        if self._validation_result_identifiers is None:
            self._validation_result_identifiers = list(self._run_results.keys())
        return self._validation_result_identifiers

    def list_validation_results(
        self, group_by=None
    ) -> Union[List[ExpectationSuiteValidationResult], dict]:
        if group_by is None:
            if self._validation_results is None:
                self._validation_results = [
                    run_result["validation_result"]
                    for run_result in self.run_results.values()
                ]
            return self._validation_results
        elif group_by == "validation_result_identifier":
            return self._list_validation_results_by_validation_result_identifier()
        elif group_by == "expectation_suite_name":
            return self._list_validation_results_by_expectation_suite_name()
        elif group_by == "data_asset_name":
            return self._list_validation_results_by_data_asset_name()

    def _list_validation_results_by_validation_result_identifier(self) -> dict:
        if self._validation_results_by_validation_result_identifier is None:
            self._validation_results_by_validation_result_identifier = {
                validation_result_identifier: run_result["validation_result"]
                for validation_result_identifier, run_result in self.run_results.items()
            }
        return self._validation_results_by_validation_result_identifier

    def _list_validation_results_by_expectation_suite_name(self) -> dict:
        if self._validation_results_by_expectation_suite_name is None:
            self._validation_results_by_expectation_suite_name = {
                expectation_suite_name: [
                    run_result["validation_result"]
                    for run_result in self.run_results.values()
                    if run_result["validation_result"].meta["expectation_suite_name"]
                    == expectation_suite_name
                ]
                for expectation_suite_name in self.list_expectation_suite_names()
            }
        return self._validation_results_by_expectation_suite_name

    def _list_validation_results_by_data_asset_name(self) -> dict:
        if self._validation_results_by_data_asset_name is None:
            validation_results_by_data_asset_name = {}
            for data_asset_name in self.list_data_asset_names():
                if data_asset_name == "__none__":
                    validation_results_by_data_asset_name[data_asset_name] = [
                        data_asset["validation_results"]
                        for data_asset in self.list_data_assets_validated()
                        if data_asset["batch_definition"].data_asset_name is None
                    ]
                else:
                    validation_results_by_data_asset_name[data_asset_name] = [
                        data_asset["validation_results"]
                        for data_asset in self.list_data_assets_validated()
                        if data_asset["batch_definition"].data_asset_name
                        == data_asset_name
                    ]
            self._validation_results_by_data_asset_name = (
                validation_results_by_data_asset_name
            )
        return self._validation_results_by_data_asset_name

    def list_data_assets_validated(
        self, group_by: str = None
    ) -> Union[List[dict], dict]:
        if group_by is None:
            if self._data_assets_validated is None:
                self._data_assets_validated = list(
                    self._list_data_assets_validated_by_batch_id().values()
                )
            return self._data_assets_validated
        if group_by == "batch_id":
            return self._list_data_assets_validated_by_batch_id()

    def _list_data_assets_validated_by_batch_id(self) -> dict:
        if self._data_assets_validated_by_batch_id is None:
            assets_validated_by_batch_id = {}

            for validation_result in self.list_validation_results():
                active_batch_definition = validation_result.meta[
                    "active_batch_definition"
                ]
                batch_id = active_batch_definition.id
                expectation_suite_name = validation_result.meta[
                    "expectation_suite_name"
                ]
                if batch_id not in assets_validated_by_batch_id:
                    assets_validated_by_batch_id[batch_id] = {
                        "batch_definition": active_batch_definition,
                        "validation_results": [validation_result],
                        "expectation_suite_names": [expectation_suite_name],
                    }
                else:
                    assets_validated_by_batch_id[batch_id]["validation_results"].append(
                        validation_result
                    )
                    assets_validated_by_batch_id[batch_id][
                        "expectation_suite_names"
                    ].append(expectation_suite_name)
            self._data_assets_validated_by_batch_id = assets_validated_by_batch_id
        return self._data_assets_validated_by_batch_id

    def get_statistics(self) -> dict:
        if self._statistics is None:
            data_asset_count = len(self.list_data_assets_validated())
            validation_result_count = len(self.list_validation_results())
            successful_validation_count = len(
                [
                    validation_result
                    for validation_result in self.list_validation_results()
                    if validation_result.success
                ]
            )
            unsuccessful_validation_count = (
                validation_result_count - successful_validation_count
            )
            successful_validation_percent = (
                validation_result_count
                and (successful_validation_count / validation_result_count) * 100
            )

            self._statistics = {
                "data_asset_count": data_asset_count,
                "validation_result_count": validation_result_count,
                "successful_validation_count": successful_validation_count,
                "unsuccessful_validation_count": unsuccessful_validation_count,
                "successful_validation_percent": successful_validation_percent,
                "validation_statistics": self._list_validation_statistics(),
            }

        return self._statistics

    def _list_validation_statistics(self) -> Dict[ValidationResultIdentifier, dict]:
        if self._validation_statistics is None:
            self._validation_statistics = {
                validation_result_identifier: run_result["validation_result"].statistics
                for validation_result_identifier, run_result in self.run_results.items()
            }
        return self._validation_statistics

    def to_json_dict(self):
        return checkpointResultSchema.dump(self)

    def __repr__(self):
        return json.dumps(self.to_json_dict(), indent=2)


class CheckpointResultSchema(Schema):
    # JC: I think this needs to be changed to be an instance of a new type called CheckpointResult,
    # which would include the top-level keys run_id, config, name, and a list of results.
    run_id = fields.Nested(RunIdentifierSchema)
    run_results = fields.Dict()
    checkpoint_config = fields.Nested(CheckpointConfigSchema)
    success = fields.Bool()

    # noinspection PyUnusedLocal
    @pre_dump
    def prepare_dump(self, data, **kwargs):
        data = deepcopy(data)
        data._run_results = convert_to_json_serializable(data.run_results)
        return data

    # noinspection PyUnusedLocal
    @post_load
    def make_checkpoint_result(self, data, **kwargs):
        return CheckpointResult(**data)


checkpointResultSchema = CheckpointResultSchema()
