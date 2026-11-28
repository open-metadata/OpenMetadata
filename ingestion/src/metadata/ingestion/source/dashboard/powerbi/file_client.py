#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
File Client for PowerBi
"""

import json
import os
import shutil
import traceback
import zipfile
from collections import defaultdict
from contextlib import suppress
from functools import singledispatch
from pathlib import Path

from metadata.clients.aws_client import AWSClient
from metadata.clients.azure_client import AzureClient
from metadata.generated.schema.entity.services.connections.dashboard.powerbi.azureConfig import (
    AzureConfig,
)
from metadata.generated.schema.entity.services.connections.dashboard.powerbi.gcsConfig import (
    GCSConfig,
)
from metadata.generated.schema.entity.services.connections.dashboard.powerbi.s3Config import (
    S3Config,
)
from metadata.generated.schema.entity.services.connections.dashboard.powerBIConnection import (
    LocalConfig,
    PowerBIConnection,
)
from metadata.ingestion.connections.source_api_client import TrackedREST
from metadata.ingestion.source.dashboard.powerbi.models import (
    ConnectionFile,
    DataModelSchema,
    DatasetExpression,
    PowerBiTable,
)
from metadata.ingestion.source.dashboard.powerbi.tmdl_parser import parse_tmdl_directory
from metadata.readers.file.config_source_factory import get_reader
from metadata.readers.file.local import LocalReader
from metadata.utils.credentials import (
    get_gcp_impersonate_credentials_or_none,
    set_google_credentials,
)
from metadata.utils.logger import utils_logger
from metadata.utils.s3_utils import list_s3_objects

logger = utils_logger()


def get_prefix_config(config) -> tuple[str | None, str | None]:
    """
    Return (bucket, prefix) tuple
    """
    if config.prefixConfig:
        return (
            config.prefixConfig.bucketName,
            config.prefixConfig.objectPrefix,
        )
    return None, None


def _ensure_extract_dir(path: str | None) -> None:
    if path is None:
        raise PowerBIFileConfigException("PowerBI .pbit extraction directory is not configured")
    Path(path).mkdir(parents=True, exist_ok=True)


SUPPORTED_FILE_EXTENSIONS = (".pbit", ".tmdl")
SUPPORTED_EXACT_FILENAMES = frozenset({".platform", "definition.pbism", "definition.pbir"})


def _is_supported_blob(filename: str) -> bool:
    lower_name = filename.lower()
    return lower_name.endswith(SUPPORTED_FILE_EXTENSIONS) or lower_name in SUPPORTED_EXACT_FILENAMES


def get_blobs_grouped_by_dir(blobs: list[str]) -> dict[str, list[str]]:
    """
    Method to group the objs by the dir
    """
    blob_grouped_by_directory = defaultdict(list)
    for blob in blobs or []:
        subdirectory = blob.rsplit("/", 1)[0] if "/" in blob else ""
        blob_file_name = blob.rsplit("/", 1)[1] if "/" in blob else blob
        if _is_supported_blob(blob_file_name):
            blob_grouped_by_directory[subdirectory].append(blob)
    return blob_grouped_by_directory


def _safe_local_path(extract_dir: str, blob: str) -> str:
    """Resolve the local download path for a blob and confirm it stays inside
    ``extract_dir``.

    Blob names come from the cloud storage listing and may contain ``..`` or
    absolute-path components. Joining them naively would let a crafted object key
    write outside the extract directory (path traversal / arbitrary file write), so
    the resolved path is validated against the resolved extract directory.
    """
    base = Path(extract_dir).resolve()
    target = (base / blob).resolve()
    if target == base or not target.is_relative_to(base):
        raise PowerBIFileConfigException(f"Skipping .pbit object key that escapes the extract directory: {blob}")
    return str(target)


def download_pbit_files(
    blob_grouped_by_directory: dict,
    config,
    client,
    bucket_name: str | None,
    extract_dir: str,
):
    """
    Method to download the files from sources
    """
    for blobs in blob_grouped_by_directory.values():
        kwargs = {}
        if bucket_name:
            kwargs = {"bucket_name": bucket_name}
        for blob in blobs:
            if not blob:
                continue
            try:
                # validate per blob so one escaping key does not skip the rest
                local_file_path = _safe_local_path(extract_dir, blob)
            except PowerBIFileConfigException as exc:
                logger.warning(exc)
                continue
            reader = get_reader(config_source=config, client=client)
            # create the required dir before downloading
            os.makedirs(os.path.dirname(local_file_path), exist_ok=True)  # noqa: PTH103, PTH120
            reader.download(path=blob, local_file_path=local_file_path, **kwargs)


def _extract_pbit(zip_ref: zipfile.ZipFile, extract_dir: str) -> None:
    """Extract a .pbit archive, skipping any member whose path escapes ``extract_dir``.

    A .pbit is a ZIP whose member names are attacker-controlled when the file comes
    from a shared bucket or folder. ``extractall`` happens to rewrite ``..`` and
    absolute names today, but validating each member keeps the guarantee explicit
    and reports the crafted entry instead of silently relocating it.
    """
    base = Path(extract_dir).resolve()
    for member in zip_ref.infolist():
        if not (base / member.filename).resolve().is_relative_to(base):
            logger.warning("Skipping .pbit entry that escapes the extract directory: %r", member.filename)
            continue
        zip_ref.extract(member, base)


def _get_datamodel_schema_list(path: str) -> list[DataModelSchema] | None:
    """
    Method maps the json to datamodel schema model
    """
    reader = LocalReader(f"{path}/extracted")
    connection_files = reader.get_local_files(search_key="Connections")
    datamodel_schema_list = []
    for connection_file in connection_files:
        try:
            datamodel_schema = DataModelSchema()
            with open(connection_file, "rb") as file:  # noqa: PTH123
                connection_json_file = json.load(file)
                datamodel_schema.connectionFile = ConnectionFile(**connection_json_file)

            datamodel_schema_file = connection_file.replace("Connections", "DataModelSchema")
            with open(datamodel_schema_file, "rb") as file:  # noqa: PTH123
                data_model_schema_json_file = json.load(file)
                model_dict = data_model_schema_json_file.get("model") or {}
                datamodel_schema.tables = [PowerBiTable(**table) for table in model_dict.get("tables") or []]
                raw_expressions = model_dict.get("expressions") or []
                if raw_expressions:
                    datamodel_schema.expressions = [DatasetExpression(**expr) for expr in raw_expressions]
            if datamodel_schema.tables and datamodel_schema.connectionFile:
                datamodel_schema_list.append(datamodel_schema)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Error reading and mapping the datamodel schema file for {connection_file}: {exc}")
    return datamodel_schema_list


def _dir_has_tmdl(directory: Path) -> bool:
    if not directory.is_dir():
        return False
    for entry in directory.iterdir():
        if entry.is_file() and entry.name.lower().endswith(".tmdl"):
            return True
    tables_dir = directory / "tables"
    if tables_dir.is_dir():
        for entry in tables_dir.iterdir():
            if entry.is_file() and entry.name.lower().endswith(".tmdl"):
                return True
    return False


def _discover_tmdl_roots(base_path: Path) -> list[Path]:
    """Discover TMDL semantic model roots under `base_path` without double-counting."""
    if not base_path.is_dir():
        return []

    roots: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(base_path):
        current = Path(dirpath)
        dirnames.sort()
        filenames.sort()

        if current == base_path and "extracted" in dirnames:
            dirnames.remove("extracted")

        lower_files = {f.lower() for f in filenames}
        is_semantic_model_dir = current.name.lower().endswith(".semanticmodel") or "definition.pbism" in lower_files
        if is_semantic_model_dir and _dir_has_tmdl(current / "definition"):
            roots.append(current)
            dirnames.clear()
            continue

        if current.name.lower() == "definition" and _dir_has_tmdl(current):
            roots.append(current)
            dirnames.clear()
            continue

        has_top_marker = "model.tmdl" in lower_files or "database.tmdl" in lower_files
        has_tables_tmdl = "tables" in dirnames and _dir_has_tmdl(current / "tables")
        if has_top_marker or has_tables_tmdl:
            roots.append(current)
            dirnames.clear()

    return roots


def _get_tmdl_datamodel_schemas(path: str) -> list[DataModelSchema]:
    """Discover and parse all TMDL semantic model directories under `path`."""
    schemas: list[DataModelSchema] = []
    for tmdl_root in _discover_tmdl_roots(Path(path)):
        try:
            schema = parse_tmdl_directory(tmdl_root)
            if schema is not None:
                schemas.append(schema)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Skipping TMDL directory %s: %s", tmdl_root, exc)
    return schemas


def get_datamodel_schema_files_from_pbit(path: str) -> list[DataModelSchema] | None:
    """
    Method to unzip the locally saved pbit files and parse TMDL directories to get the schema files
    """
    try:
        reader = LocalReader(path)
        file_paths = reader.get_local_files(search_key=".pbit")

        for file_path in file_paths:
            # One unreadable .pbit must not drop the schemas of the others. Damaged
            # archives fail during extraction with many types (BadZipFile, zlib.error,
            # EOFError, RuntimeError for encrypted entries, NotImplementedError for
            # unsupported compression), so any failure skips only this file.
            try:
                with zipfile.ZipFile(file_path, "r") as zip_ref:
                    _extract_pbit(zip_ref, f"{path}/extracted/{file_path.split('/')[-1].split('.')[0]}")
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning("Skipping .pbit file %s: %s", file_path, exc)

        pbit_schemas = _get_datamodel_schema_list(path) or []
        tmdl_schemas = _get_tmdl_datamodel_schemas(path)
        return pbit_schemas + tmdl_schemas

    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.error(f"Error extracting pbit files: {exc}")
    return None


@singledispatch
def get_pbit_files(config):
    """
    Single dispatch method to get the pbit files from different sources
    """

    if config:
        raise NotImplementedError(f"Config not implemented for type {type(config)}: {config}")


@get_pbit_files.register
def _(config: S3Config):
    try:
        _ensure_extract_dir(config.pbitFilesExtractDir)
        bucket_name, prefix = get_prefix_config(config)

        client = AWSClient(config.securityConfig).get_client(service_name="s3")

        if not bucket_name:
            buckets = client.list_buckets()["Buckets"]
        else:
            buckets = [{"Name": bucket_name}]
        for bucket in buckets:
            kwargs = {"Bucket": bucket["Name"]}
            if prefix:
                kwargs["Prefix"] = prefix if prefix.endswith("/") else f"{prefix}/"

            # Download the pbit files and store them in the local path
            download_pbit_files(
                blob_grouped_by_directory=get_blobs_grouped_by_dir(
                    blobs=[key["Key"] for key in list_s3_objects(client, **kwargs)]
                ),
                config=config,
                client=client,
                bucket_name=bucket["Name"],
                extract_dir=config.pbitFilesExtractDir,
            )
        # Extract the datamodel schema files from pbit files and return the list of datamodel schema objects
        return get_datamodel_schema_files_from_pbit(path=config.pbitFilesExtractDir)

    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise PowerBIFileConfigException(f"Error fetching .pbit files from s3: {exc}")  # noqa: B904


@get_pbit_files.register
def _(config: AzureConfig):
    try:
        _ensure_extract_dir(config.pbitFilesExtractDir)
        bucket_name, prefix = get_prefix_config(config)

        client = AzureClient(config.securityConfig).create_blob_client()

        if not bucket_name:
            container_dicts = client.list_containers()
            containers = [client.get_container_client(container["name"]) for container in container_dicts]
        else:
            container_client = client.get_container_client(bucket_name)
            containers = [container_client]
        for container_client in containers:
            if prefix:
                blob_list = container_client.list_blobs(name_starts_with=prefix)
            else:
                blob_list = container_client.list_blobs()

            # Download the pbit files and store them in the local path
            download_pbit_files(
                blob_grouped_by_directory=get_blobs_grouped_by_dir(blobs=[blob.name for blob in blob_list]),
                config=config,
                client=client,
                bucket_name=container_client.container_name,
                extract_dir=config.pbitFilesExtractDir,
            )
        # Extract the datamodel schema files from pbit files and return the list of datamodel schema objects
        return get_datamodel_schema_files_from_pbit(path=config.pbitFilesExtractDir)

    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise PowerBIFileConfigException(  # noqa: B904
            f"Error fetching .pbit files from Azure: {exc}"
        )


@get_pbit_files.register
def _(config: GCSConfig):
    try:
        _ensure_extract_dir(config.pbitFilesExtractDir)
        bucket_name, prefix = get_prefix_config(config)
        from google.cloud import storage  # pylint: disable=import-outside-toplevel

        set_google_credentials(gcp_credentials=config.securityConfig)

        client = storage.Client(credentials=get_gcp_impersonate_credentials_or_none(config.securityConfig))
        if not bucket_name:
            buckets = client.list_buckets()
        else:
            buckets = [client.get_bucket(bucket_name)]
        for bucket in buckets:
            if prefix:
                obj_list = client.list_blobs(bucket.name, prefix=prefix)
            else:
                obj_list = client.list_blobs(bucket.name)

            download_pbit_files(
                blob_grouped_by_directory=get_blobs_grouped_by_dir(blobs=[blob.name for blob in obj_list]),
                config=config,
                client=client,
                bucket_name=bucket.name,
                extract_dir=config.pbitFilesExtractDir,
            )
        # Extract the datamodel schema files from pbit files and return the list of datamodel schema objects
        return get_datamodel_schema_files_from_pbit(path=config.pbitFilesExtractDir)

    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise PowerBIFileConfigException(f"Error fetching .pbit files from GCS: {exc}")  # noqa: B904


@get_pbit_files.register
def _(config: LocalConfig):
    try:
        return get_datamodel_schema_files_from_pbit(path=config.path)
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.error(f"Error getting pbit files from local: {exc}")
    return None


class PowerBIFileConfigException(Exception):  # noqa: N818
    """
    Raise when encountering errors while extracting pbit files
    """


class PowerBiFileClient:
    """
    File client for PowerBi
    """

    client: TrackedREST

    def __init__(self, config: PowerBIConnection):
        self.config = config

    def get_data_model_schema_mappings(self) -> list[DataModelSchema] | None:
        """
        Get the data model schema mappings
        """
        return get_pbit_files(self.config.pbitFilesSource)

    def delete_tmp_files(self):
        """
        Method to remove the files after ingestion is completed
        """
        source = self.config.pbitFilesSource
        extract_dir = source.pbitFilesExtractDir if source is not None else None
        if extract_dir is None:
            return
        if isinstance(source, LocalConfig):
            extract_path = Path(extract_dir).resolve()
            if source.path:
                local_path = Path(source.path).resolve()
                if (
                    local_path == extract_path
                    or local_path.is_relative_to(extract_path)
                    or extract_path.is_relative_to(local_path)
                ):
                    logger.debug(
                        "Skipping deletion of %s because it overlaps with local source path %s",
                        extract_dir,
                        source.path,
                    )
                    return
            if extract_path.is_dir() and _discover_tmdl_roots(extract_path):
                logger.debug(
                    "Skipping deletion of %s because it contains local TMDL files",
                    extract_dir,
                )
                return
        with suppress(FileNotFoundError):
            shutil.rmtree(extract_dir)
