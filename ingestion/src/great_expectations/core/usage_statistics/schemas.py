###
# These schemas are used to ensure that we *never* take unexpected usage stats message and provide full transparency
# about usage statistics. Please reach out to the Great Expectations with any questions!
###


# An anonymized string *must* be an md5 hash, so must have exactly 32 characters
anonymized_string_schema = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "string",
    "minLength": 32,
    "maxLength": 32,
}

anonymized_class_info_schema = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "title": "anonymized-class-info",
    "definitions": {"anonymized_string": anonymized_string_schema},
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "anonymized_name": {"$ref": "#/definitions/anonymized_string"},
                "parent_class": {"type": "string", "maxLength": 256},
                "anonymized_class": {"$ref": "#/definitions/anonymized_string"},
            },
            "additionalProperties": True,
            # we don't want this to be true, but this is required to allow show_cta_footer
            # Note AJB-20201218 show_cta_footer was removed in v 0.9.9 via PR #1249
            "required": ["parent_class"],
        }
    ],
}

anonymized_datasource_schema = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "title": "anonymized-datasource",
    "definitions": {
        "anonymized_string": anonymized_string_schema,
        "anonymized_class_info": anonymized_class_info_schema,
    },
    "anyOf": [
        # v2 (Batch Kwargs) API:
        {
            "type": "object",
            "properties": {
                "anonymized_name": {"$ref": "#/definitions/anonymized_string"},
                "parent_class": {"type": "string", "maxLength": 256},
                "anonymized_class": {"$ref": "#/definitions/anonymized_string"},
                "sqlalchemy_dialect": {"type": "string", "maxLength": 256},
            },
            "additionalProperties": False,
            "required": ["parent_class", "anonymized_name"],
        },
        # v3 (Batch Request) API:
        {
            "type": "object",
            "properties": {
                "anonymized_name": {"$ref": "#/definitions/anonymized_string"},
                "parent_class": {"type": "string", "maxLength": 256},
                "anonymized_class": {"$ref": "#/definitions/anonymized_string"},
                "sqlalchemy_dialect": {"type": "string", "maxLength": 256},
                "anonymized_execution_engine": {
                    "$ref": "#/definitions/anonymized_class_info"
                },
                "anonymized_data_connectors": {
                    "type": "array",
                    "maxItems": 1000,
                    "items": {"$ref": "#/definitions/anonymized_class_info"},
                },
            },
            "additionalProperties": False,
            "required": ["parent_class", "anonymized_name"],
        },
    ],
}

anonymized_store_schema = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "title": "anonymized-store",
    "definitions": {
        "anonymized_string": anonymized_string_schema,
        "anonymized_class_info": anonymized_class_info_schema,
    },
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "anonymized_name": {"$ref": "#/definitions/anonymized_string"},
                "parent_class": {"type": "string", "maxLength": 256},
                "anonymized_class": {"$ref": "#/definitions/anonymized_string"},
                "anonymized_store_backend": {
                    "$ref": "#/definitions/anonymized_class_info"
                },
            },
            "additionalProperties": False,
            "required": ["parent_class", "anonymized_name"],
        }
    ],
}

anonymized_action_schema = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "title": "anonymized-action",
    "definitions": {"anonymized_string": anonymized_string_schema},
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "anonymized_name": {"$ref": "#/definitions/anonymized_string"},
                "parent_class": {"type": "string", "maxLength": 256},
                "anonymized_class": {"$ref": "#/definitions/anonymized_string"},
            },
            "additionalProperties": False,
            "required": ["parent_class", "anonymized_name"],
        }
    ],
}

anonymized_validation_operator_schema = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "title": "anonymized-validation-operator",
    "definitions": {
        "anonymized_string": anonymized_string_schema,
        "anonymized_action": anonymized_action_schema,
    },
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "anonymized_name": {"$ref": "#/definitions/anonymized_string"},
                "parent_class": {"type": "string", "maxLength": 256},
                "anonymized_class": {"$ref": "#/definitions/anonymized_string"},
                "anonymized_action_list": {
                    "type": "array",
                    "maxItems": 1000,
                    "items": {"$ref": "#/definitions/anonymized_action"},
                },
            },
            "additionalProperties": False,
            "required": ["parent_class", "anonymized_name"],
        }
    ],
}

empty_payload_schema = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "properties": {},
    "additionalProperties": False,
}

anonymized_data_docs_site_schema = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "title": "anonymized-data-docs-site",
    "definitions": {
        "anonymized_string": anonymized_string_schema,
        "anonymized_class_info": anonymized_class_info_schema,
    },
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "anonymized_name": {"$ref": "#/definitions/anonymized_string"},
                "parent_class": {"type": "string", "maxLength": 256},
                "anonymized_class": {"$ref": "#/definitions/anonymized_string"},
                "anonymized_store_backend": {
                    "$ref": "#/definitions/anonymized_class_info"
                },
                "anonymized_site_index_builder": {
                    "$ref": "#/definitions/anonymized_class_info"
                },
            },
            "additionalProperties": False,
            "required": ["parent_class", "anonymized_name"],
        }
    ],
}

anonymized_expectation_suite_schema = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "title": "anonymized-expectation-suite-schema",
    "definitions": {"anonymized_string": anonymized_string_schema},
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "anonymized_name": {"$ref": "#/definitions/anonymized_string"},
                "expectation_count": {"type": "number"},
                "anonymized_expectation_type_counts": {"type": "object"},
            },
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "anonymized_name": {"$ref": "#/definitions/anonymized_string"},
                "expectation_count": {"type": "number"},
                "anonymized_expectation_counts": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "expectation_type": {"type": "string"},
                            "anonymized_expectation_type": {
                                "$ref": "#/definitions/anonymized_string"
                            },
                            "count": {"type": "number"},
                        },
                    },
                },
            },
            "additionalProperties": False,
        },
    ],
}

init_payload_schema = {
    "$schema": "https://json-schema.org/schema#",
    "definitions": {
        "anonymized_string": anonymized_string_schema,
        "anonymized_class_info": anonymized_class_info_schema,
        "anonymized_datasource": anonymized_datasource_schema,
        "anonymized_validation_operator": anonymized_validation_operator_schema,
        "anonymized_data_docs_site": anonymized_data_docs_site_schema,
        "anonymized_store": anonymized_store_schema,
        "anonymized_action": anonymized_action_schema,
        "anonymized_expectation_suite": anonymized_expectation_suite_schema,
    },
    "type": "object",
    "properties": {
        "version": {"enum": ["1.0.0"]},
        "platform.system": {"type": "string", "maxLength": 256},
        "platform.release": {"type": "string", "maxLength": 256},
        "version_info": {"type": "string", "maxLength": 256},
        "anonymized_datasources": {
            "type": "array",
            "maxItems": 1000,
            "items": {"$ref": "#/definitions/anonymized_datasource"},
        },
        "anonymized_stores": {
            "type": "array",
            "maxItems": 1000,
            "items": {"$ref": "#/definitions/anonymized_store"},
        },
        "anonymized_validation_operators": {
            "type": "array",
            "maxItems": 1000,
            "items": {"$ref": "#/definitions/anonymized_validation_operator"},
        },
        "anonymized_data_docs_sites": {
            "type": "array",
            "maxItems": 1000,
            "items": {"$ref": "#/definitions/anonymized_data_docs_site"},
        },
        "anonymized_expectation_suites": {
            "type": "array",
            "items": {"$ref": "#/definitions/anonymized_expectation_suite"},
        },
    },
    "required": [
        "platform.system",
        "platform.release",
        "version_info",
        "anonymized_datasources",
        "anonymized_stores",
        "anonymized_data_docs_sites",
        "anonymized_expectation_suites",
    ],
    "additionalProperties": False,
}

anonymized_batch_schema = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "title": "anonymized-batch",
    "definitions": {"anonymized_string": anonymized_string_schema},
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "anonymized_batch_kwarg_keys": {
                    "type": "array",
                    "maxItems": 1000,
                    "items": {"oneOf": [{"type": "string", "maxLength": 256}]},
                },
                "anonymized_expectation_suite_name": {
                    "$ref": "#/definitions/anonymized_string"
                },
                "anonymized_datasource_name": {
                    "$ref": "#/definitions/anonymized_string"
                },
            },
            "additionalProperties": False,
            "required": [
                "anonymized_batch_kwarg_keys",
                "anonymized_expectation_suite_name",
                "anonymized_datasource_name",
            ],
        }
    ],
}

run_validation_operator_payload_schema = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "definitions": {
        "anonymized_string": anonymized_string_schema,
        "anonymized_batch": anonymized_batch_schema,
    },
    "type": "object",
    "properties": {
        "anonymized_operator_name": {"$ref": "#/definitions/anonymized_string"},
        "anonymized_batches": {
            "type": "array",
            "maxItems": 1000,
            "items": {"$ref": "#/definitions/anonymized_batch"},
        },
    },
    "required": ["anonymized_operator_name"],
    "additionalProperties": False,
}

save_or_edit_expectation_suite_payload_schema = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "definitions": {"anonymized_string": anonymized_string_schema},
    "type": "object",
    "properties": {
        "anonymized_expectation_suite_name": {
            "$ref": "#/definitions/anonymized_string"
        },
    },
    "required": ["anonymized_expectation_suite_name"],
    "additionalProperties": False,
}

cli_suite_expectation_suite_payload_schema = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "definitions": {"anonymized_string": anonymized_string_schema},
    "type": "object",
    "properties": {
        "anonymized_expectation_suite_name": {
            "$ref": "#/definitions/anonymized_string"
        },
        "api_version": {"type": "string", "maxLength": 256},
        "cancelled": {
            "type": ["boolean", "null"],
        },
    },
    "required": ["anonymized_expectation_suite_name"],
    "additionalProperties": False,
}

cli_payload_schema = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "title": "cli-payload",
    "type": "object",
    "properties": {
        "api_version": {
            "type": "string",
            "maxLength": 256,
        },
        "cancelled": {
            "type": ["boolean", "null"],
        },
    },
    "additionalProperties": False,
}

cli_new_ds_choice_payload_schema = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "properties": {
        "type": {"type": "string", "maxLength": 256},
        "db": {"type": "string", "maxLength": 256},
        "api_version": {"type": "string", "maxLength": 256},
    },
    "required": ["type"],
    "additionalProperties": False,
}


datasource_sqlalchemy_connect_payload = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "properties": {
        "anonymized_name": {"type": "string", "maxLength": 256},
        "sqlalchemy_dialect": {"type": "string", "maxLength": 256},
    },
    "required": ["anonymized_name"],
    "additionalProperties": False,
}

test_yaml_config_payload_schema = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "title": "test-yaml-config",
    "definitions": {
        "anonymized_string": anonymized_string_schema,
        "anonymized_class_info": anonymized_class_info_schema,
    },
    "type": "object",
    "properties": {
        "anonymized_name": {"$ref": "#/definitions/anonymized_string"},
        "parent_class": {"type": "string", "maxLength": 256},
        "anonymized_class": {"$ref": "#/definitions/anonymized_string"},
        "diagnostic_info": {
            "type": "array",
            "maxItems": 1000,
            "items": {
                "enum": [
                    "__substitution_error__",
                    "__yaml_parse_error__",
                    "__custom_subclass_not_core_ge__",
                    "__class_name_not_provided__",
                ],
            },
        },
        # Store
        "anonymized_store_backend": {"$ref": "#/definitions/anonymized_class_info"},
        # Datasource v2 (Batch Kwargs) API & v3 (Batch Request) API:
        "sqlalchemy_dialect": {"type": "string", "maxLength": 256},
        # Datasource v3 (Batch Request) API only:
        "anonymized_execution_engine": {"$ref": "#/definitions/anonymized_class_info"},
        "anonymized_data_connectors": {
            "type": "array",
            "maxItems": 1000,
            "items": {"$ref": "#/definitions/anonymized_class_info"},
        },
    },
    "additionalProperties": False,
}

usage_statistics_record_schema = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "definitions": {
        "anonymized_string": anonymized_string_schema,
        "anonymized_datasource": anonymized_datasource_schema,
        "anonymized_store": anonymized_store_schema,
        "anonymized_class_info": anonymized_class_info_schema,
        "anonymized_validation_operator": anonymized_validation_operator_schema,
        "anonymized_action": anonymized_action_schema,
        "empty_payload": empty_payload_schema,
        "init_payload": init_payload_schema,
        "run_validation_operator_payload": run_validation_operator_payload_schema,
        "anonymized_data_docs_site": anonymized_data_docs_site_schema,
        "anonymized_batch": anonymized_batch_schema,
        "anonymized_expectation_suite": anonymized_expectation_suite_schema,
        "save_or_edit_expectation_suite_payload": save_or_edit_expectation_suite_payload_schema,
        "cli_suite_expectation_suite_payload": cli_suite_expectation_suite_payload_schema,
        "cli_payload": cli_payload_schema,
        "cli_new_ds_choice_payload": cli_new_ds_choice_payload_schema,
        "datasource_sqlalchemy_connect_payload": datasource_sqlalchemy_connect_payload,
        "test_yaml_config_payload": test_yaml_config_payload_schema,
    },
    "type": "object",
    "properties": {
        "version": {"enum": ["1.0.0"]},
        "event_time": {"type": "string", "format": "date-time"},
        "data_context_id": {"type": "string", "format": "uuid"},
        "data_context_instance_id": {"type": "string", "format": "uuid"},
        "ge_version": {"type": "string", "maxLength": 32},
        "x-forwarded-for": {"type": "string"},
        "success": {"type": ["boolean", "null"]},
    },
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "event": {"enum": ["data_context.__init__"]},
                "event_payload": {"$ref": "#/definitions/init_payload"},
            },
        },
        {
            "type": "object",
            "properties": {
                "event": {"enum": ["data_context.save_expectation_suite"]},
                "event_payload": {
                    "$ref": "#/definitions/save_or_edit_expectation_suite_payload"
                },
            },
        },
        {
            "type": "object",
            "properties": {
                "event": {"enum": ["data_context.run_validation_operator"]},
                "event_payload": {
                    "$ref": "#/definitions/run_validation_operator_payload"
                },
            },
        },
        {
            "type": "object",
            "properties": {
                "event": {"enum": ["data_asset.validate"]},
                "event_payload": {"$ref": "#/definitions/anonymized_batch"},
            },
        },
        {
            "type": "object",
            "properties": {
                "event": {"enum": ["cli.new_ds_choice"]},
                "event_payload": {"$ref": "#/definitions/cli_new_ds_choice_payload"},
            },
        },
        {
            "type": "object",
            "properties": {
                "event": {"enum": ["data_context.add_datasource"]},
                "event_payload": {"$ref": "#/definitions/anonymized_datasource"},
            },
        },
        {
            "type": "object",
            "properties": {
                "event": {"enum": ["datasource.sqlalchemy.connect"]},
                "event_payload": {
                    "$ref": "#/definitions/datasource_sqlalchemy_connect_payload"
                },
            },
        },
        {
            "type": "object",
            "properties": {
                "event": {
                    "enum": [
                        "data_context.build_data_docs",
                        "data_context.open_data_docs",
                    ],
                },
                "event_payload": {"$ref": "#/definitions/empty_payload"},
            },
        },
        {
            "type": "object",
            "properties": {
                "event": {
                    "enum": ["data_context.test_yaml_config"],
                },
                "event_payload": {"$ref": "#/definitions/test_yaml_config_payload"},
            },
        },
        {
            "type": "object",
            "properties": {
                "event": {
                    "enum": [
                        "cli.suite.edit",
                        "cli.suite.edit.begin",
                        "cli.suite.edit.end",
                    ]
                },
                "event_payload": {
                    "$ref": "#/definitions/cli_suite_expectation_suite_payload"
                },
            },
        },
        {
            "type": "object",
            "properties": {
                "event": {
                    "enum": [
                        "cli.checkpoint.delete",
                        "cli.checkpoint.delete.begin",
                        "cli.checkpoint.delete.end",
                        "cli.checkpoint.list",
                        "cli.checkpoint.list.begin",
                        "cli.checkpoint.list.end",
                        "cli.checkpoint.new",
                        "cli.checkpoint.new.begin",
                        "cli.checkpoint.new.end",
                        "cli.checkpoint.run",
                        "cli.checkpoint.run.begin",
                        "cli.checkpoint.run.end",
                        "cli.checkpoint.script",
                        "cli.checkpoint.script.begin",
                        "cli.checkpoint.script.end",
                        "cli.datasource.list",
                        "cli.datasource.list.begin",
                        "cli.datasource.list.end",
                        "cli.datasource.new",
                        "cli.datasource.new.begin",
                        "cli.datasource.new.end",
                        "cli.datasource.delete",
                        "cli.datasource.delete.begin",
                        "cli.datasource.delete.end",
                        "cli.datasource.profile",
                        "cli.docs.build",
                        "cli.docs.build.begin",
                        "cli.docs.build.end",
                        "cli.docs.clean",
                        "cli.docs.clean.begin",
                        "cli.docs.clean.end",
                        "cli.docs.list",
                        "cli.docs.list.begin",
                        "cli.docs.list.end",
                        "cli.init.create",
                        "cli.project.check_config",
                        "cli.project.upgrade.begin",
                        "cli.project.upgrade.end",
                        "cli.store.list",
                        "cli.store.list.begin",
                        "cli.store.list.end",
                        "cli.suite.delete",
                        "cli.suite.delete.begin",
                        "cli.suite.delete.end",
                        "cli.suite.demo",
                        "cli.suite.demo.begin",
                        "cli.suite.demo.end",
                        "cli.suite.list",
                        "cli.suite.list.begin",
                        "cli.suite.list.end",
                        "cli.suite.new",
                        "cli.suite.new.begin",
                        "cli.suite.new.end",
                        "cli.suite.scaffold",
                        "cli.validation_operator.list",
                        "cli.validation_operator.run",
                    ],
                },
                "event_payload": {"$ref": "#/definitions/cli_payload"},
            },
        },
    ],
    "required": [
        "version",
        "event_time",
        "data_context_id",
        "data_context_instance_id",
        "ge_version",
        "event",
        "success",
        "event_payload",
    ],
}

if __name__ == "__main__":
    import json

    with open("usage_statistics_record_schema.json", "w") as outfile:
        json.dump(usage_statistics_record_schema, outfile, indent=2)
