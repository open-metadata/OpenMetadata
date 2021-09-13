import logging

from great_expectations.execution_engine import (
    PandasExecutionEngine,
    SparkDFExecutionEngine,
)
from great_expectations.execution_engine.sqlalchemy_execution_engine import (
    SqlAlchemyExecutionEngine,
)
from great_expectations.expectations.metrics.column_aggregate_metric_provider import (
    ColumnAggregateMetricProvider,
    column_aggregate_partial,
    column_aggregate_value,
)
from great_expectations.expectations.metrics.column_aggregate_metric_provider import (
    sa as sa,
)
from great_expectations.expectations.metrics.util import (
    _scipy_distribution_positional_args_from_dict,
    is_valid_continuous_partition_object,
    validate_distribution_parameters,
)

logger = logging.getLogger(__name__)

try:
    from pyspark.sql.functions import stddev_samp
except ImportError as e:
    logger.debug(str(e))
    logger.debug(
        "Unable to load spark context; install optional spark dependency for support."
    )

import numpy as np
from scipy import stats


class ColumnBootstrappedKSTestPValue(ColumnAggregateMetricProvider):
    """MetricProvider Class for Aggregate Standard Deviation metric"""

    metric_name = "column.bootstrapped_ks_test_p_value"
    value_keys = ("partition_object", "p", "bootstrap_sample", "bootstrap_sample_size")

    @column_aggregate_value(engine=PandasExecutionEngine)
    def _pandas(
        cls,
        column,
        partition_object=None,
        p=0.05,
        bootstrap_samples=None,
        bootstrap_sample_size=None,
        **kwargs
    ):
        if not is_valid_continuous_partition_object(partition_object):
            raise ValueError("Invalid continuous partition object.")

        # TODO: consider changing this into a check that tail_weights does not exist exclusively, by moving this check into is_valid_continuous_partition_object
        if (partition_object["bins"][0] == -np.inf) or (
            partition_object["bins"][-1] == np.inf
        ):
            raise ValueError("Partition endpoints must be finite.")

        if (
            "tail_weights" in partition_object
            and np.sum(partition_object["tail_weights"]) > 0
        ):
            raise ValueError(
                "Partition cannot have tail weights -- endpoints must be finite."
            )

        test_cdf = np.append(np.array([0]), np.cumsum(partition_object["weights"]))

        def estimated_cdf(x):
            return np.interp(x, partition_object["bins"], test_cdf)

        if bootstrap_samples is None:
            bootstrap_samples = 1000

        if bootstrap_sample_size is None:
            # Sampling too many elements (or not bootstrapping) will make the test too sensitive to the fact that we've
            # compressed via a partition.

            # Sampling too few elements will make the test insensitive to significant differences, especially
            # for nonoverlapping ranges.
            bootstrap_sample_size = len(partition_object["weights"]) * 2

        results = [
            stats.kstest(
                np.random.choice(column, size=bootstrap_sample_size), estimated_cdf
            )[1]
            for _ in range(bootstrap_samples)
        ]

        test_result = (1 + sum(x >= p for x in results)) / (bootstrap_samples + 1)

        hist, bin_edges = np.histogram(column, partition_object["bins"])
        below_partition = len(np.where(column < partition_object["bins"][0])[0])
        above_partition = len(np.where(column > partition_object["bins"][-1])[0])

        # Expand observed partition to report, if necessary
        if below_partition > 0 and above_partition > 0:
            observed_bins = (
                [np.min(column)] + partition_object["bins"] + [np.max(column)]
            )
            observed_weights = np.concatenate(
                ([below_partition], hist, [above_partition])
            ) / len(column)
        elif below_partition > 0:
            observed_bins = [np.min(column)] + partition_object["bins"]
            observed_weights = np.concatenate(([below_partition], hist)) / len(column)
        elif above_partition > 0:
            observed_bins = partition_object["bins"] + [np.max(column)]
            observed_weights = np.concatenate((hist, [above_partition])) / len(column)
        else:
            observed_bins = partition_object["bins"]
            observed_weights = hist / len(column)

        observed_cdf_values = np.cumsum(observed_weights)

        # TODO: How should this metric's return_obj be structured?
        return_obj = {
            "observed_value": test_result,
            "details": {
                "bootstrap_samples": bootstrap_samples,
                "bootstrap_sample_size": bootstrap_sample_size,
                "observed_partition": {
                    "bins": observed_bins,
                    "weights": observed_weights.tolist(),
                },
                "expected_partition": {
                    "bins": partition_object["bins"],
                    "weights": partition_object["weights"],
                },
                "observed_cdf": {
                    "x": observed_bins,
                    "cdf_values": [0] + observed_cdf_values.tolist(),
                },
                "expected_cdf": {
                    "x": partition_object["bins"],
                    "cdf_values": test_cdf.tolist(),
                },
            },
        }

        return return_obj
