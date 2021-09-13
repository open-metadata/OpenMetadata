# Utility methods for dealing with Dataset objects

import logging
from typing import Any, List

import numpy as np

from great_expectations.validator.validation_graph import MetricConfiguration

logger = logging.getLogger(__name__)

try:
    import sqlalchemy
    from sqlalchemy.engine.default import DefaultDialect
    from sqlalchemy.sql.elements import WithinGroup
except ImportError:
    logger.debug("Unable to load SqlAlchemy or one of its subclasses.")
    DefaultDialect = None
    WithinGroup = None


def is_valid_partition_object(partition_object):
    """Tests whether a given object is a valid continuous or categorical partition object.
    :param partition_object: The partition_object to evaluate
    :return: Boolean
    """
    return is_valid_continuous_partition_object(
        partition_object
    ) or is_valid_categorical_partition_object(partition_object)


def is_valid_categorical_partition_object(partition_object):
    """Tests whether a given object is a valid categorical partition object.
    :param partition_object: The partition_object to evaluate
    :return: Boolean
    """
    if (
        partition_object is None
        or ("weights" not in partition_object)
        or ("values" not in partition_object)
    ):
        return False
    # Expect the same number of values as weights; weights should sum to one
    return len(partition_object["values"]) == len(
        partition_object["weights"]
    ) and np.allclose(np.sum(partition_object["weights"]), 1)


def is_valid_continuous_partition_object(partition_object):
    """Tests whether a given object is a valid continuous partition object. See :ref:`partition_object`.

    :param partition_object: The partition_object to evaluate
    :return: Boolean
    """
    if (
        (partition_object is None)
        or ("weights" not in partition_object)
        or ("bins" not in partition_object)
    ):
        return False

    if "tail_weights" in partition_object:
        if len(partition_object["tail_weights"]) != 2:
            return False
        comb_weights = partition_object["tail_weights"] + partition_object["weights"]
    else:
        comb_weights = partition_object["weights"]

    ## TODO: Consider adding this check to migrate to the tail_weights structure of partition objects
    # if (partition_object['bins'][0] == -np.inf) or (partition_object['bins'][-1] == np.inf):
    #     return False

    # Expect one more bin edge than weight; all bin edges should be monotonically increasing; weights should sum to one
    return (
        (len(partition_object["bins"]) == (len(partition_object["weights"]) + 1))
        and np.all(np.diff(partition_object["bins"]) > 0)
        and np.allclose(np.sum(comb_weights), 1.0)
    )


def build_continuous_partition_object(
    execution_engine, domain_kwargs, bins="auto", n_bins=10, allow_relative_error=False
):
    """Convenience method for building a partition object on continuous data from a dataset and column

    Args:
        execution_engine (ExecutionEngine): the execution engine with which to compute the partition
        domain_kwargs (dict): The domain kwargs describing the domain for which to compute the partition
        bins (string): One of 'uniform' (for uniformly spaced bins), 'ntile' (for percentile-spaced bins), or 'auto'
            (for automatically spaced bins)
        n_bins (int): Ignored if bins is auto.
        allow_relative_error: passed to get_column_quantiles, set to False for only precise
            values, True to allow approximate values on systems with only binary choice (e.g. Redshift), and to a
            value between zero and one for systems that allow specification of relative error (e.g.
            SparkDFDataset).

    Returns:

        A new partition_object::

            {
                "bins": (list) The endpoints of the partial partition of reals,
                "weights": (list) The densities of the bins implied by the partition.
            }

            See :ref:`partition_object`.
    """
    partition_metric_configuration = MetricConfiguration(
        "column.partition",
        metric_domain_kwargs=domain_kwargs,
        metric_value_kwargs={
            "bins": bins,
            "n_bins": n_bins,
            "allow_relative_error": allow_relative_error,
        },
    )
    bins = execution_engine.resolve_metrics([partition_metric_configuration])[
        partition_metric_configuration.id
    ]
    if isinstance(bins, np.ndarray):
        bins = bins.tolist()
    else:
        bins = list(bins)
    hist_metric_configuration = MetricConfiguration(
        "column.histogram",
        metric_domain_kwargs=domain_kwargs,
        metric_value_kwargs={
            "bins": tuple(bins),
        },
    )
    nonnull_configuration = MetricConfiguration(
        "column_values.nonnull.count",
        metric_domain_kwargs=domain_kwargs,
        metric_value_kwargs={
            "bins": tuple(bins),
        },
    )
    metrics = execution_engine.resolve_metrics(
        (hist_metric_configuration, nonnull_configuration)
    )
    weights = list(
        np.array(metrics[hist_metric_configuration.id])
        / metrics[nonnull_configuration.id]
    )
    tail_weights = (1 - sum(weights)) / 2
    partition_object = {
        "bins": bins,
        "weights": weights,
        "tail_weights": [tail_weights, tail_weights],
    }
    return partition_object


def build_categorical_partition_object(execution_engine, domain_kwargs, sort="value"):
    """Convenience method for building a partition object on categorical data from a dataset and column

    Args:
        execution_engine (ExecutionEngine): the execution engine with which to compute the partition
        domain_kwargs (dict): The domain kwargs describing the domain for which to compute the partition
        sort (string): must be one of "value", "count", or "none".
            - if "value" then values in the resulting partition object will be sorted lexigraphically
            - if "count" then values will be sorted according to descending count (frequency)
            - if "none" then values will not be sorted

    Returns:
        A new partition_object::

        {
            "values": (list) the categorical values for which each weight applies,
            "weights": (list) The densities of the values implied by the partition.
        }
        See :ref:`partition_object`.
    """
    counts_configuration = MetricConfiguration(
        "column.partition",
        metric_domain_kwargs=domain_kwargs,
        metric_value_kwargs={
            "sort": sort,
        },
    )
    nonnull_configuration = MetricConfiguration(
        "column_values.nonnull.count",
        metric_domain_kwargs=domain_kwargs,
    )
    metrics = execution_engine.resolve_metrics(
        (counts_configuration, nonnull_configuration)
    )

    return {
        "values": list(metrics[counts_configuration.id].index),
        "weights": list(
            np.array(metrics[counts_configuration.id])
            / metrics[nonnull_configuration.id]
        ),
    }


def infer_distribution_parameters(data, distribution, params=None):
    """Convenience method for determining the shape parameters of a given distribution

    Args:
        data (list-like): The data to build shape parameters from.
        distribution (string): Scipy distribution, determines which parameters to build.
        params (dict or None): The known parameters. Parameters given here will not be altered. \
                               Keep as None to infer all necessary parameters from the data data.

    Returns:
        A dictionary of named parameters::

        {
            "mean": (float),
            "std_dev": (float),
            "loc": (float),
            "scale": (float),
            "alpha": (float),
            "beta": (float),
            "min": (float),
            "max": (float),
            "df": (float)
        }

        See: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.kstest.html#scipy.stats.kstest
    """

    if params is None:
        params = {}
    elif not isinstance(params, dict):
        raise TypeError(
            "params must be a dictionary object, see great_expectations documentation"
        )

    if "mean" not in params.keys():
        params["mean"] = data.mean()

    if "std_dev" not in params.keys():
        params["std_dev"] = data.std()

    if distribution == "beta":
        # scipy cdf(x, a, b, loc=0, scale=1)
        if "alpha" not in params.keys():
            # from https://stats.stackexchange.com/questions/12232/calculating-the-parameters-of-a-beta-distribution-using-the-mean-and-variance
            params["alpha"] = (params["mean"] ** 2) * (
                ((1 - params["mean"]) / params["std_dev"] ** 2) - (1 / params["mean"])
            )
        if "beta" not in params.keys():
            params["beta"] = params["alpha"] * ((1 / params["mean"]) - 1)

    elif distribution == "gamma":
        # scipy cdf(x, a, loc=0, scale=1)
        if "alpha" not in params.keys():
            # Using https://en.wikipedia.org/wiki/Gamma_distribution
            params["alpha"] = params["mean"] / params.get("scale", 1)

    # elif distribution == 'poisson':
    #    if 'lambda' not in params.keys():
    #       params['lambda'] = params['mean']

    elif distribution == "uniform":
        # scipy cdf(x, loc=0, scale=1)
        if "min" not in params.keys():
            if "loc" in params.keys():
                params["min"] = params["loc"]
            else:
                params["min"] = min(data)
        if "max" not in params.keys():
            if "scale" in params.keys():
                params["max"] = params["scale"]
            else:
                params["max"] = max(data) - params["min"]

    elif distribution == "chi2":
        # scipy cdf(x, df, loc=0, scale=1)
        if "df" not in params.keys():
            # from https://en.wikipedia.org/wiki/Chi-squared_distribution
            params["df"] = params["mean"]

    #  Expon only uses loc and scale, use default
    # elif distribution == 'expon':
    # scipy cdf(x, loc=0, scale=1)
    #    if 'lambda' in params.keys():
    # Lambda is optional
    #        params['scale'] = 1 / params['lambda']
    elif distribution != "norm":
        raise AttributeError(
            "Unsupported distribution type. Please refer to Great Expectations Documentation"
        )

    params["loc"] = params.get("loc", 0)
    params["scale"] = params.get("scale", 1)

    return params


def _scipy_distribution_positional_args_from_dict(distribution, params):
    """Helper function that returns positional arguments for a scipy distribution using a dict of parameters.

       See the `cdf()` function here https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.beta.html#Methods\
       to see an example of scipy's positional arguments. This function returns the arguments specified by the \
       scipy.stat.distribution.cdf() for that distribution.

       Args:
           distribution (string): \
               The scipy distribution name.
           params (dict): \
               A dict of named parameters.

       Raises:
           AttributeError: \
               If an unsupported distribution is provided.
    """

    params["loc"] = params.get("loc", 0)
    if "scale" not in params:
        params["scale"] = 1

    if distribution == "norm":
        return params["mean"], params["std_dev"]
    elif distribution == "beta":
        return params["alpha"], params["beta"], params["loc"], params["scale"]
    elif distribution == "gamma":
        return params["alpha"], params["loc"], params["scale"]
    # elif distribution == 'poisson':
    #    return params['lambda'], params['loc']
    elif distribution == "uniform":
        return params["min"], params["max"]
    elif distribution == "chi2":
        return params["df"], params["loc"], params["scale"]
    elif distribution == "expon":
        return params["loc"], params["scale"]


def validate_distribution_parameters(distribution, params):
    """Ensures that necessary parameters for a distribution are present and that all parameters are sensical.

       If parameters necessary to construct a distribution are missing or invalid, this function raises ValueError\
       with an informative description. Note that 'loc' and 'scale' are optional arguments, and that 'scale'\
       must be positive.

       Args:
           distribution (string): \
               The scipy distribution name, e.g. normal distribution is 'norm'.
           params (dict or list): \
               The distribution shape parameters in a named dictionary or positional list form following the scipy \
               cdf argument scheme.

               params={'mean': 40, 'std_dev': 5} or params=[40, 5]

       Exceptions:
           ValueError: \
               With an informative description, usually when necessary parameters are omitted or are invalid.

    """

    norm_msg = (
        "norm distributions require 0 parameters and optionally 'mean', 'std_dev'."
    )
    beta_msg = "beta distributions require 2 positive parameters 'alpha', 'beta' and optionally 'loc', 'scale'."
    gamma_msg = "gamma distributions require 1 positive parameter 'alpha' and optionally 'loc','scale'."
    # poisson_msg = "poisson distributions require 1 positive parameter 'lambda' and optionally 'loc'."
    uniform_msg = (
        "uniform distributions require 0 parameters and optionally 'loc', 'scale'."
    )
    chi2_msg = "chi2 distributions require 1 positive parameter 'df' and optionally 'loc', 'scale'."
    expon_msg = (
        "expon distributions require 0 parameters and optionally 'loc', 'scale'."
    )

    if distribution not in [
        "norm",
        "beta",
        "gamma",
        "poisson",
        "uniform",
        "chi2",
        "expon",
    ]:
        raise AttributeError("Unsupported  distribution provided: %s" % distribution)

    if isinstance(params, dict):
        # `params` is a dictionary
        if params.get("std_dev", 1) <= 0 or params.get("scale", 1) <= 0:
            raise ValueError("std_dev and scale must be positive.")

        # alpha and beta are required and positive
        if distribution == "beta" and (
            params.get("alpha", -1) <= 0 or params.get("beta", -1) <= 0
        ):
            raise ValueError("Invalid parameters: %s" % beta_msg)

        # alpha is required and positive
        elif distribution == "gamma" and params.get("alpha", -1) <= 0:
            raise ValueError("Invalid parameters: %s" % gamma_msg)

        # lambda is a required and positive
        # elif distribution == 'poisson' and params.get('lambda', -1) <= 0:
        #    raise ValueError("Invalid parameters: %s" %poisson_msg)

        # df is necessary and required to be positive
        elif distribution == "chi2" and params.get("df", -1) <= 0:
            raise ValueError("Invalid parameters: %s:" % chi2_msg)

    elif isinstance(params, tuple) or isinstance(params, list):
        scale = None

        # `params` is a tuple or a list
        if distribution == "beta":
            if len(params) < 2:
                raise ValueError("Missing required parameters: %s" % beta_msg)
            if params[0] <= 0 or params[1] <= 0:
                raise ValueError("Invalid parameters: %s" % beta_msg)
            if len(params) == 4:
                scale = params[3]
            elif len(params) > 4:
                raise ValueError("Too many parameters provided: %s" % beta_msg)

        elif distribution == "norm":
            if len(params) > 2:
                raise ValueError("Too many parameters provided: %s" % norm_msg)
            if len(params) == 2:
                scale = params[1]

        elif distribution == "gamma":
            if len(params) < 1:
                raise ValueError("Missing required parameters: %s" % gamma_msg)
            if len(params) == 3:
                scale = params[2]
            if len(params) > 3:
                raise ValueError("Too many parameters provided: %s" % gamma_msg)
            elif params[0] <= 0:
                raise ValueError("Invalid parameters: %s" % gamma_msg)

        # elif distribution == 'poisson':
        #    if len(params) < 1:
        #        raise ValueError("Missing required parameters: %s" %poisson_msg)
        #   if len(params) > 2:
        #        raise ValueError("Too many parameters provided: %s" %poisson_msg)
        #    elif params[0] <= 0:
        #        raise ValueError("Invalid parameters: %s" %poisson_msg)

        elif distribution == "uniform":
            if len(params) == 2:
                scale = params[1]
            if len(params) > 2:
                raise ValueError("Too many arguments provided: %s" % uniform_msg)

        elif distribution == "chi2":
            if len(params) < 1:
                raise ValueError("Missing required parameters: %s" % chi2_msg)
            elif len(params) == 3:
                scale = params[2]
            elif len(params) > 3:
                raise ValueError("Too many arguments provided: %s" % chi2_msg)
            if params[0] <= 0:
                raise ValueError("Invalid parameters: %s" % chi2_msg)

        elif distribution == "expon":

            if len(params) == 2:
                scale = params[1]
            if len(params) > 2:
                raise ValueError("Too many arguments provided: %s" % expon_msg)

        if scale is not None and scale <= 0:
            raise ValueError("std_dev and scale must be positive.")

    else:
        raise ValueError(
            "params must be a dict or list, or use ge.dataset.util.infer_distribution_parameters(data, distribution)"
        )

    return


def create_multiple_expectations(df, columns, expectation_type, *args, **kwargs):
    """Creates an identical expectation for each of the given columns with the specified arguments, if any.

    Args:
        df (great_expectations.dataset): A great expectations dataset object.
        columns (list): A list of column names represented as strings.
        expectation_type (string): The expectation type.

    Raises:
        KeyError if the provided column does not exist.
        AttributeError if the provided expectation type does not exist or df is not a valid great expectations dataset.

    Returns:
        A list of expectation results.


    """
    expectation = getattr(df, expectation_type)
    results = list()

    for column in columns:
        results.append(expectation(column, *args, **kwargs))

    return results


def get_approximate_percentile_disc_sql(selects: List, sql_engine_dialect: Any) -> str:
    return ", ".join(
        [
            "approximate "
            + str(
                stmt.compile(
                    dialect=sql_engine_dialect, compile_kwargs={"literal_binds": True}
                )
            )
            for stmt in selects
        ]
    )


def check_sql_engine_dialect(
    actual_sql_engine_dialect: Any,
    candidate_sql_engine_dialect: Any,
) -> bool:
    try:
        # noinspection PyTypeChecker
        return isinstance(actual_sql_engine_dialect, candidate_sql_engine_dialect)
    except (AttributeError, TypeError):
        return False
