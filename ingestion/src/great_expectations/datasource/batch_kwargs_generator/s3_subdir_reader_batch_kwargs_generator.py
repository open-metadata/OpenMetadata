import logging
import os
import warnings
from pathlib import Path
from urllib.parse import urlparse, urlunparse

try:
    import s3fs
except ImportError:
    s3fs = None

from great_expectations.datasource.batch_kwargs_generator.batch_kwargs_generator import (
    BatchKwargsGenerator,
)
from great_expectations.datasource.types import PathBatchKwargs, S3BatchKwargs
from great_expectations.exceptions import BatchKwargsError

logger = logging.getLogger(__name__)

KNOWN_EXTENSIONS = [
    ".csv",
    ".tsv",
    ".parquet",
    ".xls",
    ".xlsx",
    ".json",
    ".csv.gz",
    ".tsv.gz",
    ".feather",
    ".pkl",
]


class S3SubdirReaderBatchKwargsGenerator(BatchKwargsGenerator):
    """The SubdirReaderBatchKwargsGenerator inspects a filesystem and produces path-based batch_kwargs.

    SubdirReaderBatchKwargsGenerator recognizes data assets using two criteria:
      - for files directly in 'base_directory' with recognized extensions (.csv, .tsv, .parquet, .xls, .xlsx, .json
        .csv.gz, tsv.gz, .feather, .pkl), it uses the name of the file without the extension
      - for other files or directories in 'base_directory', is uses the file or directory name

    SubdirReaderBatchKwargsGenerator sees all files inside a directory of base_directory as batches of one datasource.

    SubdirReaderBatchKwargsGenerator can also include configured reader_options which will be added to batch_kwargs generated
    by this generator.
    """

    _default_reader_options = {}
    recognized_batch_parameters = {"data_asset_name", "partition_id"}

    def __init__(
        self,
        name="default",
        datasource=None,
        bucket=None,
        boto3_options=None,
        base_directory="/data",
        reader_options=None,
        known_extensions=None,
        reader_method=None,
    ):
        super().__init__(name, datasource=datasource)

        if not s3fs:
            raise ImportError("ModuleNotFoundError: No module named 's3fs'")

        if reader_options is None:
            reader_options = self._default_reader_options

        if known_extensions is None:
            known_extensions = KNOWN_EXTENSIONS

        self._known_extensions = known_extensions
        self._reader_options = reader_options
        self._reader_method = reader_method
        self._base_directory = base_directory
        if boto3_options is None:
            boto3_options = {}
        # s3fs can read credentials from ~/.aws/credentials, same as boto3
        client_kwargs = {}
        if boto3_options.get("endpoint_url"):
            client_kwargs["endpoint_url"] = boto3_options.get("endpoint_url")
        self.fs = s3fs.S3FileSystem(anon=False, client_kwargs=client_kwargs)

    @property
    def reader_options(self):
        return self._reader_options

    @property
    def known_extensions(self):
        return self._known_extensions

    @property
    def reader_method(self):
        return self._reader_method

    @property
    def base_directory(self):
        # A base path for S3 - s3a://bucket/prefix/files
        return self._base_directory

    def get_available_data_asset_names(self):
        if not self.fs.isdir(self.base_directory):
            return {"names": [], "is_complete_list": True}
        known_assets = self._get_valid_file_options(base_directory=self.base_directory)
        return {"names": known_assets, "is_complete_list": True}

    # TODO: deprecate generator_asset argument
    def get_available_partition_ids(self, generator_asset=None, data_asset_name=None):
        assert (generator_asset and not data_asset_name) or (
            not generator_asset and data_asset_name
        ), "Please provide either generator_asset or data_asset_name."
        if generator_asset:
            warnings.warn(
                "The 'generator_asset' argument will be deprecated and renamed to 'data_asset_name'. "
                "Please update code accordingly.",
                DeprecationWarning,
            )
            data_asset_name = generator_asset

        # If the generator asset names a single known *file*, return ONLY that
        for extension in self.known_extensions:
            if self.fs.isfile(
                os.path.join(self.base_directory, data_asset_name + extension)
            ):
                return [data_asset_name]
        if self.fs.isfile(os.path.join(self.base_directory, data_asset_name)):
            return [data_asset_name]

        # Otherwise, subdir files are partition ids
        return [
            path
            for (path, type) in self._get_valid_file_options(
                base_directory=os.path.join(self.base_directory, data_asset_name)
            )
        ]

    def _build_batch_kwargs(self, batch_parameters):
        """

        Args:
            batch_parameters:

        Returns:
            batch_kwargs

        """
        try:
            data_asset_name = batch_parameters.pop("data_asset_name")
        except KeyError:
            raise BatchKwargsError(
                "Unable to build BatchKwargs: no name provided in batch_parameters.",
                batch_kwargs=batch_parameters,
            )

        if "partition_id" in batch_parameters:
            partition_id = batch_parameters.pop("partition_id")
            # Find the path
            path = None
            for extension in self.known_extensions:
                if self.fs.isfile(
                    os.path.join(
                        self.base_directory, data_asset_name, partition_id + extension
                    )
                ):
                    path = os.path.join(
                        self.base_directory, data_asset_name, partition_id + extension
                    )

            if path is None:
                logger.warning(
                    "Unable to find path with the provided partition; searching for asset-name partitions."
                )
                # Fall through to this case in the event that there is not a subdir available, or if partition_id was
                # not provided
                if self.fs.isfile(os.path.join(self.base_directory, data_asset_name)):
                    path = os.path.join(self.base_directory, data_asset_name)

                for extension in self.known_extensions:
                    if self.fs.isfile(
                        os.path.join(self.base_directory, data_asset_name + extension)
                    ):
                        path = os.path.join(
                            self.base_directory, data_asset_name + extension
                        )

            if path is None:
                raise BatchKwargsError(
                    "Unable to build batch kwargs from for asset '%s'"
                    % data_asset_name,
                    batch_parameters,
                )
            return self._build_batch_kwargs_from_path(path, **batch_parameters)

        else:
            return self.yield_batch_kwargs(
                data_asset_name=data_asset_name, **batch_parameters
            )

    def _get_valid_file_options(self, base_directory=None):
        valid_options = []
        if base_directory is None:
            base_directory = self.base_directory
        file_options = self.fs.listdir(base_directory)
        for file_option in file_options:
            file_option = file_option["Key"]
            file_option = file_option.split("/")[
                -1
            ]  # fs.listdir with return full path unlike os.listdir
            for extension in self.known_extensions:
                if (
                    file_option.endswith(extension)
                    and not file_option.startswith(".")
                    and (file_option[: -len(extension)], "file") not in valid_options
                ):
                    valid_options.append((file_option[: -len(extension)], "file"))
                elif self.fs.isdir(os.path.join(self.base_directory, file_option)):
                    # Make sure there's at least one valid file inside the subdir
                    subdir_options = self._get_valid_file_options(
                        base_directory=os.path.join(base_directory, file_option)
                    )
                    if (
                        len(subdir_options) > 0
                        and (file_option, "directory") not in valid_options
                    ):
                        valid_options.append((file_option, "directory"))
        return valid_options

    def _get_iterator(self, data_asset_name, reader_options=None, limit=None):
        logger.debug(
            "Beginning SubdirReaderBatchKwargsGenerator _get_iterator for data_asset_name: %s"
            % data_asset_name
        )
        # If the data asset is a file, then return the path.
        # Otherwise, use files in a subdir as batches
        if self.fs.isdir(os.path.join(self.base_directory, data_asset_name)):
            subdir_options = os.listdir(
                os.path.join(self.base_directory, data_asset_name)
            )
            batches = []
            for file_option in subdir_options:
                for extension in self.known_extensions:
                    if file_option.endswith(extension) and not file_option.startswith(
                        "."
                    ):
                        batches.append(
                            os.path.join(
                                self.base_directory, data_asset_name, file_option
                            )
                        )

            return self._build_batch_kwargs_path_iter(
                batches, reader_options=reader_options, limit=limit
            )
        else:
            for extension in self.known_extensions:
                path = os.path.join(self.base_directory, data_asset_name + extension)
                path = self._window_to_s3_path(path)
                if self.fs.isfile(path):
                    return iter(
                        [
                            self._build_batch_kwargs_from_path(
                                path, reader_options=reader_options, limit=limit
                            )
                        ]
                    )
            # If we haven't returned yet, raise
            raise BatchKwargsError(
                "No valid files found when searching {:s} using configured known_extensions: "
                "{:s} ".format(
                    os.path.join(self.base_directory, data_asset_name),
                    ", ".join(map(str, self.known_extensions)),
                ),
                batch_kwargs=PathBatchKwargs(
                    path=os.path.join(self.base_directory, data_asset_name)
                ),
            )

    def _build_batch_kwargs_path_iter(self, path_list, reader_options=None, limit=None):
        for path in path_list:
            yield self._build_batch_kwargs_from_path(
                path, reader_options=reader_options, limit=limit
            )

    def _build_batch_kwargs_from_path(
        self, path, reader_method=None, reader_options=None, limit=None
    ):
        batch_kwargs = self._datasource.process_batch_parameters(
            reader_method=reader_method or self.reader_method,
            reader_options=reader_options or self.reader_options,
            limit=limit,
        )
        if "s3a://" not in path:
            path = "s3a://" + path
        batch_kwargs["s3"] = path
        batch_kwargs["datasource"] = self._datasource.name

        return S3BatchKwargs(batch_kwargs)

    def _window_to_s3_path(self, path: str):
        """
        To handle window "\" path. "s3://bucket\\prefix" => "s3://bucket/prefix"
        >>> path = os.path.join("s3://bucket", "prefix")
        >>> window_to_s3_path(path)
        >>>
        """

        s3_url = urlparse(path)
        s3_path = Path(s3_url.path)
        s3_new_url = urlunparse(
            (
                s3_url.scheme,
                s3_url.netloc,
                s3_path.as_posix(),
                s3_url.params,
                s3_url.query,
                s3_url.fragment,
            )
        )
        return s3_new_url
