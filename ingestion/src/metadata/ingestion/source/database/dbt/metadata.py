#  pylint: disable=too-many-lines
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
DBT source methods.
"""
import traceback
from copy import deepcopy
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Union

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestDefinition import (
    CreateTestDefinitionRequest,
)
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.generated.schema.entity.data.table import (
    Column,
    DataModel,
    ModelType,
    Table,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testDefinition import (
    EntityType,
    TestDefinition,
    TestPlatform,
)
from metadata.generated.schema.type.basic import (
    FullyQualifiedEntityName,
    SqlQuery,
    Timestamp,
    Uuid,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper
from metadata.ingestion.lineage.sql_lineage import get_lineage_by_query
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.ometa_lineage import OMetaLineageRequest
from metadata.ingestion.models.patch_request import PatchedEntity, PatchRequest
from metadata.ingestion.models.table_metadata import ColumnDescription
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.database.database_service import DataModelLink
from metadata.ingestion.source.database.dbt.constants import (
    DBT_RUN_RESULT_DATE_FORMAT,
    REQUIRED_CATALOG_KEYS,
    REQUIRED_EXPOSURE_KEYS,
    REQUIRED_MANIFEST_KEYS,
    DbtCommonEnum,
    DbtTestFailureEnum,
    DbtTestSuccessEnum,
    ExposureTypeMap,
    SkipResourceTypeEnum,
)
from metadata.ingestion.source.database.dbt.dbt_service import (
    DbtFiles,
    DbtObjects,
    DbtServiceSource,
)
from metadata.ingestion.source.database.dbt.dbt_utils import (
    check_ephemeral_node,
    create_test_case_parameter_definitions,
    create_test_case_parameter_values,
    find_domain_by_name,
    format_domain_reference,
    format_validation_error_message,
    generate_entity_link,
    get_corrected_name,
    get_data_model_path,
    get_dbt_compiled_query,
    get_dbt_model_name,
    get_dbt_raw_query,
    validate_custom_property_value,
)
from metadata.ingestion.source.database.dbt.models import DbtMeta
from metadata.utils import fqn
from metadata.utils.elasticsearch import get_entity_from_es_result
from metadata.utils.entity_link import get_table_fqn
from metadata.utils.filters import filter_by_tag
from metadata.utils.logger import ingestion_logger
from metadata.utils.tag_utils import get_ometa_tag_and_classification, get_tag_labels
from metadata.utils.time_utils import datetime_to_timestamp

logger = ingestion_logger()


class InvalidServiceException(Exception):
    """
    The service passed in config is not found
    """


class DbtSource(DbtServiceSource):
    """
    Class defines method to extract metadata from DBT
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.source_config = self.config.sourceConfig.config
        self.metadata = metadata
        self.tag_classification_name = (
            self.source_config.dbtClassificationName
            if self.source_config.dbtClassificationName
            else "dbtTags"
        )
        self.omd_custom_properties = {}
        self.extracted_custom_properties = {}
        self.extracted_domains = {}
        self._load_omd_custom_properties()

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        return cls(config, metadata)

    def test_connection(self) -> None:
        """
        DBT does not need to connect to any source to process information
        """

    def prepare(self):
        """
        By default for DBT nothing is required to be prepared
        """

    def _load_omd_custom_properties(self):
        """
        Loads custom properties definitions for tables
        """
        try:
            response = self.metadata.client.get(
                f"/metadata/types/name/table?fields=customProperties"
            )

            if response and "customProperties" in response:
                for prop in response["customProperties"]:
                    self.omd_custom_properties[prop["name"]] = prop

            logger.debug(
                f"Loaded {len(self.omd_custom_properties)} custom properties for tables"
            )
        except Exception as exc:
            logger.warning(f"Error loading custom properties: {exc}")

    def get_dbt_domain(self, manifest_node: Any) -> Optional[EntityReference]:
        """
        Extracts domain from meta.openmetadata.domain and returns EntityReference
        """
        try:
            if (
                not manifest_node
                or not hasattr(manifest_node, "meta")
                or not manifest_node.meta
            ):
                return None

            dbt_meta_info = DbtMeta(**manifest_node.meta)
            if dbt_meta_info.openmetadata and dbt_meta_info.openmetadata.domain:
                domain_name = dbt_meta_info.openmetadata.domain
                domain_entity = find_domain_by_name(self.metadata, domain_name)

                if domain_entity:
                    domain_ref_data = format_domain_reference(domain_entity)
                    if domain_ref_data:
                        entity_ref = EntityReference(**domain_ref_data)
                        return entity_ref
                else:
                    logger.warning(f"Domain '{domain_name}' not found in OpenMetadata")

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to ingest domain from DBT due to: {exc}")

        return None

    def get_dbt_owner(
        self, manifest_node: Any, catalog_node: Optional[Any]
    ) -> Optional[EntityReferenceList]:
        """
        Returns dbt owner with priority:
        1. manifest_node.meta.openmetadata.owner (OpenMetadata docs format - HIGHEST PRIORITY)
        2. manifest_node.meta.owner (old format)
        3. catalog_node.metadata.owner (standard DBT location - LOWEST PRIORITY)
        """
        try:
            dbt_owner = None

            # PRIORITY 1: Check manifest node meta.openmetadata.owner
            if manifest_node and manifest_node.meta:
                openmetadata = manifest_node.meta.get("openmetadata", {})
                if openmetadata:
                    openmetadata_owner = openmetadata.get("owner")
                    if openmetadata_owner:
                        dbt_owner = openmetadata_owner

            # PRIORITY 2: Check old format meta.owner
            if not dbt_owner:
                if manifest_node and manifest_node.meta:
                    old_owner = manifest_node.meta.get(DbtCommonEnum.OWNER.value)
                    if old_owner:
                        dbt_owner = old_owner

            # PRIORITY 3: Check catalog node
            if not dbt_owner:
                if catalog_node:
                    try:
                        catalog_owner = catalog_node.metadata.owner
                        if catalog_owner:
                            dbt_owner = catalog_owner
                    except Exception as catalog_exc:
                        logger.debug(
                            f"Error accessing catalog_node.metadata.owner: {catalog_exc}"
                        )

            if dbt_owner and isinstance(dbt_owner, str):
                owner_ref = self.metadata.get_reference_by_name(
                    name=dbt_owner, is_owner=True
                ) or self.metadata.get_reference_by_email(email=dbt_owner)
                if owner_ref:
                    return owner_ref
                logger.warning(
                    "Unable to ingest owner from DBT since no user or"
                    f" team was found with name {dbt_owner}"
                )
            elif dbt_owner and isinstance(dbt_owner, list):
                owner_list = EntityReferenceList(root=[])
                for owner_name in dbt_owner:
                    owner_ref = self.metadata.get_reference_by_name(
                        name=owner_name, is_owner=True
                    ) or self.metadata.get_reference_by_email(email=owner_name)
                    if owner_ref:
                        owner_list.root.extend(owner_ref.root)
                    else:
                        logger.warning(
                            "Unable to ingest owner from DBT since no user or"
                            f" team was found with name {owner_name}"
                        )
                if owner_list.root:
                    return owner_list
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to ingest owner from DBT due to: {exc}")
        return None

    def check_columns(self, catalog_node):
        for catalog_key, catalog_column in catalog_node.get("columns").items():
            if all(
                required_catalog_key in catalog_column
                for required_catalog_key in REQUIRED_CATALOG_KEYS
            ):
                logger.debug(f"Successfully Validated DBT Column: {catalog_key}")
            else:
                logger.warning(
                    f"Error validating DBT Column: {catalog_key}\n"
                    f"Please check if following keys exist for the column node: {REQUIRED_CATALOG_KEYS}"
                )

    def validate_dbt_files(self, dbt_files: DbtFiles):
        """
        Method to validate DBT files
        """
        # Validate the Manifest File
        logger.debug("Validating Manifest File")

        if self.source_config.dbtConfigSource and dbt_files.dbt_manifest:
            manifest_entities = {
                **dbt_files.dbt_manifest[DbtCommonEnum.NODES.value],
                **dbt_files.dbt_manifest[DbtCommonEnum.SOURCES.value],
                **dbt_files.dbt_manifest.get(DbtCommonEnum.EXPOSURES.value, {}),
            }
            catalog_entities = None
            if dbt_files.dbt_catalog:
                catalog_entities = {
                    **dbt_files.dbt_catalog[DbtCommonEnum.NODES.value],
                    **dbt_files.dbt_catalog[DbtCommonEnum.SOURCES.value],
                }
            for key, manifest_node in manifest_entities.items():
                if manifest_node[DbtCommonEnum.RESOURCETYPE.value] in [
                    item.value for item in SkipResourceTypeEnum
                ]:
                    continue

                if (
                    manifest_node[DbtCommonEnum.RESOURCETYPE.value]
                    == DbtCommonEnum.EXPOSURE.value
                ):
                    if all(
                        required_key in manifest_node
                        for required_key in REQUIRED_EXPOSURE_KEYS
                    ):
                        logger.debug(f"Successfully Validated DBT Node: {key}")
                    else:
                        logger.warning(
                            f"Error validating DBT Node: {key}\n"
                            f"Please check if following keys exist for the node: {REQUIRED_EXPOSURE_KEYS}"
                        )

                    continue

                # Validate if all the required keys are present in the manifest nodes
                if all(
                    required_key in manifest_node
                    for required_key in REQUIRED_MANIFEST_KEYS
                ):
                    logger.debug(f"Successfully Validated DBT Node: {key}")
                else:
                    logger.warning(
                        f"Error validating DBT Node: {key}\n"
                        f"Please check if following keys exist for the node: {REQUIRED_MANIFEST_KEYS}"
                    )

                # Validate the catalog file if it is passed
                if catalog_entities:
                    catalog_node = catalog_entities.get(key)
                    if catalog_node and "columns" in catalog_node:
                        self.check_columns(catalog_node=catalog_node)
                    else:
                        logger.warning(
                            f"Unable to find the node or columns in the catalog file for dbt node: {key}"
                        )

    def filter_tags(self, tags: List[str]) -> List[str]:
        """
        Filter tags based on tag filter pattern if configured
        """
        if self.source_config.tagFilterPattern:
            return [
                tag
                for tag in tags
                if not filter_by_tag(self.source_config.tagFilterPattern, tag)
            ]
        return tags

    def process_dbt_domain(self, data_model_link: DataModelLink):
        """
        Method to process DBT domain using existing patch_domain method
        """
        table_entity: Table = data_model_link.table_entity

        if not table_entity:
            return

        table_fqn = table_entity.fullyQualifiedName.root
        logger.debug(f"Processing DBT domain for: {table_fqn}")

        try:
            domain_name = self.extracted_domains.get(table_fqn)

            if not domain_name:
                logger.debug(f"No domain found for table {table_fqn}")
                return

            domain_entity = find_domain_by_name(self.metadata, domain_name)

            if not domain_entity:
                logger.warning(
                    f"Domain '{domain_name}' not found in OpenMetadata for table {table_fqn}"
                )
                return

            domain_ref_data = format_domain_reference(domain_entity)
            if not domain_ref_data:
                logger.warning(f"Failed to format domain reference for '{domain_name}'")
                return

            domain_ref = EntityReference(**domain_ref_data)

            # Create an EntityReferenceList with the domain reference
            domain_list = EntityReferenceList(root=[domain_ref])

            # Use the existing patch_domain method
            updated_entity = self.metadata.patch_domain(
                entity=Table, source=table_entity, domains=domain_list
            )

            if updated_entity:
                logger.info(f"Successfully updated domain for table {table_fqn}")
            else:
                logger.debug(
                    f"Domain already set for table {table_fqn}, skipping update"
                )

        except Exception as exc:  # pylint: disable=broad-except
            logger.warning(f"Failed to update dbt domain for {table_fqn}: {exc}")
            logger.debug(traceback.format_exc())

    def process_dbt_custom_properties(self, data_model_link: DataModelLink):
        """
        Method to process DBT custom properties using new patch_custom_properties method
        """
        table_entity: Table = data_model_link.table_entity

        if not table_entity:
            return

        table_fqn = table_entity.fullyQualifiedName.root
        logger.debug(f"Processing DBT custom properties for: {table_fqn}")

        try:
            custom_properties = self.extracted_custom_properties.get(table_fqn, {})

            if not custom_properties:
                logger.debug(f"No custom_properties found for table {table_fqn}")
                return

            logger.info(
                f"Processing {len(custom_properties)} custom_properties for table {table_fqn}"
            )

            # Validate and convert custom properties
            valid_custom_properties = self._validate_custom_properties(
                table_entity, custom_properties
            )

            if not valid_custom_properties:
                logger.warning(
                    f"No valid custom properties found for table {table_fqn}"
                )
                return

            # Use the new patch_custom_properties method
            updated_entity = self.metadata.patch_custom_properties(
                entity=Table,
                entity_id=table_entity.id,
                custom_properties=valid_custom_properties,
                force=False,  # Merge with existing properties
            )

            if updated_entity:
                logger.info(
                    f"Successfully updated custom properties for table {table_fqn}"
                )
            else:
                logger.warning(
                    f"Failed to update custom properties for table {table_fqn}"
                )

        except Exception as exc:
            logger.warning(
                f"Failed to process custom properties for {table_fqn}: {exc}"
            )
            logger.debug(traceback.format_exc())

    def _validate_custom_properties(
        self, table_entity: Table, custom_properties: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Validates and converts custom properties with comprehensive type checking.

        This method performs three-layer validation:
        1. Property existence check - Is the property defined in OpenMetadata?
        2. Type compatibility check - Does the value type match the expected type?
        3. Format validation - Does the value meet format requirements?

        Args:
            table_entity: The table entity being processed
            custom_properties: Dictionary of custom property names to values from DBT

        Returns:
            Dictionary of validated and converted custom properties, or None if no valid properties
        """
        valid_custom_properties = {}
        validation_errors = []
        table_fqn = table_entity.fullyQualifiedName.root

        logger.debug(
            f"Validating {len(custom_properties)} custom properties for table {table_fqn}"
        )

        for field_name, field_value in custom_properties.items():
            # Step 1: Check if property exists in OpenMetadata
            if field_name not in self.omd_custom_properties:
                error_msg = (
                    f"Custom property '{field_name}' not found in OpenMetadata. "
                    f"Please create it in the OpenMetadata UI before ingesting."
                )
                logger.warning(f"Table {table_fqn}: {error_msg}")
                validation_errors.append(f"{field_name}: Property not defined")
                continue

            custom_property = self.omd_custom_properties[field_name]
            property_type = custom_property["propertyType"]["name"]

            # Extract property configuration (format, enum values, etc.)
            property_config = custom_property.get("customPropertyConfig", {}).get(
                "config"
            )

            # Step 2: Validate and convert value (single pass)
            # This validates type compatibility, format constraints, and converts to backend format
            # For enum types, validation also filters out invalid values
            # For entity references, fetches and converts entities from OpenMetadata
            is_valid, error_detail, converted_value = validate_custom_property_value(
                property_name=field_name,
                property_type=property_type,
                property_config=property_config,
                value=field_value,
                metadata=self.metadata,
            )

            if not is_valid:
                # Format detailed error message
                error_msg = format_validation_error_message(
                    field_name=field_name,
                    property_type=property_type,
                    value=field_value,
                    error_detail=error_detail,
                )
                logger.warning(f"Table {table_fqn}: {error_msg}")
                validation_errors.append(f"{field_name}: {error_detail}")
                continue

            # Check if conversion failed (converted_value is None)
            if converted_value is None:
                error_msg = (
                    f"Failed to convert custom property '{field_name}' "
                    f"(type: {property_type}, value: {field_value})"
                )
                logger.warning(f"Table {table_fqn}: {error_msg}")
                validation_errors.append(f"{field_name}: Conversion failed")
                continue

            # Log if enum values were filtered
            if property_type == "enum" and converted_value != field_value:
                logger.debug(
                    f"Table {table_fqn}: Filtered enum property '{field_name}' "
                    f"from {field_value} to {converted_value}"
                )

            # Successfully validated and converted
            valid_custom_properties[field_name] = converted_value
            logger.debug(
                f"✓ Validated custom property '{field_name}' for table {table_fqn}: "
                f"{field_value} → {converted_value} (type: {property_type})"
            )

        # Log validation summary
        if validation_errors:
            logger.warning(
                f"Custom property validation errors for table {table_fqn}:\n"
                + "\n".join(f"  • {err}" for err in validation_errors)
            )

        if valid_custom_properties:
            logger.debug(
                f"Successfully validated {len(valid_custom_properties)}/{len(custom_properties)} "
                f"custom properties for table {table_fqn}"
            )
        else:
            logger.warning(
                f"No valid custom properties found for table {table_fqn} "
                f"(attempted: {len(custom_properties)})"
            )

        return valid_custom_properties if valid_custom_properties else None

    def yield_dbt_tags(
        self, dbt_objects: DbtObjects
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        Create and yield tags from DBT
        """
        if (
            self.source_config.dbtConfigSource
            and dbt_objects.dbt_manifest
            and self.source_config.includeTags
        ):
            manifest_entities = {
                **dbt_objects.dbt_manifest.nodes,
                **dbt_objects.dbt_manifest.sources,
            }
            logger.debug("Processing DBT Tags")
            dbt_tags_list = []
            for key, manifest_node in manifest_entities.items():
                try:
                    if manifest_node.resource_type in [
                        item.value for item in SkipResourceTypeEnum
                    ]:
                        continue

                    # Add the tags from the model
                    model_tags = manifest_node.tags
                    if model_tags:
                        dbt_tags_list.extend(self.filter_tags(model_tags))

                    # Add the tags from the columns
                    for _, column in manifest_node.columns.items():
                        column_tags = column.tags
                        if column_tags:
                            dbt_tags_list.extend(self.filter_tags(column_tags))
                except Exception as exc:
                    yield Either(
                        left=StackTraceError(
                            name=key,
                            error=f"Unable to process DBT tags for node: f{key} - {exc}",
                            stackTrace=traceback.format_exc(),
                        )
                    )
            try:
                # Deduplicate tags before building FQNs
                dbt_tags_list = list(set(dbt_tags_list)) if dbt_tags_list else []

                # Create all the tags added
                dbt_tag_labels = [
                    fqn.build(
                        self.metadata,
                        Tag,
                        classification_name=self.tag_classification_name,
                        tag_name=tag_name,
                    )
                    for tag_name in dbt_tags_list
                ]
                yield from get_ometa_tag_and_classification(
                    tags=[fqn.split(tag_label)[1] for tag_label in dbt_tag_labels],
                    classification_name=self.tag_classification_name,
                    tag_description="dbt Tags",
                    classification_description="dbt classification",
                )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name="Tags and Classification",
                        error=f"Unexpected exception creating DBT tags: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    @staticmethod
    def _get_latest_result(dbt_objects: DbtObjects, key: str):
        """
        When multiple run_results files are present (e.g. split by domain),
        the same unique_id may appear in more than one file.  Return the
        result with the most recent ``execute`` completed_at timestamp so
        that OpenMetadata always reflects the latest test state.
        """
        matches = [
            item
            for run_result in dbt_objects.dbt_run_results
            for item in run_result.results
            if item.unique_id == key
        ]
        if not matches:
            return None
        if len(matches) == 1:
            return matches[0]

        def _execute_completed_at(result):
            for timing in result.timing or []:
                if timing.name == "execute" and timing.completed_at:
                    completed = timing.completed_at
                    if isinstance(completed, str):
                        try:
                            return datetime.strptime(
                                completed, DBT_RUN_RESULT_DATE_FORMAT
                            )
                        except ValueError:
                            return None
                    return completed
            return None

        timestamped = [(r, _execute_completed_at(r)) for r in matches]
        with_ts = [(r, ts) for r, ts in timestamped if ts is not None]
        if with_ts:
            return max(with_ts, key=lambda pair: pair[1])[0]
        return matches[0]

    def add_dbt_tests(
        self, key: str, manifest_node, manifest_entities, dbt_objects: DbtObjects
    ) -> None:
        """
        Method to append dbt test cases for later processing
        """
        self.context.get().dbt_tests[key] = {
            DbtCommonEnum.MANIFEST_NODE.value: manifest_node
        }
        self.context.get().dbt_tests[key][
            DbtCommonEnum.UPSTREAM.value
        ] = self.parse_upstream_nodes(manifest_entities, manifest_node)
        self.context.get().dbt_tests[key][
            DbtCommonEnum.RESULTS.value
        ] = self._get_latest_result(dbt_objects, key)

    def add_dbt_exposure(self, key: str, manifest_node, manifest_entities):
        exposure_entity = self.parse_exposure_node(manifest_node)

        if exposure_entity:
            self.context.get().exposures[key] = {
                DbtCommonEnum.EXPOSURE: exposure_entity,
                DbtCommonEnum.MANIFEST_NODE: manifest_node,
            }

            self.context.get().exposures[key][
                DbtCommonEnum.UPSTREAM
            ] = self.parse_upstream_nodes(manifest_entities, manifest_node)

    def add_dbt_sources(
        self, key: str, manifest_node, manifest_entities, dbt_objects: DbtObjects
    ) -> None:
        """
        Method to append dbt test cases based on sources file for later processing
        In dbt manifest sources node name is table/view name (not test name like with test nodes)
        So in order for the test creation to be named precisely I am amending manifest node name within it's deepcopy
        """
        manifest_node_new = deepcopy(manifest_node)
        manifest_node_new.name = manifest_node_new.name + "_freshness"

        freshness_test_result = next(
            (item for item in dbt_objects.dbt_sources.results if item.unique_id == key),
            None,
        )

        if freshness_test_result:
            self.context.get().dbt_tests[key + "_freshness"] = {
                DbtCommonEnum.MANIFEST_NODE.value: manifest_node_new
            }
            self.context.get().dbt_tests[key + "_freshness"][
                DbtCommonEnum.UPSTREAM.value
            ] = self.parse_upstream_nodes(manifest_entities, manifest_node)
            self.context.get().dbt_tests[key + "_freshness"][
                DbtCommonEnum.RESULTS.value
            ] = freshness_test_result

    def _get_table_entity(self, table_fqn) -> Optional[Table]:
        def search_table(fqn_search_string: str) -> Optional[Table]:
            table_entities = get_entity_from_es_result(
                entity_list=self.metadata.es_search_from_fqn(
                    entity_type=Table,
                    fqn_search_string=fqn_search_string,
                    fields="sourceHash",
                ),
                fetch_multiple_entities=True,
            )

            if not table_entities:
                return None

            logger.debug(
                f"Found table entities from {fqn_search_string}: {len(table_entities)} entities"
            )
            return (
                next(iter(filter(None, table_entities)), None)
                if table_entities
                else None
            )

        try:
            table_entity = search_table(table_fqn)
            if table_entity:
                logger.debug(
                    f"Using Table Entity: {table_entity.fullyQualifiedName.root}"
                    f"with id {table_entity.id}"
                )
                return table_entity

            if self.source_config.searchAcrossDatabases:
                logger.warning(
                    f"Table {table_fqn} not found under service: {self.config.serviceName}."
                    "Trying to find table across services"
                )
                _, database_name, schema_name, table_name = fqn.split(table_fqn)
                table_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name="*",
                    database_name=database_name,
                    schema_name=schema_name,
                    table_name=table_name,
                )
                table_entity = search_table(table_fqn)
                if table_entity:
                    return table_entity

            logger.warning(
                f"Unable to find the table '{table_fqn}' in OpenMetadata. "
                "Please check if the table exists and is ingested in OpenMetadata. "
                "Also, ensure the name, database, and schema of the manifest node"
                "match the table present in OpenMetadata."
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to get table entity '{table_fqn}' from OpenMetadata: {exc}"
            )

        return None

    # pylint: disable=too-many-locals, too-many-branches
    def yield_data_models(
        self, dbt_objects: DbtObjects
    ) -> Iterable[Either[DataModelLink]]:
        """
        Yield the data models
        """
        if self.source_config.dbtConfigSource and dbt_objects.dbt_manifest:
            logger.debug("Parsing DBT Data Models")
            manifest_entities = {
                **dbt_objects.dbt_manifest.sources,
                **dbt_objects.dbt_manifest.nodes,
                **dbt_objects.dbt_manifest.exposures,
            }
            catalog_entities = None
            if dbt_objects.dbt_catalog:
                catalog_entities = {
                    **dbt_objects.dbt_catalog.sources,
                    **dbt_objects.dbt_catalog.nodes,
                }
            self.context.get().data_model_links = []
            self.context.get().exposures = {}
            self.context.get().dbt_tests = {}
            self.context.get().table_domains = {}
            self.context.get().table_custom_properties = {}
            self.context.get().run_results_generate_time = None

            # Since we'll be processing multiple run_results for a single project
            # we'll only consider the first run_results generated_at time
            if (
                dbt_objects.dbt_run_results
                and dbt_objects.dbt_run_results[0].metadata.generated_at
            ):
                self.context.get().run_results_generate_time = (
                    dbt_objects.dbt_run_results[0].metadata.generated_at
                )
            dbt_project_name = getattr(
                dbt_objects.dbt_manifest.metadata, "project_name", None
            )
            for key, manifest_node in manifest_entities.items():
                try:
                    resource_type = getattr(
                        manifest_node.resource_type,
                        "value",
                        manifest_node.resource_type,
                    )
                    # If the run_results file is passed then only DBT tests will be processed
                    if (
                        dbt_objects.dbt_run_results
                        and resource_type == SkipResourceTypeEnum.TEST.value
                    ):
                        # Test nodes will be processed further in the topology
                        self.add_dbt_tests(
                            key,
                            manifest_node=manifest_node,
                            manifest_entities=manifest_entities,
                            dbt_objects=dbt_objects,
                        )
                        continue

                    if (
                        dbt_objects.dbt_sources
                        and resource_type == DbtCommonEnum.SOURCE.value
                    ):
                        self.add_dbt_sources(
                            key,
                            manifest_node=manifest_node,
                            manifest_entities=manifest_entities,
                            dbt_objects=dbt_objects,
                        )

                    if resource_type == DbtCommonEnum.EXPOSURE.value:
                        self.add_dbt_exposure(key, manifest_node, manifest_entities)
                        continue

                    # Skip the ephemeral nodes since it is not materialized
                    if check_ephemeral_node(manifest_node):
                        logger.debug(f"Skipping ephemeral DBT node: {key}.")
                        continue

                    # Skip the analysis and test nodes
                    if resource_type in [item.value for item in SkipResourceTypeEnum]:
                        logger.debug(f"Skipping DBT node: {key}.")
                        continue

                    model_name = get_dbt_model_name(manifest_node)

                    # Filter the dbt models based on filter patterns
                    filter_model = self.is_filtered(
                        database_name=get_corrected_name(manifest_node.database),
                        schema_name=get_corrected_name(manifest_node.schema_),
                        table_name=model_name,
                    )
                    if filter_model.is_filtered:
                        self.status.filter(filter_model.model_fqn, filter_model.message)
                        continue

                    logger.debug(f"Processing DBT node: {model_name}")

                    catalog_node = None
                    if catalog_entities:
                        catalog_node = catalog_entities.get(key)

                    dbt_table_tags_list = []
                    if manifest_node.tags:
                        manifest_node.tags = self.filter_tags(manifest_node.tags)
                        dbt_table_tags_list = (
                            get_tag_labels(
                                metadata=self.metadata,
                                tags=manifest_node.tags,
                                classification_name=self.tag_classification_name,
                                include_tags=self.source_config.includeTags,
                            )
                            or []
                        )

                    table_fqn = fqn.build(
                        self.metadata,
                        entity_type=Table,
                        service_name=self.config.serviceName,
                        database_name=get_corrected_name(manifest_node.database),
                        schema_name=get_corrected_name(manifest_node.schema_),
                        table_name=model_name,
                    )

                    if manifest_node.meta:
                        dbt_table_tags_list.extend(
                            self.process_dbt_meta(manifest_node.meta, table_fqn) or []
                        )

                    dbt_compiled_query = get_dbt_compiled_query(manifest_node)
                    dbt_raw_query = get_dbt_raw_query(manifest_node)

                    if table_entity := self._get_table_entity(table_fqn=table_fqn):
                        logger.debug(
                            f"Using Table Entity for datamodel: {table_entity.fullyQualifiedName.root}"
                            f"with id {table_entity.id}"
                        )

                        data_model_link = DataModelLink(
                            table_entity=table_entity,
                            datamodel=DataModel(
                                modelType=ModelType.DBT,
                                resourceType=resource_type,
                                description=manifest_node.description
                                if manifest_node.description
                                else None,
                                path=get_data_model_path(manifest_node=manifest_node),
                                rawSql=SqlQuery(dbt_raw_query)
                                if dbt_raw_query
                                else None,
                                sql=SqlQuery(dbt_compiled_query)
                                if dbt_compiled_query
                                else None,
                                columns=self.parse_data_model_columns(
                                    manifest_node, catalog_node
                                ),
                                upstream=self.parse_upstream_nodes(
                                    manifest_entities, manifest_node
                                ),
                                owners=self.get_dbt_owner(
                                    manifest_node=manifest_node,
                                    catalog_node=catalog_node,
                                ),
                                tags=dbt_table_tags_list or [],
                                dbtSourceProject=dbt_project_name,
                            ),
                        )

                        domain_ref = self.get_dbt_domain(manifest_node)
                        if domain_ref:
                            self.context.get().table_domains[table_fqn] = domain_ref

                        yield Either(right=data_model_link)
                        self.context.get().data_model_links.append(data_model_link)

                except Exception as exc:
                    yield Either(
                        left=StackTraceError(
                            name=key,
                            error=f"Unexpected exception parsing DBT node due to {exc}",
                            stackTrace=traceback.format_exc(),
                        )
                    )

    def parse_upstream_nodes(self, manifest_entities, dbt_node):
        """
        Method to fetch the upstream nodes
        """
        upstream_nodes = []
        if (
            hasattr(dbt_node, "depends_on")
            and hasattr(dbt_node.depends_on, "nodes")
            and dbt_node.depends_on
            and dbt_node.depends_on.nodes
        ):
            for node in dbt_node.depends_on.nodes:
                try:
                    parent_node = manifest_entities[node]
                    table_name = get_dbt_model_name(parent_node)

                    filter_model = self.is_filtered(
                        database_name=get_corrected_name(parent_node.database),
                        schema_name=get_corrected_name(parent_node.schema_),
                        table_name=table_name,
                    )
                    if filter_model.is_filtered:
                        continue

                    # check if the node is an ephemeral node
                    # Recursively store the upstream of the ephemeral node in the upstream list
                    if check_ephemeral_node(parent_node):
                        upstream_nodes.extend(
                            self.parse_upstream_nodes(manifest_entities, parent_node)
                        )
                    else:
                        parent_fqn = fqn.build(
                            self.metadata,
                            entity_type=Table,
                            service_name=self.config.serviceName,
                            database_name=get_corrected_name(parent_node.database),
                            schema_name=get_corrected_name(parent_node.schema_),
                            table_name=table_name,
                        )

                        # check if the parent table exists in OM before adding it to the upstream list
                        if self._get_table_entity(table_fqn=parent_fqn):
                            upstream_nodes.append(parent_fqn)
                except Exception as exc:  # pylint: disable=broad-except
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Failed to parse the DBT node {node} to get upstream nodes: {exc}"
                    )
                    continue

        return upstream_nodes

    def parse_data_model_columns(
        self, manifest_node: Any, catalog_node: Any
    ) -> List[Column]:
        """
        Method to parse the DBT columns
        """
        columns = []
        manifest_columns = manifest_node.columns
        for key, manifest_column in manifest_columns.items():
            try:
                logger.debug(f"Processing DBT column: {key}")
                # If catalog file is passed, pass the column information from catalog file
                catalog_column = None
                if catalog_node and catalog_node.columns:
                    catalog_column = catalog_node.columns.get(key)
                column_name = (
                    catalog_column.name if catalog_column else manifest_column.name
                )
                column_description = None
                if catalog_column and catalog_column.comment:
                    column_description = catalog_column.comment

                dbt_column_tag_list = []
                manifest_column.tags = self.filter_tags(manifest_column.tags)
                dbt_column_tag_list.extend(
                    get_tag_labels(
                        metadata=self.metadata,
                        tags=manifest_column.tags,
                        classification_name=self.tag_classification_name,
                        include_tags=self.source_config.includeTags,
                    )
                    or []
                )

                if manifest_column.meta:
                    dbt_column_meta = DbtMeta(**manifest_column.meta)
                    logger.debug(f"Processing DBT column glossary: {key}")
                    if (
                        dbt_column_meta.openmetadata
                        and dbt_column_meta.openmetadata.glossary
                    ):
                        dbt_column_tag_list.extend(
                            get_tag_labels(
                                metadata=self.metadata,
                                tags=dbt_column_meta.openmetadata.glossary,
                                include_tags=self.source_config.includeTags,
                                tag_type=GlossaryTerm,
                            )
                            or []
                        )

                columns.append(
                    Column(
                        name=column_name,
                        # If the catalog description is present, use it, else use the manifest description
                        description=column_description
                        if column_description
                        else manifest_column.description,
                        dataType=ColumnTypeParser.get_column_type(
                            catalog_column.type
                            if catalog_column
                            else manifest_column.data_type
                        ),
                        dataLength=1,
                        ordinalPosition=catalog_column.index
                        if catalog_column
                        else None,
                        tags=dbt_column_tag_list or [],
                    )
                )
                logger.debug(f"Successfully processed DBT column: {key}")
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.warning(f"Failed to parse DBT column {column_name}: {exc}")

        return columns

    def parse_exposure_node(self, exposure_spec) -> Optional[Any]:
        """
        Parses the exposure node verifying if it's type is supported and if provided label matches FQN of
        Open Metadata entity. Returns entity object if both conditions are met.

        The implementation assumes that value of meta.open_metadata_fqn provided in DBT exposures object matches
        to FQN of OpenMetadata entity.

        ```yaml
        exposures:
          - name: orders_dashboard
            label: orders
            meta:
              open_metadata_fqn: sample_looker.orders  # OpenMetadata entity FullyQualifiedName
            type: dashboard
            maturity: high
            url: http://localhost:808/looker/dashboard/8/
            description: >
              Exemplary OM Looker Dashboard.

            depends_on:
              - ref('fact_sales')
        ```
        """
        exposure_type = exposure_spec.type.value
        entity_type = ExposureTypeMap.get(exposure_type, {}).get("entity_type")

        if not entity_type:
            logger.warning(f"Exposure type [{exposure_spec.type.value}] not supported.")

            return None

        try:
            entity_fqn = exposure_spec.meta["open_metadata_fqn"]
        except KeyError:
            logger.warning(
                f"meta.open_metadata_fqn not found in [{exposure_spec.name}] exposure spec."
            )
            return None

        entity = self.metadata.get_by_name(fqn=entity_fqn, entity=entity_type)

        if not entity:
            logger.warning(
                f"Entity [{entity_fqn}] of [{exposure_type}] type not found in Open Metadata."
            )

            return None

        return entity

    def create_dbt_lineage(
        self, data_model_link: DataModelLink
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Method to process DBT lineage from upstream nodes
        """
        to_entity: Table = data_model_link.table_entity
        logger.debug(f"Processing DBT lineage for: {to_entity.fullyQualifiedName.root}")

        for upstream_node in data_model_link.datamodel.upstream:
            try:
                from_entity: Optional[Table] = self._get_table_entity(
                    table_fqn=upstream_node
                )
                if from_entity and to_entity:
                    lineage_request = AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(
                                id=Uuid(from_entity.id.root),
                                type="table",
                            ),
                            toEntity=EntityReference(
                                id=Uuid(to_entity.id.root),
                                type="table",
                            ),
                            lineageDetails=LineageDetails(
                                source=LineageSource.DbtLineage,
                                sqlQuery=SqlQuery(data_model_link.datamodel.sql.root)
                                if data_model_link.datamodel.sql
                                else None,
                            ),
                        )
                    )
                    if lineage_request is not None:
                        yield Either(
                            right=OMetaLineageRequest(
                                lineage_request=lineage_request,
                                override_lineage=self.source_config.overrideLineage,
                            )
                        )
                    else:
                        yield Either(
                            left=StackTraceError(
                                name="DBT Lineage upstream nodes",
                                error=(
                                    "Error to create DBT lineage from upstream nodes ",
                                    f"{str(data_model_link.datamodel.upstream)}",
                                ),
                                stackTrace=traceback.format_exc(),
                            )
                        )

            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Failed to parse the node {upstream_node} to capture lineage: {exc}"
                )

    def create_dbt_query_lineage(
        self, data_model_link: DataModelLink
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Method to process DBT lineage from queries
        """
        if data_model_link.datamodel.sql:
            to_entity: Table = data_model_link.table_entity
            logger.debug(
                f"Processing DBT Query lineage for: {to_entity.fullyQualifiedName.root}"
            )

            try:
                source_elements = fqn.split(to_entity.fullyQualifiedName.root)
                # remove service name from fqn to make it parseable in format db.schema.table
                query_fqn = fqn._build(  # pylint: disable=protected-access
                    *source_elements[-3:]
                )
                query_fqn = ".".join([f'"{i}"' for i in query_fqn.split(".")])
                query = (
                    f"create table {query_fqn} as {data_model_link.datamodel.sql.root}"
                )
                connection_type = str(
                    self.config.serviceConnection.root.config.type.value
                )
                dialect = ConnectionTypeDialectMapper.dialect_of(connection_type)
                lineages = get_lineage_by_query(
                    self.metadata,
                    query=query,
                    service_names=source_elements[0],
                    database_name=source_elements[1],
                    schema_name=source_elements[2],
                    dialect=dialect,
                    timeout_seconds=self.source_config.parsingTimeoutLimit,
                    lineage_source=LineageSource.DbtLineage,
                )
                for lineage in lineages or []:
                    if lineage.right is not None:
                        yield Either(
                            right=OMetaLineageRequest(
                                lineage_request=lineage.right,
                                override_lineage=self.source_config.overrideLineage,
                            )
                        )
                    else:
                        yield lineage

            except Exception as exc:  # pylint: disable=broad-except
                yield Either(
                    left=StackTraceError(
                        name=data_model_link.datamodel.sql.root,
                        error=(
                            f"Failed to parse the query {data_model_link.datamodel.sql.root}"
                            f" to capture lineage: {exc}"
                        ),
                        stackTrace=traceback.format_exc(),
                    )
                )

    def create_dbt_exposures_lineage(
        self, exposure_spec: dict
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Method to process dbt exposure lineage
        """
        to_entity = exposure_spec[DbtCommonEnum.EXPOSURE]
        upstream = exposure_spec[DbtCommonEnum.UPSTREAM]
        manifest_node = exposure_spec[DbtCommonEnum.MANIFEST_NODE]

        for upstream_node in upstream:
            try:
                from_es_result = self.metadata.es_search_from_fqn(
                    entity_type=Table,
                    fqn_search_string=upstream_node,
                )
                from_entity: Optional[
                    Union[Table, List[Table]]
                ] = get_entity_from_es_result(
                    entity_list=from_es_result, fetch_multiple_entities=False
                )
                if from_entity and to_entity:
                    lineage_request = AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(
                                id=Uuid(from_entity.id.root),
                                type="table",
                            ),
                            toEntity=EntityReference(
                                id=Uuid(to_entity.id.root),
                                type=ExposureTypeMap[manifest_node.type.value][
                                    "entity_type_name"
                                ],
                            ),
                            lineageDetails=LineageDetails(
                                source=LineageSource.DbtLineage
                            ),
                        )
                    )
                    if lineage_request is not None:
                        yield Either(
                            right=OMetaLineageRequest(
                                lineage_request=lineage_request,
                                override_lineage=self.source_config.overrideLineage,
                            )
                        )
                    else:
                        yield Either(
                            left=StackTraceError(
                                name="DBT Exposure lineage",
                                error=(
                                    "Error to create DBT Exposure lineage",
                                    f"{str(exposure_spec)[:20]}...",
                                ),
                                stackTrace=traceback.format_exc(),
                            )
                        )

            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Failed to parse the node {upstream_node} to capture lineage: {exc}"
                )

    def process_dbt_meta(self, manifest_meta, table_fqn):
        """
        Method to process DBT meta for Tags and GlossaryTerms
        """
        dbt_table_tags_list = []
        try:
            dbt_meta_info = DbtMeta(**manifest_meta)
            if dbt_meta_info.openmetadata and dbt_meta_info.openmetadata.glossary:
                dbt_table_tags_list.extend(
                    get_tag_labels(
                        metadata=self.metadata,
                        tags=dbt_meta_info.openmetadata.glossary,
                        include_tags=True,
                        tag_type=GlossaryTerm,
                    )
                    or []
                )

            if dbt_meta_info.openmetadata and dbt_meta_info.openmetadata.tier:
                tier_fqn = dbt_meta_info.openmetadata.tier
                dbt_table_tags_list.extend(
                    get_tag_labels(
                        metadata=self.metadata,
                        tags=[tier_fqn.split(fqn.FQN_SEPARATOR)[-1]],
                        classification_name=tier_fqn.split(fqn.FQN_SEPARATOR)[0],
                        include_tags=True,
                    )
                    or []
                )

            if (
                dbt_meta_info.openmetadata
                and dbt_meta_info.openmetadata.customProperties
            ):
                # Store custom properties mapped to table FQN
                self.extracted_custom_properties[
                    table_fqn
                ] = dbt_meta_info.openmetadata.customProperties

            if dbt_meta_info.openmetadata and dbt_meta_info.openmetadata.domain:
                self.extracted_domains[table_fqn] = dbt_meta_info.openmetadata.domain

            if dbt_meta_info.openmetadata and dbt_meta_info.openmetadata.tags:
                for tag_fqn in dbt_meta_info.openmetadata.tags:
                    # Parse classification.tag format
                    tag_parts = tag_fqn.split(fqn.FQN_SEPARATOR)
                    if len(tag_parts) >= 2:
                        classification_name = tag_parts[0]
                        tag_name = fqn.FQN_SEPARATOR.join(tag_parts[1:])
                        dbt_table_tags_list.extend(
                            get_tag_labels(
                                metadata=self.metadata,
                                tags=[tag_name],
                                classification_name=classification_name,
                                include_tags=True,
                            )
                            or []
                        )

        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to process meta dbt Tags and GlossaryTerms: {exc}")

        return dbt_table_tags_list or []

    def process_dbt_descriptions(self, data_model_link: DataModelLink):
        """
        Method to process DBT descriptions using patch APIs
        """
        table_entity: Table = data_model_link.table_entity
        logger.debug(
            f"Processing DBT Descriptions for: {table_entity.fullyQualifiedName.root}"
        )
        if table_entity:
            try:
                service_name, database_name, schema_name, table_name = fqn.split(
                    table_entity.fullyQualifiedName.root
                )
                data_model = data_model_link.datamodel
                force_override = False
                if (
                    data_model.resourceType != DbtCommonEnum.SOURCE.value
                    and self.source_config.dbtUpdateDescriptions
                ):
                    force_override = True

                # Patch table descriptions from DBT
                if data_model.description:
                    self.metadata.patch_description(
                        entity=Table,
                        source=table_entity,
                        description=data_model.description.root,
                        force=force_override,
                    )

                # Patch column descriptions from DBT
                column_descriptions = []
                for column in data_model.columns:
                    if column.description:
                        column_descriptions.append(
                            ColumnDescription(
                                column_fqn=fqn.build(
                                    self.metadata,
                                    entity_type=Column,
                                    service_name=service_name,
                                    database_name=database_name,
                                    schema_name=schema_name,
                                    table_name=table_name,
                                    column_name=column.name.root,
                                ),
                                description=column.description,
                            )
                        )
                self.metadata.patch_column_descriptions(
                    table=table_entity,
                    column_descriptions=column_descriptions,
                    force=force_override,
                )
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Failed to parse the node {table_entity.fullyQualifiedName.root} "
                    f"to update dbt description: {exc}"
                )

    def process_dbt_owners(
        self, data_model_link: DataModelLink
    ) -> Iterable[Either[PatchedEntity]]:
        """
        Method to process DBT owners
        """
        table_entity: Table = data_model_link.table_entity
        if table_entity:
            logger.debug(
                f"Processing DBT owners for: {table_entity.fullyQualifiedName.root}"
            )
            try:
                data_model = data_model_link.datamodel
                if (
                    data_model.resourceType != DbtCommonEnum.SOURCE.value
                    and self.source_config.dbtUpdateOwners
                ):
                    logger.debug(
                        f"Overwriting owners with DBT owners: {table_entity.fullyQualifiedName.root}"
                    )
                    if data_model.owners:
                        new_entity = deepcopy(table_entity)
                        new_entity.owners = data_model.owners
                        yield Either(
                            right=PatchRequest(
                                original_entity=table_entity,
                                new_entity=new_entity,
                                override_metadata=True,
                            )
                        )

            except Exception as exc:  # pylint: disable=broad-except
                yield Either(
                    left=StackTraceError(
                        name=str(table_entity.fullyQualifiedName.root),
                        error=f"Failed to parse the node"
                        f"{table_entity.fullyQualifiedName.root} to update dbt owner: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def create_dbt_tests_definition(
        self, dbt_test: dict
    ) -> Iterable[Either[CreateTestDefinitionRequest]]:
        """
        A Method to add DBT test definitions
        """
        try:
            manifest_node = dbt_test.get(DbtCommonEnum.MANIFEST_NODE.value)
            if manifest_node:
                logger.debug(
                    f"Processing DBT Tests Definition for node: {manifest_node.name}"
                )
                check_test_definition_exists = self.metadata.get_by_name(
                    fqn=manifest_node.name,
                    entity=TestDefinition,
                )
                if not check_test_definition_exists:
                    entity_type = EntityType.TABLE
                    if (
                        hasattr(manifest_node, "column_name")
                        and manifest_node.column_name
                    ):
                        entity_type = EntityType.COLUMN
                    yield Either(
                        right=CreateTestDefinitionRequest(
                            name=manifest_node.name,
                            description=manifest_node.description,
                            entityType=entity_type,
                            testPlatforms=[TestPlatform.dbt],
                            parameterDefinition=create_test_case_parameter_definitions(
                                manifest_node
                            ),
                            displayName=None,
                            owners=None,
                        )
                    )
        except Exception as err:  # pylint: disable=broad-except
            yield Either(
                left=StackTraceError(
                    name="Test Definition",
                    error=f"Failed to parse the node to capture tests {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def create_dbt_test_case(
        self, dbt_test: dict
    ) -> Iterable[Either[CreateTestCaseRequest]]:
        """
        After test suite and test definitions have been processed, add the tests cases info
        """
        try:
            manifest_node = dbt_test.get(DbtCommonEnum.MANIFEST_NODE.value)
            if manifest_node:
                logger.debug(f"Processing DBT Test Case for node: {manifest_node.name}")
                entity_link_list = generate_entity_link(dbt_test)
                for entity_link_str in entity_link_list:
                    table_fqn = get_table_fqn(entity_link_str)
                    logger.debug(f"Table fqn found: {table_fqn}")
                    source_elements = fqn.split(table_fqn)
                    test_case_fqn = fqn.build(
                        self.metadata,
                        entity_type=TestCase,
                        service_name=source_elements[0],
                        database_name=source_elements[1],
                        schema_name=source_elements[2],
                        table_name=source_elements[3],
                        column_name=manifest_node.column_name
                        if hasattr(manifest_node, "column_name")
                        else None,
                        test_case_name=manifest_node.name,
                    )

                    test_case = self.metadata.get_by_name(
                        TestCase, test_case_fqn, fields=["testDefinition,testSuite"]
                    )
                    if test_case is None:
                        # Create the test case only if it does not exist
                        yield Either(
                            right=CreateTestCaseRequest(
                                name=manifest_node.name,
                                description=manifest_node.description,
                                testDefinition=FullyQualifiedEntityName(
                                    manifest_node.name
                                ),
                                entityLink=entity_link_str,
                                parameterValues=create_test_case_parameter_values(
                                    dbt_test
                                ),
                                displayName=None,
                                owners=None,
                            )
                        )
                    logger.debug(f"Test case Already Exists: {test_case_fqn}")
        except Exception as err:  # pylint: disable=broad-except
            yield Either(
                left=StackTraceError(
                    name="Test Cases",
                    error=f"Failed to parse the node to capture tests {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def add_dbt_test_result(self, dbt_test: dict):
        """
        After test cases has been processed, add the tests results info
        """
        try:
            # Process the Test Status
            manifest_node = dbt_test.get(DbtCommonEnum.MANIFEST_NODE.value)
            if manifest_node:
                logger.debug(
                    f"Adding DBT Test Case Results for node: {manifest_node.name}"
                )
                dbt_test_result = dbt_test.get(DbtCommonEnum.RESULTS.value)
                if not dbt_test_result:
                    logger.warning(
                        f"DBT Test Case Results not found for node: {manifest_node.name}"
                    )
                    return

                test_case_status = TestCaseStatus.Aborted
                test_result_value = 0
                if dbt_test_result.status.value in [
                    item.value for item in DbtTestSuccessEnum
                ]:
                    test_case_status = TestCaseStatus.Success
                    test_result_value = 1
                elif dbt_test_result.status.value in [
                    item.value for item in DbtTestFailureEnum
                ]:
                    test_case_status = TestCaseStatus.Failed
                    test_result_value = 0

                # Process the Test Timings
                dbt_test_timings = dbt_test_result.timing
                dbt_test_completed_at = None
                for dbt_test_timing in dbt_test_timings:
                    if dbt_test_timing.name == "execute":
                        dbt_test_completed_at = dbt_test_timing.completed_at
                dbt_timestamp = None
                if dbt_test_completed_at:
                    dbt_timestamp = dbt_test_completed_at
                elif self.context.get().run_results_generate_time:
                    dbt_timestamp = self.context.get().run_results_generate_time

                # check if the timestamp is a str type and convert accordingly
                if isinstance(dbt_timestamp, str):
                    dbt_timestamp = datetime.strptime(
                        dbt_timestamp, DBT_RUN_RESULT_DATE_FORMAT
                    )

                # Create the test case result object
                test_case_result = TestCaseResult(
                    timestamp=Timestamp(
                        datetime_to_timestamp(dbt_timestamp, milliseconds=True)
                    ),
                    testCaseStatus=test_case_status,
                    testResultValue=[
                        TestResultValue(
                            name=dbt_test_result.unique_id,
                            value=str(test_result_value),
                        )
                    ],
                    sampleData=None,
                    result=None,
                )

                # Create the test case fqns and add the results
                for table_fqn in dbt_test.get(DbtCommonEnum.UPSTREAM.value):
                    source_elements = fqn.split(table_fqn)
                    test_case_fqn = fqn.build(
                        self.metadata,
                        entity_type=TestCase,
                        service_name=source_elements[0],
                        database_name=source_elements[1],
                        schema_name=source_elements[2],
                        table_name=source_elements[3],
                        column_name=manifest_node.column_name
                        if hasattr(manifest_node, "column_name")
                        else None,
                        test_case_name=manifest_node.name,
                    )

                    logger.debug(f"Adding test case results to {test_case_fqn} ")
                    try:
                        self.metadata.add_test_case_results(
                            test_results=test_case_result,
                            test_case_fqn=test_case_fqn,
                        )
                    except APIError as err:
                        if err.code != 409:
                            raise err

        except Exception as err:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.debug(
                f"Failed to capture tests results for node: {manifest_node.name} {err}"
            )

    def close(self):
        self.metadata.close()
