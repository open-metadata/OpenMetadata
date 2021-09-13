# import logging
# from collections import defaultdict
# import collections
#
# import warnings
# from great_expectations.datasource.types import BatchKwargs
# from great_expectations.profile.metrics_store import MetricsStore
# from great_expectations.profile.metrics_utils import (
# set_nested_value_in_dict,
# get_nested_value_from_dict
# )
#
# logger = logging.getLogger(__name__)
#
#
# class MultiBatchValidationMetaAnalysis(object):
#     """MultiBatchValidationMetaAnalysis takes a list of validation results
#     (same expectation suite evaluated against multiple batches)
#     and returns multi-batch metrics from these results.
#
#     """
#
#     # (expectation type, result key) -> (expectation kwargs that should become metric kwargs)
#     # result key is a string or a tuple if the key is nested. same for the expectation kwargs
#
#     # NOTE: Eugene: 2019-09-04: Add more entries
#     EXPECTATION_DEFINED_METRICS_LOOKUP_TABLE = {
#         ('expect_column_values_to_not_be_null', ('unexpected_percent',)): ('column',), # note: "," is important - it makes it a tuple!
#         ('expect_column_quantile_values_to_be_between', ('observed_value', 'values')): (
#             'column', ('quantile_ranges', 'quantiles')),
#
#     }
#
#     @classmethod
#     def add_expectation_defined_metric_for_result_key(cls, d, result, data_asset_name, batch_kwargs, metrics_store, t=()):
#         for key, value in d.items():
#             if isinstance(value, collections.Mapping):
#                 cls.add_expectation_defined_metric_for_result_key(value, result, data_asset_name, batch_kwargs, metrics_store, t + (key,))
#             else:
#                 # result_key_lookup_key = key if t==() else (t + (key,))
#                 result_key_lookup_key = (t + (key,))
#                 full_lookup_key = (result.expectation_config.expectation_type, result_key_lookup_key)
#                 metric_kwargs_names = cls.EXPECTATION_DEFINED_METRICS_LOOKUP_TABLE.get(full_lookup_key)
#                 if metric_kwargs_names:
#                     metric_kwargs = {}
#                     for metric_kwarg_name in metric_kwargs_names:
#                         if isinstance(metric_kwarg_name, tuple):
#                             set_nested_value_in_dict(metric_kwargs, metric_kwarg_name, get_nested_value_from_dict(result.expectation_config['kwargs'], metric_kwarg_name))
#                         else:
#                             metric_kwargs[metric_kwarg_name] = result.expectation_config['kwargs'][metric_kwarg_name]
#
#                     metrics_store.add_single_batch_expectation_defined_metric(
#                             data_asset_name,
#                             batch_kwargs.batch_fingerprint,
#                             result.expectation_config.expectation_type,
#                             result_key_lookup_key,
#                             metric_kwargs,
#                             value)
#
#     @classmethod
#     def add_metrics_from_single_expectation_validation_result(cls, result, data_asset_name, batch_kwargs, metrics_store):
#         """
#         Extract metrics from a validation result of one expectation and store them.
#         Depending on the type of the expectation, this method chooses the key
#         in the result dictionary that should be returned as a metric
#         (e.g., "observed_value" or "unexpected_percent").
#
#         :param result: a validation result dictionary of one expectation
#         :param data_asset_name:
#         :param batch_kwargs: BatchKwargs of the batch that was validated
#         :param metrics_store
#         """
#         # NOTE: Eugene: 2019-09-04: Add more entries
#         expectation_metrics = {
#             # 'expect_column_distinct_values_to_be_in_set'
#             # 'expect_column_kl_divergence_to_be_less_than',
#             'expect_column_max_to_be_between': {
#                 'observed_value': 'column_max'
#             },
#             'expect_column_mean_to_be_between': {
#                 'observed_value': 'column_mean'
#             },
#             'expect_column_median_to_be_between': {
#                 'observed_value': 'column_median'
#             },
#             'expect_column_min_to_be_between': {
#                 'observed_value': 'column_min'
#             },
#             'expect_column_proportion_of_unique_values_to_be_between': {
#                 'observed_value': 'column_proportion_of_unique_values'
#             },
#             # 'expect_column_quantile_values_to_be_between',
#             'expect_column_stdev_to_be_between': {
#                 'observed_value': 'column_stdev'
#             },
#             'expect_column_unique_value_count_to_be_between': {
#                 'observed_value': 'column_unique_count'
#             },
#             # 'expect_column_values_to_be_between',
#             # 'expect_column_values_to_be_in_set',
#             # 'expect_column_values_to_be_in_type_list',
#             'expect_column_values_to_be_unique': {
#
#             },
#             # 'expect_table_columns_to_match_ordered_list',
#             'expect_table_row_count_to_be_between': {
#                 'observed_value': 'row_count'
#             }
#
#         }
#
#         metrics = []
#         if result.get('result'):
#             entry = expectation_metrics.get(result.expectation_config.expectation_type)
#             if entry:
#                 for key in result['result'].keys():
#                     metric_name = entry.get(key)
#                     if metric_name:
#                         metric_kwargs = {"column": result.expectation_config['kwargs']['column']} if result.expectation_config[
#                     'kwargs'].get('column') else {}
#
#                         metrics_store.add_single_batch_metric(
#                             data_asset_name,
#                             batch_kwargs.batch_fingerprint,
#                             metric_name,
#                             metric_kwargs,
#                             result['result'][key])
#
#             else:
#                 cls.add_expectation_defined_metric_for_result_key(result['result'], result,
#                                         data_asset_name, batch_kwargs, metrics_store)
#
#     @classmethod
#     def get_metrics(cls, validation_results_list, data_context):
#         """
#         Get multi-batch metrics from a list of validation results
#
#         :param validation_results_list: a list validation results where each item is a
#                 result of validating a batch against the same expectation suite
#         :return: a dict: {multi-batch metric urn -> multi-batch metric}
#         """
#
#         # NOTE: Eugene: 2019-09-04: For now we are creating an instance of metrics store here
#         # but it probably should be some singleton obtained from a factory/manager.
#         metrics_store = MetricsStore()
#
#         batch_kwargs_list = []
#         for j, one_batch_validation_results in enumerate(validation_results_list):
#             #             print(json.dumps(one_batch_validation_results['meta'], indent=2))
#             batch_kwargs = BatchKwargs(one_batch_validation_results['meta']['batch_kwargs'])
#             batch_kwargs_list.append(batch_kwargs)
#
#             # NOTE: Eugene 2019-08-25: when validation results be a typed object,
#             # that object will have data_asset_name property method that will
#             # return a NormalizedDataAssetName. Until then we are constructing
#             # a NormalizedDataAssetName from the string that we fetch from the dictionary
#             normalized_data_asset_name = data_context.normalize_data_asset_name(
#                 one_batch_validation_results['meta']['data_asset_name'])
#             for i, result in enumerate(one_batch_validation_results['results']):
#                 cls.add_metrics_from_single_expectation_validation_result(result,
#                                                                           normalized_data_asset_name,
#                                                                           batch_kwargs,
#                                                                           metrics_store)
#
#         mb_metrics = metrics_store.get_multi_batch_metrics(batch_kwargs_list)
#
#         return mb_metrics
