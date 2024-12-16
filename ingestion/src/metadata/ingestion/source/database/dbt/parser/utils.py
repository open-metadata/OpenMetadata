from dbt_artifacts_parser.parser import parse_manifest as dbt_parse_manifest
from dbt_artifacts_parser.parsers.utils import get_dbt_schema_version
from dbt_artifacts_parser.parsers.version_map import ArtifactTypes

from metadata.ingestion.source.database.dbt.parser.manifest_v12 import ManifestV12


def parse_manifest(manifest: dict):
    """Parse manifest.json

    Args:
        manifest: A dict of manifest.json

    Returns:
       Union[
           ManifestV1, ManifestV2, ManifestV3, ManifestV4, ManifestV5,
           ManifestV6, ManifestV7, ManifestV8, ManifestV9, ManifestV10,
           ManifestV11, ManifestV12,
        ]
    """
    dbt_schema_version = get_dbt_schema_version(artifact_json=manifest)
    if dbt_schema_version == ArtifactTypes.MANIFEST_V12.value.dbt_schema_version:
        return ManifestV12(**manifest)
    return dbt_parse_manifest(manifest)
