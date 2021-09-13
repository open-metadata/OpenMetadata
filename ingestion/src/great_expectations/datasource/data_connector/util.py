# Utility methods for dealing with DataConnector objects

import copy
import logging
import os
import re
import sre_constants
import sre_parse
import warnings
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from great_expectations.core.batch import BatchDefinition, BatchRequestBase
from great_expectations.core.id_dict import IDDict
from great_expectations.data_context.util import instantiate_class_from_config
from great_expectations.datasource.data_connector.sorter import Sorter

logger = logging.getLogger(__name__)

try:
    from azure.storage.blob import BlobPrefix
except ImportError:
    BlobPrefix = None
    logger.debug(
        "Unable to load azure types; install optional Azure dependency for support."
    )

try:
    from google.cloud import storage
except ImportError:
    storage = None
    logger.debug(
        "Unable to load GCS connection object; install optional Google dependency for support"
    )

try:
    import pyspark
    import pyspark.sql as pyspark_sql
except ImportError:
    pyspark = None
    pyspark_sql = None
    logger.debug(
        "Unable to load pyspark and pyspark.sql; install optional Spark dependency for support."
    )


DEFAULT_DATA_ASSET_NAME: str = "DEFAULT_ASSET_NAME"


def batch_definition_matches_batch_request(
    batch_definition: BatchDefinition,
    batch_request: BatchRequestBase,
) -> bool:
    assert isinstance(batch_definition, BatchDefinition)
    assert isinstance(batch_request, BatchRequestBase)

    if (
        batch_request.datasource_name
        and batch_request.datasource_name != batch_definition.datasource_name
    ):
        return False
    if (
        batch_request.data_connector_name
        and batch_request.data_connector_name != batch_definition.data_connector_name
    ):
        return False
    if (
        batch_request.data_asset_name
        and batch_request.data_asset_name != batch_definition.data_asset_name
    ):
        return False

    if batch_request.data_connector_query:
        batch_filter_parameters: Any = batch_request.data_connector_query.get(
            "batch_filter_parameters"
        )
        if batch_filter_parameters:
            if not isinstance(batch_filter_parameters, dict):
                return False
            for key in batch_filter_parameters.keys():
                if not (
                    key in batch_definition.batch_identifiers
                    and batch_definition.batch_identifiers[key]
                    == batch_filter_parameters[key]
                ):
                    return False

    if batch_request.batch_identifiers:
        if not isinstance(batch_request.batch_identifiers, dict):
            return False
        for key in batch_request.batch_identifiers.keys():
            if not (
                key in batch_definition.batch_identifiers
                and batch_definition.batch_identifiers[key]
                == batch_request.batch_identifiers[key]
            ):
                return False

    return True


def map_data_reference_string_to_batch_definition_list_using_regex(
    datasource_name: str,
    data_connector_name: str,
    data_reference: str,
    regex_pattern: str,
    group_names: List[str],
    data_asset_name: Optional[str] = None,
) -> Optional[List[BatchDefinition]]:
    processed_data_reference: Optional[
        Tuple[str, IDDict]
    ] = convert_data_reference_string_to_batch_identifiers_using_regex(
        data_reference=data_reference,
        regex_pattern=regex_pattern,
        group_names=group_names,
    )
    if processed_data_reference is None:
        return None
    data_asset_name_from_batch_identifiers: str = processed_data_reference[0]
    batch_identifiers: IDDict = processed_data_reference[1]
    if data_asset_name is None:
        data_asset_name = data_asset_name_from_batch_identifiers

    return [
        BatchDefinition(
            datasource_name=datasource_name,
            data_connector_name=data_connector_name,
            data_asset_name=data_asset_name,
            batch_identifiers=IDDict(batch_identifiers),
        )
    ]


def convert_data_reference_string_to_batch_identifiers_using_regex(
    data_reference: str,
    regex_pattern: str,
    group_names: List[str],
) -> Optional[Tuple[str, IDDict]]:
    # noinspection PyUnresolvedReferences
    matches: Optional[re.Match] = re.match(regex_pattern, data_reference)
    if matches is None:
        return None
    groups: list = list(matches.groups())
    batch_identifiers: IDDict = IDDict(dict(zip(group_names, groups)))

    # TODO: <Alex>Accommodating "data_asset_name" inside batch_identifiers (e.g., via "group_names") is problematic; we need a better mechanism.</Alex>
    # TODO: <Alex>Update: Approach -- we can differentiate "def map_data_reference_string_to_batch_definition_list_using_regex(()" methods between ConfiguredAssetFilesystemDataConnector and InferredAssetFilesystemDataConnector so that IDDict never needs to include data_asset_name. (ref: https://superconductivedata.slack.com/archives/C01C0BVPL5Q/p1603843413329400?thread_ts=1603842470.326800&cid=C01C0BVPL5Q)</Alex>
    data_asset_name: str = DEFAULT_DATA_ASSET_NAME
    if "data_asset_name" in batch_identifiers:
        data_asset_name = batch_identifiers.pop("data_asset_name")
    return data_asset_name, batch_identifiers


def map_batch_definition_to_data_reference_string_using_regex(
    batch_definition: BatchDefinition,
    regex_pattern: str,
    group_names: List[str],
) -> str:
    if not isinstance(batch_definition, BatchDefinition):
        raise TypeError(
            "batch_definition is not of an instance of type BatchDefinition"
        )

    data_asset_name: str = batch_definition.data_asset_name
    batch_identifiers: IDDict = batch_definition.batch_identifiers
    data_reference: str = (
        convert_batch_identifiers_to_data_reference_string_using_regex(
            batch_identifiers=batch_identifiers,
            regex_pattern=regex_pattern,
            group_names=group_names,
            data_asset_name=data_asset_name,
        )
    )
    return data_reference


# TODO: <Alex>How are we able to recover the full file path, including the file extension?  Relying on file extension being part of the regex_pattern does not work when multiple file extensions are specified as part of the regex_pattern.</Alex>
def convert_batch_identifiers_to_data_reference_string_using_regex(
    batch_identifiers: IDDict,
    regex_pattern: str,
    group_names: List[str],
    data_asset_name: Optional[str] = None,
) -> str:
    if not isinstance(batch_identifiers, IDDict):
        raise TypeError("batch_identifiers is not " "an instance of type IDDict")

    template_arguments: dict = copy.deepcopy(batch_identifiers)
    # TODO: <Alex>How does "data_asset_name" factor in the computation of "converted_string"?  Does it have any effect?</Alex>
    if data_asset_name is not None:
        template_arguments["data_asset_name"] = data_asset_name

    filepath_template: str = _invert_regex_to_data_reference_template(
        regex_pattern=regex_pattern,
        group_names=group_names,
    )
    converted_string = filepath_template.format(**template_arguments)

    return converted_string


# noinspection PyUnresolvedReferences
def _invert_regex_to_data_reference_template(
    regex_pattern: str,
    group_names: List[str],
) -> str:
    r"""Create a string template based on a regex and corresponding list of group names.

    For example:

        filepath_template = _invert_regex_to_data_reference_template(
            regex_pattern=r"^(.+)_(\d+)_(\d+)\.csv$",
            group_names=["name", "timestamp", "price"],
        )
        filepath_template
        >> "{name}_{timestamp}_{price}.csv"

    Such templates are useful because they can be populated using string substitution:

        filepath_template.format(**{
            "name": "user_logs",
            "timestamp": "20200101",
            "price": "250",
        })
        >> "user_logs_20200101_250.csv"


    NOTE Abe 20201017: This method is almost certainly still brittle. I haven't exhaustively mapped the OPCODES in sre_constants
    """
    data_reference_template: str = ""
    group_name_index: int = 0

    num_groups = len(group_names)

    # print("-"*80)
    parsed_sre = sre_parse.parse(regex_pattern)
    for token, value in parsed_sre:
        if token == sre_constants.LITERAL:
            # Transcribe the character directly into the template
            data_reference_template += chr(value)

        elif token == sre_constants.SUBPATTERN:
            if not (group_name_index < num_groups):
                break
            # Replace the captured group with "{next_group_name}" in the template
            data_reference_template += "{" + group_names[group_name_index] + "}"
            group_name_index += 1

        elif token in [
            sre_constants.MAX_REPEAT,
            sre_constants.IN,
            sre_constants.BRANCH,
            sre_constants.ANY,
        ]:
            # Replace the uncaptured group a wildcard in the template
            data_reference_template += "*"

        elif token in [
            sre_constants.AT,
            sre_constants.ASSERT_NOT,
            sre_constants.ASSERT,
        ]:
            pass
        else:
            raise ValueError(
                f"Unrecognized regex token {token} in regex pattern {regex_pattern}."
            )

    # Collapse adjacent wildcards into a single wildcard
    data_reference_template: str = re.sub("\\*+", "*", data_reference_template)
    return data_reference_template


def normalize_directory_path(
    dir_path: str, root_directory_path: Optional[str] = None
) -> str:
    # If directory is a relative path, interpret it as relative to the root directory.
    if Path(dir_path).is_absolute() or root_directory_path is None:
        return dir_path
    else:
        return str(Path(root_directory_path).joinpath(dir_path))


def get_filesystem_one_level_directory_glob_path_list(
    base_directory_path: str, glob_directive: str
) -> List[str]:
    """
    List file names, relative to base_directory_path one level deep, with expansion specified by glob_directive.
    :param base_directory_path -- base directory path, relative to which file paths will be collected
    :param glob_directive -- glob expansion directive
    :returns -- list of relative file paths
    """
    globbed_paths = Path(base_directory_path).glob(glob_directive)
    path_list: List[str] = [
        os.path.relpath(str(posix_path), base_directory_path)
        for posix_path in globbed_paths
    ]
    return path_list


def list_azure_keys(
    azure,
    query_options: dict,
    recursive: bool = False,
) -> List[str]:
    """
    Utilizes the Azure Blob Storage connection object to retrieve blob names based on user-provided criteria.

    For InferredAssetAzureDataConnector, we take container and name_starts_with and search for files using RegEx at and below the level
    specified by those parameters. However, for ConfiguredAssetAzureDataConnector, we take container and name_starts_with and
    search for files using RegEx only at the level specified by that bucket and prefix.

    This restriction for the ConfiguredAssetAzureDataConnector is needed, because paths on Azure are comprised not only the leaf file name
    but the full path that includes both the prefix and the file name.  Otherwise, in the situations where multiple data assets
    share levels of a directory tree, matching files to data assets will not be possible, due to the path ambiguity.

    Args:
        azure (BlobServiceClient): Azure connnection object responsible for accessing container
        query_options (dict): Azure query attributes ("container", "name_starts_with", "delimiter")
        recursive (bool): True for InferredAssetAzureDataConnector and False for ConfiguredAssetAzureDataConnector (see above)

    Returns:
        List of keys representing Azure file paths (as filtered by the query_options dict)
    """
    container: str = query_options["container"]
    container_client = azure.get_container_client(container)

    path_list: List[str] = []

    def _walk_blob_hierarchy(name_starts_with: str) -> None:
        for item in container_client.walk_blobs(name_starts_with=name_starts_with):
            if isinstance(item, BlobPrefix):
                if recursive:
                    _walk_blob_hierarchy(name_starts_with=item.name)
            else:
                path_list.append(item.name)

    name_starts_with: str = query_options["name_starts_with"]
    _walk_blob_hierarchy(name_starts_with)

    return path_list


def list_gcs_keys(
    gcs,
    query_options: dict,
    recursive: bool = False,
) -> List[str]:
    """
    Utilizes the GCS connection object to retrieve blob names based on user-provided criteria.

    For InferredAssetGCSDataConnector, we take `bucket_or_name` and `prefix` and search for files using RegEx at and below the level
    specified by those parameters. However, for ConfiguredAssetGCSDataConnector, we take `bucket_or_name` and `prefix` and
    search for files using RegEx only at the level specified by that bucket and prefix.

    This restriction for the ConfiguredAssetGCSDataConnector is needed because paths on GCS are comprised not only the leaf file name
    but the full path that includes both the prefix and the file name. Otherwise, in the situations where multiple data assets
    share levels of a directory tree, matching files to data assets will not be possible due to the path ambiguity.

    Please note that the SDK's `list_blobs` method takes in a `delimiter` key that drastically alters the traversal of a given bucket:
        - If a delimiter is not set (default), the traversal is recursive and the output will contain all blobs in the current directory
          as well as those in any nested directories.
        - If a delimiter is set, the traversal will continue until that value is seen; as the default is "/", traversal will be scoped
          within the current directory and end before visiting nested directories.

    In order to provide users with finer control of their config while also ensuring output that is in line with the `recursive` arg,
    we deem it appropriate to manually override the value of the delimiter only in cases where it is absolutely necessary.

    Args:
        gcs (storage.Client): GCS connnection object responsible for accessing bucket
        query_options (dict): GCS query attributes ("bucket_or_name", "prefix", "delimiter", "max_results")
        recursive (bool): True for InferredAssetGCSDataConnector and False for ConfiguredAssetGCSDataConnector (see above)

    Returns:
        List of keys representing GCS file paths (as filtered by the `query_options` dict)
    """
    # Delimiter determines whether or not traversal of bucket is recursive
    # Manually set to appropriate default if not already set by user
    delimiter = query_options["delimiter"]
    if delimiter is None and not recursive:
        warnings.warn(
            'In order to access blobs with a ConfiguredAssetGCSDataConnector, \
            the delimiter that has been passed to gcs_options in your config cannot be empty; \
            please note that the value is being set to the default "/" in order to work with the Google SDK.'
        )
        query_options["delimiter"] = "/"
    elif delimiter is not None and recursive:
        warnings.warn(
            "In order to access blobs with an InferredAssetGCSDataConnector, \
            the delimiter that has been passed to gcs_options in your config must be empty; \
            please note that the value is being set to None in order to work with the Google SDK."
        )
        query_options["delimiter"] = None

    keys: List[str] = []
    for blob in gcs.list_blobs(**query_options):
        name: str = blob.name
        if name.endswith("/"):  # GCS includes directories in blob output
            continue
        keys.append(name)

    return keys


def list_s3_keys(
    s3, query_options: dict, iterator_dict: dict, recursive: bool = False
) -> str:
    """
    For InferredAssetS3DataConnector, we take bucket and prefix and search for files using RegEx at and below the level
    specified by that bucket and prefix.  However, for ConfiguredAssetS3DataConnector, we take bucket and prefix and
    search for files using RegEx only at the level specified by that bucket and prefix.  This restriction for the
    ConfiguredAssetS3DataConnector is needed, because paths on S3 are comprised not only the leaf file name but the
    full path that includes both the prefix and the file name.  Otherwise, in the situations where multiple data assets
    share levels of a directory tree, matching files to data assets will not be possible, due to the path ambiguity.
    :param s3: s3 client connection
    :param query_options: s3 query attributes ("Bucket", "Prefix", "Delimiter", "MaxKeys")
    :param iterator_dict: dictionary to manage "NextContinuationToken" (if "IsTruncated" is returned from S3)
    :param recursive: True for InferredAssetS3DataConnector and False for ConfiguredAssetS3DataConnector (see above)
    :return: string valued key representing file path on S3 (full prefix and leaf file name)
    """
    if iterator_dict is None:
        iterator_dict = {}

    if "continuation_token" in iterator_dict:
        query_options.update({"ContinuationToken": iterator_dict["continuation_token"]})

    logger.debug(f"Fetching objects from S3 with query options: {query_options}")

    s3_objects_info: dict = s3.list_objects_v2(**query_options)

    if not any(key in s3_objects_info for key in ["Contents", "CommonPrefixes"]):
        raise ValueError("S3 query may not have been configured correctly.")

    if "Contents" in s3_objects_info:
        keys: List[str] = [
            item["Key"] for item in s3_objects_info["Contents"] if item["Size"] > 0
        ]
        yield from keys
    if recursive and "CommonPrefixes" in s3_objects_info:
        common_prefixes: List[Dict[str, Any]] = s3_objects_info["CommonPrefixes"]
        for prefix_info in common_prefixes:
            query_options_tmp: dict = copy.deepcopy(query_options)
            query_options_tmp.update({"Prefix": prefix_info["Prefix"]})
            # Recursively fetch from updated prefix
            yield from list_s3_keys(
                s3=s3,
                query_options=query_options_tmp,
                iterator_dict={},
                recursive=recursive,
            )
    if s3_objects_info["IsTruncated"]:
        iterator_dict["continuation_token"] = s3_objects_info["NextContinuationToken"]
        # Recursively fetch more
        yield from list_s3_keys(
            s3=s3,
            query_options=query_options,
            iterator_dict=iterator_dict,
            recursive=recursive,
        )

    if "continuation_token" in iterator_dict:
        # Make sure we clear the token once we've gotten fully through
        del iterator_dict["continuation_token"]


# TODO: <Alex>We need to move sorters and _validate_sorters_configuration() to DataConnector</Alex>
# As a rule, this method should not be in "util", but in the specific high-level "DataConnector" class, where it is
# called (and declared as private in that class).  Currently, this is "FilePathDataConnector".  However, since this
# method is also used in tests, it can remain in the present "util" module (as an exception to the above stated rule).
def build_sorters_from_config(config_list: List[Dict[str, Any]]) -> Optional[dict]:
    sorter_dict: Dict[str, Sorter] = {}
    if config_list is not None:
        for sorter_config in config_list:
            # if sorters were not configured
            if sorter_config is None:
                return None
            if "name" not in sorter_config:
                raise ValueError("Sorter config should have a name")
            sorter_name: str = sorter_config["name"]
            new_sorter: Sorter = _build_sorter_from_config(sorter_config=sorter_config)
            sorter_dict[sorter_name] = new_sorter
    return sorter_dict


def _build_sorter_from_config(sorter_config: Dict[str, Any]) -> Sorter:
    """Build a Sorter using the provided configuration and return the newly-built Sorter."""
    runtime_environment: dict = {"name": sorter_config["name"]}
    sorter: Sorter = instantiate_class_from_config(
        config=sorter_config,
        runtime_environment=runtime_environment,
        config_defaults={
            "module_name": "great_expectations.datasource.data_connector.sorter"
        },
    )
    return sorter
