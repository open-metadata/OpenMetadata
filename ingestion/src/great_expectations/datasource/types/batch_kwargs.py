import logging
from abc import ABCMeta

from great_expectations.core.id_dict import BatchKwargs
from great_expectations.exceptions import InvalidBatchKwargsError

logger = logging.getLogger(__name__)


class PandasDatasourceBatchKwargs(BatchKwargs, metaclass=ABCMeta):
    """This is an abstract class and should not be instantiated. It's relevant for testing whether
    a subclass is allowed
    """

    pass


class SparkDFDatasourceBatchKwargs(BatchKwargs, metaclass=ABCMeta):
    """This is an abstract class and should not be instantiated. It's relevant for testing whether
    a subclass is allowed
    """

    pass


class SqlAlchemyDatasourceBatchKwargs(BatchKwargs, metaclass=ABCMeta):
    """This is an abstract class and should not be instantiated. It's relevant for testing whether
    a subclass is allowed
    """

    @property
    def limit(self):
        return self.get("limit")

    @property
    def schema(self):
        return self.get("schema")


class PathBatchKwargs(PandasDatasourceBatchKwargs, SparkDFDatasourceBatchKwargs):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if "path" not in self:
            raise InvalidBatchKwargsError("PathBatchKwargs requires a path element")

    @property
    def path(self):
        return self.get("path")

    @property
    def reader_method(self):
        return self.get("reader_method")


class S3BatchKwargs(PandasDatasourceBatchKwargs, SparkDFDatasourceBatchKwargs):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if "s3" not in self:
            raise InvalidBatchKwargsError("S3BatchKwargs requires a path element")

    @property
    def s3(self):
        return self.get("s3")

    @property
    def reader_method(self):
        return self.get("reader_method")


class InMemoryBatchKwargs(PandasDatasourceBatchKwargs, SparkDFDatasourceBatchKwargs):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if "dataset" not in self:
            raise InvalidBatchKwargsError(
                "InMemoryBatchKwargs requires a 'dataset' element"
            )

    @property
    def dataset(self):
        return self.get("dataset")


class PandasDatasourceInMemoryBatchKwargs(InMemoryBatchKwargs):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        import pandas as pd

        if not isinstance(self["dataset"], pd.DataFrame):
            raise InvalidBatchKwargsError(
                "PandasDatasourceInMemoryBatchKwargs 'dataset' must be a pandas DataFrame"
            )


class SparkDFDatasourceInMemoryBatchKwargs(InMemoryBatchKwargs):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        try:
            import pyspark
        except ImportError:
            raise InvalidBatchKwargsError(
                "SparkDFDatasourceInMemoryBatchKwargs requires a valid pyspark installation, but pyspark import failed."
            )
        if not isinstance(self["dataset"], pyspark.sql.DataFrame):
            raise InvalidBatchKwargsError(
                "SparkDFDatasourceInMemoryBatchKwargs 'dataset' must be a spark DataFrame"
            )


class SqlAlchemyDatasourceTableBatchKwargs(SqlAlchemyDatasourceBatchKwargs):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if "table" not in self:
            raise InvalidBatchKwargsError(
                "SqlAlchemyDatasourceTableBatchKwargs requires a 'table' element"
            )

    @property
    def table(self):
        return self.get("table")


class SqlAlchemyDatasourceQueryBatchKwargs(SqlAlchemyDatasourceBatchKwargs):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if "query" not in self:
            raise InvalidBatchKwargsError(
                "SqlAlchemyDatasourceQueryBatchKwargs requires a 'query' element"
            )

    @property
    def query(self):
        return self.get("query")

    @property
    def query_parameters(self):
        return self.get("query_parameters")


class SparkDFDatasourceQueryBatchKwargs(SparkDFDatasourceBatchKwargs):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if "query" not in self:
            raise InvalidBatchKwargsError(
                "SparkDFDatasourceQueryBatchKwargs requires a 'query' element"
            )

    @property
    def query(self):
        return self.get("query")
