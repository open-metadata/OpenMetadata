import warnings

from ..dataset.util import create_multiple_expectations
from .base import DatasetProfiler


# This particular file should be immune to the new changes
class ColumnsExistProfiler(DatasetProfiler):
    @classmethod
    def _profile(cls, dataset, configuration=None):
        """
        This function will take a dataset and add expectations that each column present exists.

        Args:
            dataset (great_expectations.dataset): The dataset to profile and to which to add expectations.
            configuration: Configuration for select profilers.
        """
        if not hasattr(dataset, "get_table_columns"):
            warnings.warn("No columns list found in dataset; no profiling performed.")
            raise NotImplementedError(
                "ColumnsExistProfiler._profile is not implemented for data assests without the table_columns property"
            )

        table_columns = dataset.get_table_columns()

        if table_columns is None:
            warnings.warn("No columns list found in dataset; no profiling performed.")

            raise NotImplementedError(
                "ColumnsExistProfiler._profile is not implemented for data assests without the table_columns property"
            )

        create_multiple_expectations(dataset, table_columns, "expect_column_to_exist")

        return dataset.get_expectation_suite(suppress_warnings=True)
