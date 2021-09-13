# from .base import (
#     ListOf,
#     AllowedKeysDotDict,
# )
#
# class Expectation(AllowedKeysDotDict):
#     _allowed_keys = set([
#         "expectation_type",
#         "kwargs",
#     ])
#     _required_keys = set([
#     ])
#     _key_types = {}
#
# class ExpectationSuite(AllowedKeysDotDict):
#     _allowed_keys = set([
#         "expectations",
#         "meta",
#         "data_asset_name", #??? Should this go inside meta?
#         "expectation_suite_name", #??? Should this go inside meta?
#         "data_asset_type", #??? Should this go inside meta?
#     ])
#     _required_keys = set([
#         "expectations",
#     ])
#     _key_types = {
#         "expectations" : ListOf(Expectation),
#         "meta" : Dict, #TODO: Add a type for this field
#     }
#
# class ValidationResult(AllowedKeysDotDict):
#     _allowed_keys = set([
#         "success",
#         "expectation_config",
#         "exception_info",
#         "result",
#     ])
#     _required_keys = set([
#         "success",
#         "expectation_config",
#         "exception_info",
#         # "result",
#     ])
#     _key_types = {
#         "success" : bool,
#         "expectation_config" : Expectation,
#         "exception_info" : Dict, #TODO: Add a type for this field
#         "result" : Dict, #TODO: Add a type for this field
#     }
#
# class ValidationResultSuite(AllowedKeysDotDict):
#     _allowed_keys = set([
#         "results",
#         "meta",
#         "success",
#         "statistics", #TODO: Someday we should deprecate this in favor of renderers.
#     ])
#     _required_keys = set([
#         "results",
#         "meta",
#         "success"
#     ])
#     _key_types = {
#         "results" : ListOf(ValidationResult),
#         "meta" : Dict, #TODO: Add a type for this field
#         "success" : bool,
#     }
