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
# pylint: disable=too-many-lines
"""
Looker source module.
Supports:
- owner
- lineage
- usage

Notes:
- Filtering is applied on the Dashboard title or ID, if the title is missing
"""
import copy
import os
import re
import traceback
from datetime import datetime
from pathlib import Path
from typing import (
    Dict,
    Iterable,
    List,
    Optional,
    Sequence,
    Set,
    Tuple,
    Type,
    Union,
    cast,
    get_args,
)

import giturlparse
import lkml
import networkx as nx
from liquid import Template
from looker_sdk.sdk.api40.methods import Looker40SDK
from looker_sdk.sdk.api40.models import Dashboard as LookerDashboard
from looker_sdk.sdk.api40.models import (
    DashboardBase,
    DashboardElement,
    LookmlModel,
    LookmlModelExplore,
    LookmlModelNavExplore,
    Project,
)
from pydantic import ValidationError

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.services.connections.dashboard.lookerConnection import (
    LookerConnection,
    NoGitCredentials,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardServiceType,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.security.credentials.bitbucketCredentials import (
    BitBucketCredentials,
)
from metadata.generated.schema.security.credentials.githubCredentials import (
    GitHubCredentials,
)
from metadata.generated.schema.security.credentials.gitlabCredentials import (
    GitlabCredentials,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
    SourceUrl,
    Uuid,
)
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.generated.schema.type.usageRequest import UsageRequest
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper, Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import get_column_fqn
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import (
    DashboardServiceSource,
    DashboardUsage,
)
from metadata.ingestion.source.dashboard.looker.bulk_parser import BulkLkmlParser
from metadata.ingestion.source.dashboard.looker.columns import get_columns_from_model
from metadata.ingestion.source.dashboard.looker.links import get_path_from_link
from metadata.ingestion.source.dashboard.looker.models import (
    Includes,
    LookMLManifest,
    LookMLRepo,
    LookMlView,
    ViewName,
)
from metadata.ingestion.source.dashboard.looker.utils import _clone_repo
from metadata.readers.file.api_reader import ReadersCredentials
from metadata.readers.file.base import Reader
from metadata.readers.file.credentials import get_credentials_from_url
from metadata.readers.file.local import LocalReader
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart, filter_by_datamodel
from metadata.utils.helpers import clean_uri, get_standard_chart_type
from metadata.utils.logger import ingestion_logger
from metadata.utils.tag_utils import get_ometa_tag_and_classification, get_tag_labels

logger = ingestion_logger()

LIST_DASHBOARD_FIELDS = ["id", "title"]
IMPORTED_PROJECTS_DIR = "imported_projects"

# we need to find the derived references in the SQL query using regex
# https://cloud.google.com/looker/docs/derived-tables#referencing_derived_tables_in_other_derived_tables
DERIVED_REFERENCES = r"\${([\w\s\d_.]+)\.SQL_TABLE_NAME}"

# Here we can update the fields to get further information, such as:
# created_at, updated_at, last_updater_id, deleted_at, deleter_id, favorite_count, last_viewed_at
GET_DASHBOARD_FIELDS = [
    "id",
    "title",
    "dashboard_elements",
    "dashboard_filters",
    "view_count",
    "description",
    "folder",
    "user_id",  # Use as owner
]

TEMP_FOLDER_DIRECTORY = os.path.join(os.getcwd(), "tmp")
REPO_TMP_LOCAL_PATH = f"{TEMP_FOLDER_DIRECTORY}/lookml_repos"

LOOKER_TAG_CATEGORY = "LookerTags"


def clean_dashboard_name(name: str) -> str:
    """
    Clean incorrect (and known) looker characters in ids
    """
    return name.replace("::", "_")


def build_datamodel_name(model_name: str, explore_name: str) -> str:
    """
    Build the explore name using the model name
    """
    return clean_dashboard_name(model_name + "_" + explore_name)


def find_derived_references(sql_query: str) -> List[str]:
    if sql_query is None:
        return []
    matches = re.findall(DERIVED_REFERENCES, sql_query)
    return matches


class LookerSource(DashboardServiceSource):
    """
    Looker Source Class.

    Its client uses Looker 40 from the SDK: client = looker_sdk.init40()
    """

    # pylint: disable=too-many-instance-attributes, too-many-public-methods

    config: WorkflowSource
    metadata: OpenMetadata
    client: Looker40SDK

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.today = datetime.now().strftime("%Y-%m-%d")

        self._explores_cache = {}
        self._repo_credentials: Optional[ReadersCredentials] = None
        self._reader_class: Optional[Type[Reader]] = None
        self._project_parsers: Optional[Dict[str, BulkLkmlParser]] = None
        self._main_lookml_repo: Optional[LookMLRepo] = None
        self._main__lookml_manifest: Optional[LookMLManifest] = None
        self._view_data_model: Optional[DashboardDataModel] = None

        self._parsed_views: Optional[Dict[str, str]] = {}
        self._unparsed_views: Optional[Dict[str, str]] = {}
        self._derived_dependencies = nx.DiGraph()

        self._added_lineage: Optional[Dict] = {}

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ) -> "LookerSource":
        config = WorkflowSource.model_validate(config_dict)
        connection: LookerConnection = config.serviceConnection.root.config
        if not isinstance(connection, LookerConnection):
            raise InvalidSourceException(
                f"Expected LookerConnection, but got {connection}"
            )
        return cls(config, metadata)

    @staticmethod
    def __init_repo(
        credentials: Optional[
            Union[
                NoGitCredentials,
                GitHubCredentials,
                BitBucketCredentials,
                GitlabCredentials,
            ]
        ]
    ) -> "LookMLRepo":
        repo_name = (
            f"{credentials.repositoryOwner.root}/{credentials.repositoryName.root}"
        )
        repo_path = f"{REPO_TMP_LOCAL_PATH}/{credentials.repositoryName.root}"
        _clone_repo(
            repo_name,
            repo_path,
            credentials,
            overwrite=True,
        )
        return LookMLRepo(name=repo_name, path=repo_path)

    def __read_manifest(
        self,
        credentials: Optional[
            Union[
                NoGitCredentials,
                GitHubCredentials,
                BitBucketCredentials,
                GitlabCredentials,
            ]
        ],
        path="manifest.lkml",
    ) -> Optional[LookMLManifest]:
        file_path = f"{self._main_lookml_repo.path}/{path}"
        if not os.path.isfile(file_path):
            return None
        with open(file_path, "r", encoding="utf-8") as fle:
            manifest = LookMLManifest.model_validate(lkml.load(fle))
            if manifest and manifest.remote_dependency:
                remote_name = manifest.remote_dependency["name"]
                remote_git_url = manifest.remote_dependency["url"]

                url_parsed = giturlparse.parse(remote_git_url)
                _clone_repo(
                    f"{url_parsed.owner}/{url_parsed.repo}",  # pylint: disable=E1101
                    f"{self._main_lookml_repo.path}/{IMPORTED_PROJECTS_DIR}/{remote_name}",
                    credentials,
                )

            return manifest

    def prepare(self):
        if self.service_connection.gitCredentials:
            credentials = self.service_connection.gitCredentials
            self._main_lookml_repo = self.__init_repo(credentials)
            self._main__lookml_manifest = self.__read_manifest(credentials)

    @property
    def parser(self) -> Optional[Dict[str, BulkLkmlParser]]:
        if self.repository_credentials:
            return self._project_parsers
        return None

    @parser.setter
    def parser(self, all_lookml_models: Sequence[LookmlModel]) -> None:
        """
        Initialize the project parsers.

        Each LookML model is linked to a Looker Project. Each project can be
        hosted in different GitHub repositories.

        Here we will prepare the Readers for each project and the LookML parser.

        We are assuming that each Git repo is based under the same owner
        and can be accessed with the same token. If we have
        any errors obtaining the git project information, we will default
        to the incoming GitHub Credentials.
        """
        if self.repository_credentials:
            all_projects: Set[str] = {model.project_name for model in all_lookml_models}
            self._project_parsers: Dict[str, BulkLkmlParser] = {
                project_name: BulkLkmlParser(
                    reader=self.reader(Path(self._main_lookml_repo.path))
                )
                for project_name in all_projects
            }
            logger.info(f"We found the following parsers:\n {self._project_parsers}")

    def get_lookml_project_credentials(self, project_name: str) -> ReadersCredentials:
        """
        Given a lookml project, get its git URL and build the credentials
        """
        try:
            project: Project = self.client.project(project_id=project_name)
            return get_credentials_from_url(
                original=self.repository_credentials, url=project.git_remote_url
            )
        except Exception as err:
            logger.error(
                f"Error trying to build project credentials - [{err}]. We'll use the default ones."
            )
            return self.repository_credentials

    @property
    def reader(self) -> Optional[Type[Reader]]:
        """
        Depending on the type of the credentials we'll need a different reader
        """
        if not self._reader_class and self.service_connection.gitCredentials:
            # Credentials from Github/Gitlab/Bitbucket will process by LocalReader
            self._reader_class = LocalReader

        return self._reader_class

    @property
    def repository_credentials(self) -> Optional[ReadersCredentials]:
        """
        Check if the credentials are informed and return them.

        We either get GitHubCredentials or `NoGitHubCredentials`
        """
        if not self._repo_credentials:
            if self.service_connection.gitCredentials and isinstance(
                self.service_connection.gitCredentials, get_args(ReadersCredentials)
            ):
                self._repo_credentials = self.service_connection.gitCredentials

        return self._repo_credentials

    def list_datamodels(self) -> Iterable[LookmlModelExplore]:
        """
        Fetch explores with the SDK
        """
        if self.source_config.includeDataModels:
            # First, pick up all the LookML Models
            try:
                all_lookml_models: Sequence[
                    LookmlModel
                ] = self.client.all_lookml_models()

                # Then, gather their information and build the parser
                self.parser = all_lookml_models

                # Finally, iterate through them to ingest Explores and Views
                yield from self.fetch_lookml_explores(all_lookml_models)
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(f"Unexpected error fetching LookML models - {err}")

    def fetch_lookml_explores(
        self, all_lookml_models: Sequence[LookmlModel]
    ) -> Iterable[LookmlModelExplore]:
        """
        Based on the LookML models, iterate over the explores
        they contain and filter if needed
        """
        # Then, fetch the explores for each of them
        for lookml_model in all_lookml_models:
            # Each LookML model have a list of explores we'll be ingesting
            for explore_nav in (
                cast(Sequence[LookmlModelNavExplore], lookml_model.explores) or []
            ):
                if filter_by_datamodel(
                    self.source_config.dataModelFilterPattern, lookml_model.name
                ):
                    self.status.filter(
                        lookml_model.name, "Data model (Explore) filtered out."
                    )
                    continue

                try:
                    explore = self.client.lookml_model_explore(
                        lookml_model_name=lookml_model.name,
                        explore_name=explore_nav.name,
                    )
                    yield explore
                except Exception as err:
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Error fetching LookML Explore [{explore_nav.name}] in model [{lookml_model.name}] - {err}"
                    )

    def _build_data_model(self, data_model_name):
        fqn_datamodel = fqn.build(
            self.metadata,
            DashboardDataModel,
            service_name=self.context.get().dashboard_service,
            data_model_name=data_model_name,
        )

        _datamodel = self.metadata.get_by_name(
            entity=DashboardDataModel,
            fqn=fqn_datamodel,
            fields=["*"],
        )
        return _datamodel

    def yield_data_model_tags(
        self, tags: List[str]
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        Method to yield tags related to specific dashboards
        """
        if tags and self.source_config.includeTags:
            yield from get_ometa_tag_and_classification(
                tags=tags or [],
                classification_name=LOOKER_TAG_CATEGORY,
                tag_description="Looker Tag",
                classification_description="Tags associated with looker entities",
                include_tags=self.source_config.includeTags,
            )

    def yield_bulk_datamodel(
        self, model: LookmlModelExplore
    ) -> Iterable[Either[CreateDashboardDataModelRequest]]:
        """
        Get the Explore and View information and prepare
        the model creation request
        """
        try:
            datamodel_name = build_datamodel_name(model.model_name, model.name)
            if filter_by_datamodel(
                self.source_config.dataModelFilterPattern, datamodel_name
            ):
                self.status.filter(datamodel_name, "Data model filtered out.")
            else:
                if model.tags and self.source_config.includeTags:
                    yield from self.yield_data_model_tags(model.tags or [])
                explore_datamodel = CreateDashboardDataModelRequest(
                    name=EntityName(datamodel_name),
                    displayName=model.name,
                    description=Markdown(model.description)
                    if model.description
                    else None,
                    service=self.context.get().dashboard_service,
                    tags=get_tag_labels(
                        metadata=self.metadata,
                        tags=model.tags or [],
                        classification_name=LOOKER_TAG_CATEGORY,
                        include_tags=self.source_config.includeTags,
                    ),
                    dataModelType=DataModelType.LookMlExplore.value,
                    serviceType=DashboardServiceType.Looker.value,
                    columns=get_columns_from_model(model),
                    sql=self._get_explore_sql(model),
                    # In Looker, you need to create Explores and Views within a Project
                    project=model.project_name,
                )
                yield Either(right=explore_datamodel)
                self.register_record_datamodel(datamodel_request=explore_datamodel)

                # build datamodel by our hand since ack_sink=False
                self.context.get().dataModel = self._build_data_model(datamodel_name)
                self._view_data_model = copy.deepcopy(self.context.get().dataModel)

                # Maybe use the project_name as key too?
                # Save the explores for when we create the lineage with the dashboards and views
                self._explores_cache[
                    explore_datamodel.name.root
                ] = self.context.get().dataModel  # This is the newly created explore

                # We can get VIEWs from the JOINs to know the dependencies
                # We will only try and fetch if we have the credentials
                if self.repository_credentials:
                    for view in model.joins:
                        if filter_by_datamodel(
                            self.source_config.dataModelFilterPattern, view.name
                        ):
                            self.status.filter(
                                view.name, "Data model (View) filtered out."
                            )
                            continue
                        view_name = view.from_ if view.from_ else view.name
                        yield from self._process_view(
                            view_name=ViewName(view_name), explore=model
                        )
                    if model.view_name:
                        yield from self._process_view(
                            view_name=ViewName(model.view_name), explore=model
                        )

        except ValidationError as err:
            yield Either(
                left=StackTraceError(
                    name=model.name,
                    error=f"Validation error yielding Data Model [{model.name}]: {err}",
                    stackTrace=traceback.format_exc(),
                )
            )
        except Exception as err:
            yield Either(
                left=StackTraceError(
                    name=model.name,
                    error=f"Wild error yielding Data Model [{model.name}]: {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _get_explore_sql(self, explore: LookmlModelExplore) -> Optional[str]:
        """
        If github creds are sent, we can pick the explore
        file definition and add it here
        """
        # Only look to parse if creds are in
        if self.repository_credentials:
            try:
                project_parser = self.parser.get(explore.project_name)
                if project_parser:
                    explore_sql = project_parser.parsed_files.get(
                        Includes(get_path_from_link(explore.lookml_link))
                    )
                    logger.debug(
                        f"Explore SQL for project {explore.project_name}: \n{explore_sql}"
                    )
                    return explore_sql
            except Exception as err:
                logger.warning(f"Exception getting the model sql: {err}")

        return None

    def _process_view(
        self, view_name: ViewName, explore: LookmlModelExplore
    ) -> Iterable[Either[CreateDashboardDataModelRequest]]:
        """
        For each view referenced in the JOIN of the explore,
        We first load the explore file from GitHub, then:
        1. Fetch the view from the GitHub files (search in includes)
        2. Yield the view as a dashboard Model
        3. Yield the lineage between the View -> Explore and Source -> View
        Every visited view, will be cached so that we don't need to process
        everything again.
        """

        project_parser = self.parser.get(explore.project_name)
        if project_parser:
            view: Optional[LookMlView] = project_parser.find_view(view_name=view_name)

            if view:
                if view.tags and self.source_config.includeTags:
                    yield from self.yield_data_model_tags(view.tags or [])
                datamodel_view_name = (
                    build_datamodel_name(explore.model_name, view.name) + "_view"
                )
                data_model_request = CreateDashboardDataModelRequest(
                    name=EntityName(datamodel_view_name),
                    displayName=view.name,
                    description=Markdown(view.description)
                    if view.description
                    else None,
                    service=self.context.get().dashboard_service,
                    tags=get_tag_labels(
                        metadata=self.metadata,
                        tags=view.tags or [],
                        classification_name=LOOKER_TAG_CATEGORY,
                        include_tags=self.source_config.includeTags,
                    ),
                    dataModelType=DataModelType.LookMlView.value,
                    serviceType=DashboardServiceType.Looker.value,
                    columns=get_columns_from_model(view),
                    sql=project_parser.parsed_files.get(Includes(view.source_file)),
                    # In Looker, you need to create Explores and Views within a Project
                    project=explore.project_name,
                )
                yield Either(right=data_model_request)
                self._view_data_model = self._build_data_model(datamodel_view_name)
                self.register_record_datamodel(datamodel_request=data_model_request)
                yield from self.add_view_lineage(view, explore)
            else:
                yield Either(
                    left=StackTraceError(
                        name=view_name,
                        error=f"Cannot find the view [{view_name}]: empty",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def replace_derived_references(self, sql_query):
        """
        Replace all derived references with the parsed views sql query
        will replace the derived references in the SQL query using regex
        for e.g. It will replace ${view_name.SQL_TABLE_NAME} with the parsed view query for view_name
        https://cloud.google.com/looker/docs/derived-tables#referencing_derived_tables_in_other_derived_tables
        """
        try:
            sql_query = re.sub(
                DERIVED_REFERENCES,
                # from `${view_name.SQL_TABLE_NAME}` we want the `view_name`.
                # match.group(1) will give us the `view_name`
                lambda match: f"({self._parsed_views.get(match.group(1), match.group(0))})",
                sql_query,
            )
        except Exception as e:
            logger.warning(
                f"Something went wrong while replacing derived view references: {e}"
            )
        return sql_query

    def build_lineage_for_unparsed_views(self) -> Iterable[Either[AddLineageRequest]]:
        """
        build lineage by parsing the unparsed views containing derived references
        """
        try:
            # Doing a reversed topological sort to process the views in the right order
            for view_name in reversed(
                list(nx.topological_sort(self._derived_dependencies))
            ):
                if view_name in self._parsed_views:
                    # Skip if already processed
                    continue
                sql_query = self.replace_derived_references(
                    self._unparsed_views[view_name]
                )
                if view_references := find_derived_references(sql_query):
                    # There are still derived references in the view query
                    logger.debug(
                        f"Views {view_references} not found for {view_name}. Skipping."
                    )
                    continue
                self._parsed_views[view_name] = sql_query
                del self._unparsed_views[view_name]
                yield from self._build_lineage_for_view(view_name, sql_query)

        except Exception as err:
            yield Either(
                left=StackTraceError(
                    name="parse_unparsed_views",
                    error=f"Error parsing unparsed views: {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _add_dependency_edge(self, view_name: str, view_references: List[str]):
        """
        Add a dependency edge between the view and the derived reference
        """
        for dependent_view_name in view_references:
            self._derived_dependencies.add_edge(view_name, dependent_view_name)

    def _extract_column_lineage(self, view: LookMlView) -> List[Tuple[Column, Column]]:
        """
        Extract column level lineage from a LookML view.
        Returns a list of tuples containing (source_column, target_column)
        """
        logger.debug(f"Extracting column lineage for view: {view.name}")
        column_lineage = []
        try:
            # Build a map: field_name → sql block
            field_sql_map = {}
            for field_type in ["dimensions", "measures", "dimension_groups"]:
                for field in getattr(view, field_type, []):
                    if hasattr(field, "sql") and field.sql is not None:
                        field_sql_map[field.name] = field.sql

            # Regex to extract ${TABLE}.col and ${field}
            table_col_pattern = re.compile(r"\$\{TABLE\}\.([a-zA-Z_][a-zA-Z0-9_]*)")
            dimension_ref_pattern = re.compile(
                r"\$\{(?!TABLE\})([a-zA-Z_][a-zA-Z0-9_]*)\}"
            )

            # Recursive resolver
            def resolve(field_name, visited=None):
                if visited is None:
                    visited = set()
                if field_name in visited:
                    return set()
                visited.add(field_name)

                sql = field_sql_map.get(field_name, "")
                source_cols = set(table_col_pattern.findall(sql))
                dimension_refs = dimension_ref_pattern.findall(sql)

                for ref in dimension_refs:
                    source_cols.update(resolve(ref, visited))

                return source_cols

            # Build lineage for each field
            for field_name, sql in field_sql_map.items():
                try:
                    if not sql:  # Skip if sql is None or empty
                        continue
                    source_cols = resolve(field_name)
                    for source_col in source_cols:
                        column_lineage.append((source_col, field_name))
                except Exception as err:
                    logger.warning(f"Error processing field {field_name}: {err}")
                    logger.debug(traceback.format_exc())
                    continue

            return column_lineage
        except Exception as e:
            logger.warning(f"Error extracting column lineage: {e}")
            logger.debug(traceback.format_exc())
            return []

    def _get_explore_column_lineage(
        self, explore_model: LookmlModelExplore
    ) -> Optional[List[ColumnLineage]]:
        """
        Build the lineage between the view and the explore
        """
        processed_column_lineage = []
        for field in explore_model.columns or []:
            try:
                # Look for fields with format view_name.col
                field_name = field.name.root
                if "." not in field_name:
                    logger.debug(
                        f"Field [{field_name}] does not have a view name. Skipping."
                    )
                    continue

                view_name, col_name = field_name.split(".")
                if view_name != self._view_data_model.displayName:
                    logger.debug(
                        f"View name [{view_name}] do not match the view name"
                        f"[{self._view_data_model.displayName}] Skipping."
                    )
                    continue

                # Add lineage from view column to explore column
                view_col = None
                for col in self._view_data_model.columns:
                    if (
                        col.displayName and col.displayName.lower() == col_name.lower()
                    ) or (col.name.root.lower() == col_name.lower()):
                        view_col = col
                        break
                from_column = view_col.fullyQualifiedName.root if view_col else None
                to_column = self._get_data_model_column_fqn(
                    data_model_entity=explore_model, column=str(field.name.root)
                )

                if from_column and to_column:
                    processed_column_lineage.append(
                        ColumnLineage(fromColumns=[from_column], toColumn=to_column)
                    )
            except Exception as err:
                logger.warning(
                    "Error processing column lineage for explore_model"
                    f"[{explore_model.name}] field [{field.name}]: {err}"
                )
                logger.debug(traceback.format_exc())
                continue
        return processed_column_lineage

    def add_view_lineage(
        self, view: LookMlView, explore: LookmlModelExplore
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Add the lineage source -> view -> explore
        """
        try:
            # This is the name we store in the cache
            explore_name = build_datamodel_name(explore.model_name, explore.name)
            explore_model = self._explores_cache.get(explore_name)

            # TODO: column-level lineage parsing the explore columns with the format `view_name.col`
            # Now the context has the newly created view
            if explore_model:
                logger.debug(
                    f"Building lineage request for view {self._view_data_model.name} to explore {explore_model.name}"
                )
                column_lineage = self._get_explore_column_lineage(explore_model)
                yield self._get_add_lineage_request(
                    from_entity=self._view_data_model,
                    to_entity=explore_model,
                    column_lineage=column_lineage,
                )

            else:
                logger.info(
                    f"Could not find model for explore [{explore.model_name}: {explore.name}] in the cache"
                    " while processing view lineage."
                )

            db_service_names = self.get_db_service_names()

            if view.sql_table_name:
                sql_table_name = self._render_table_name(view.sql_table_name)

                for db_service_name in db_service_names or []:
                    dialect = self._get_db_dialect(db_service_name)
                    source_table_name = self._clean_table_name(sql_table_name, dialect)
                    self._parsed_views[view.name] = source_table_name

                    # Extract column lineage
                    column_lineage = self._extract_column_lineage(view)

                    # View to the source is only there if we are informing the dbServiceNames
                    yield self.build_lineage_request(
                        source=source_table_name,
                        db_service_name=db_service_name,
                        to_entity=self._view_data_model,
                        column_lineage=column_lineage,
                    )

            elif view.derived_table:
                sql_query = view.derived_table.sql
                if not sql_query:
                    return
                if find_derived_references(sql_query):
                    sql_query = self.replace_derived_references(sql_query)
                    # If we still have derived references, we cannot process the view
                    if view_references := find_derived_references(sql_query):
                        self._add_dependency_edge(view.name, view_references)
                        logger.warning(
                            f"Not all references are replaced for view [{view.name}]. Parsing it later."
                        )
                        return
                logger.debug(f"Processing view [{view.name}] with SQL: \n[{sql_query}]")
                yield from self._build_lineage_for_view(view.name, sql_query)
                if self._unparsed_views:
                    self.build_lineage_for_unparsed_views()

        except Exception as err:
            yield Either(
                left=StackTraceError(
                    name=view.name,
                    error=f"Error to yield lineage details for view [{view.name}]: {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _build_lineage_for_view(
        self, view_name: str, sql_query: str
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Parse the SQL query and build lineage for the view.
        """
        for db_service_name in self.get_db_service_names() or []:
            lineage_parser = LineageParser(
                f"create view {view_name} as {sql_query}",
                self._get_db_dialect(db_service_name),
                timeout_seconds=30,
            )
            if lineage_parser.source_tables:
                self._parsed_views[view_name] = sql_query
                for from_table_name in lineage_parser.source_tables:
                    # Process column level lineage
                    column_lineage = [
                        (
                            source_col.raw_name,
                            target_col.raw_name,
                        )
                        for source_col, target_col in lineage_parser.column_lineage
                        or []
                        if source_col.parent == from_table_name
                    ]
                    yield self.build_lineage_request(
                        source=str(from_table_name),
                        db_service_name=db_service_name,
                        to_entity=self._view_data_model,
                        column_lineage=column_lineage if column_lineage else None,
                    )

    def _get_db_dialect(self, db_service_name) -> Dialect:
        db_service = self.metadata.get_by_name(DatabaseService, db_service_name)
        return ConnectionTypeDialectMapper.dialect_of(
            db_service.connection.config.type.value
        )

    def get_dashboards_list(self) -> List[DashboardBase]:
        """
        Get List of all dashboards
        """
        try:
            return list(
                self.client.all_dashboards(fields=",".join(LIST_DASHBOARD_FIELDS))
            )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Wild error trying to obtain dashboard list {err}")
            # If we cannot list the dashboards, let's blow up
            raise err

    def get_dashboard_name(self, dashboard: DashboardBase) -> str:
        """
        Get Dashboard Title. This will be used for filtering.
        If the title is not present, we'll send the ID
        """
        return dashboard.title or dashboard.id

    def get_dashboard_details(self, dashboard: DashboardBase) -> LookerDashboard:
        """
        Get Dashboard Details
        """
        return self.client.dashboard(
            dashboard_id=dashboard.id, fields=",".join(GET_DASHBOARD_FIELDS)
        )

    def get_owner_ref(
        self, dashboard_details: LookerDashboard
    ) -> Optional[EntityReferenceList]:
        """Get dashboard owner

        Store the visited users in the _owners_ref cache, even if we found them
        in OM or not.

        If the user has not yet been visited, store it and return from cache.

        Args:
            dashboard_details: LookerDashboard
        Returns:
            Optional[EntityReference]
        """
        try:
            if dashboard_details.user_id is not None:
                dashboard_owner = self.client.user(dashboard_details.user_id)
                if dashboard_owner.email:
                    return self.metadata.get_reference_by_email(
                        dashboard_owner.email.lower()
                    )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not fetch owner data due to {err}")

        return None

    def yield_dashboard(
        self, dashboard_details: LookerDashboard
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """
        Method to Get Dashboard Entity
        """
        dashboard_request = CreateDashboardRequest(
            name=EntityName(clean_dashboard_name(dashboard_details.id)),
            displayName=dashboard_details.title,
            description=Markdown(dashboard_details.description)
            if dashboard_details.description
            else None,
            charts=[
                FullyQualifiedEntityName(
                    fqn.build(
                        self.metadata,
                        entity_type=Chart,
                        service_name=self.context.get().dashboard_service,
                        chart_name=chart,
                    )
                )
                for chart in self.context.get().charts or []
            ],
            # Dashboards are created from the UI directly. They are not linked to a project
            # like LookML assets, but rather just organised in folders.
            project=self.get_project_name(dashboard_details),
            sourceUrl=SourceUrl(
                f"{clean_uri(self.service_connection.hostPort)}/dashboards/{dashboard_details.id}"
            ),
            service=self.context.get().dashboard_service,
            owners=self.get_owner_ref(dashboard_details=dashboard_details),
        )
        yield Either(right=dashboard_request)
        self.register_record(dashboard_request=dashboard_request)

    def get_project_name(self, dashboard_details: LookerDashboard) -> Optional[str]:
        """
        Get dashboard project if the folder is informed
        """
        try:
            return dashboard_details.folder.name
        except Exception as exc:
            logger.debug(
                f"Cannot get folder name from dashboard [{dashboard_details.title}] - [{exc}]"
            )
        return None

    @staticmethod
    def _clean_table_name(table_name: str, dialect: Dialect = Dialect.ANSI) -> str:
        """
        sql_table_names might be renamed when defining
        an explore. E.g., customers as cust
        :param table_name: explore table name
        :return: clean table name
        """

        clean_table_name = table_name.lower().split(" as ")[0].strip()
        if dialect == Dialect.BIGQUERY:
            clean_table_name = clean_table_name.strip("`")
        return clean_table_name

    @staticmethod
    def _render_table_name(table_name: str) -> str:
        """
        sql_table_names might contain Liquid templates
        when defining an explore. e.g,:
        sql_table_name:
            {% if openmetadata %}
                event
            {% elsif event.created_week._in_query %}
                event_by_week
            {% else %}
                event
            {% endif %} ;;
        we should render the template and give the option
        to render a specific value during metadata ingestion
        using the "openmetadata" context argument
        :param table_name: table name with possible templating
        :return: rendered table name
        """
        try:
            context = {"openmetadata": True}
            template = Template(table_name)
            sql_table_name = template.render(context)
        except Exception:
            sql_table_name = table_name
        return sql_table_name

    @staticmethod
    def get_dashboard_sources(dashboard_details: LookerDashboard) -> Set[str]:
        """
        Set explores to build lineage for the processed dashboard
        """
        dashboard_sources: Set[str] = set()

        for chart in cast(
            Iterable[DashboardElement], dashboard_details.dashboard_elements
        ):
            if chart.query and chart.query.view:
                dashboard_sources.add(
                    build_datamodel_name(chart.query.model, chart.query.view)
                )
            if chart.look and chart.look.query and chart.look.query.view:
                dashboard_sources.add(
                    build_datamodel_name(chart.look.query.model, chart.look.query.view)
                )
            if (
                chart.result_maker
                and chart.result_maker.query
                and chart.result_maker.query.view
            ):
                dashboard_sources.add(
                    build_datamodel_name(
                        chart.result_maker.query.model, chart.result_maker.query.view
                    )
                )

        return dashboard_sources

    def get_explore(self, explore_name: str) -> Optional[DashboardDataModel]:
        """
        Get the dashboard model from cache or API
        """
        return self._explores_cache.get(explore_name) or self.metadata.get_by_name(
            entity=DashboardDataModel,
            fqn=fqn.build(
                self.metadata,
                entity_type=DashboardDataModel,
                service_name=self.context.get().dashboard_service,
                data_model_name=explore_name,
            ),
        )

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: LookerDashboard,
        _: Optional[str] = None,
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Get lineage between charts and data sources.

        We look at:
        - chart.query
        - chart.look (chart.look.query)
        - chart.result_maker
        """

        try:
            source_explore_list = self.get_dashboard_sources(dashboard_details)
            for explore_name in source_explore_list:
                cached_explore = self.get_explore(explore_name)
                if cached_explore:
                    dashboard_fqn = fqn.build(
                        self.metadata,
                        entity_type=Dashboard,
                        service_name=self.context.get().dashboard_service,
                        dashboard_name=self.context.get().dashboard,
                    )
                    dashboard_entity = self.metadata.get_by_name(
                        entity=Dashboard, fqn=dashboard_fqn
                    )
                    yield Either(
                        right=AddLineageRequest(
                            edge=EntitiesEdge(
                                fromEntity=EntityReference(
                                    id=Uuid(cached_explore.id.root),
                                    type="dashboardDataModel",
                                ),
                                toEntity=EntityReference(
                                    id=Uuid(dashboard_entity.id.root),
                                    type="dashboard",
                                ),
                                lineageDetails=LineageDetails(
                                    source=LineageSource.DashboardLineage
                                ),
                            )
                        )
                    )

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=dashboard_entity.displayName,
                    error=f"Unexpected exception yielding lineage from [{dashboard_entity.displayName}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _process_and_validate_column_lineage(
        self,
        column_lineage: List[Tuple[Column, Column]],
        from_entity: Table,
        to_entity: Union[Dashboard, DashboardDataModel],
    ) -> List[ColumnLineage]:
        """
        Process and validate column lineage
        """
        processed_column_lineage = []
        if column_lineage:
            for column_tuple in column_lineage or []:
                try:
                    if len(column_tuple) < 2:
                        logger.debug(f"Skipping invalid column tuple: {column_tuple}")
                        continue

                    source_col = column_tuple[0]
                    target_col = column_tuple[-1]

                    if not source_col or not target_col:
                        logger.debug(
                            f"Skipping column tuple with empty values: source={source_col}, "
                            f"target={target_col}, to_entity={to_entity.name}"
                        )
                        continue

                    from_column = get_column_fqn(
                        table_entity=from_entity, column=str(target_col)
                    )
                    to_column = self._get_data_model_column_fqn(
                        data_model_entity=to_entity,
                        column=str(source_col),
                    )
                    if from_column and to_column:
                        processed_column_lineage.append(
                            ColumnLineage(
                                fromColumns=[from_column],
                                toColumn=to_column,
                            )
                        )
                except Exception as err:
                    logger.warning(
                        f"Error processing column lineage {column_tuple}: {err}"
                    )
                    logger.debug(traceback.format_exc())
                    continue
        return processed_column_lineage

    def build_lineage_request(
        self,
        source: str,
        db_service_name: str,
        to_entity: Union[Dashboard, DashboardDataModel],
        column_lineage: Optional[List[Tuple[Column, Column]]] = None,
    ) -> Optional[Either[AddLineageRequest]]:
        """
        Once we have a list of origin data sources, check their components
        and build the lineage request.

        We will try searching in ES with and without the `database`

        Args:
            source: table name from the source list
            db_service_name: name of the service from the config
            to_entity: Dashboard Entity being used
        """
        logger.debug(f"Building lineage request for {source} to {to_entity.name}")

        source_elements = fqn.split_table_name(table_name=source)

        for database_name in [source_elements["database"], None]:
            from_fqn = fqn.build(
                self.metadata,
                entity_type=Table,
                service_name=db_service_name,
                database_name=database_name,
                schema_name=source_elements["database_schema"],
                table_name=source_elements["table"],
            )

            from_entity: Table = self.metadata.get_by_name(
                entity=Table,
                fqn=from_fqn,
            )

            if from_entity:
                if from_entity.id.root not in self._added_lineage:
                    self._added_lineage[from_entity.id.root] = []
                if to_entity.id.root not in self._added_lineage[from_entity.id.root]:
                    self._added_lineage[from_entity.id.root].append(to_entity.id.root)
                    processed_column_lineage = (
                        self._process_and_validate_column_lineage(
                            column_lineage, from_entity, to_entity
                        )
                    )
                    return self._get_add_lineage_request(
                        to_entity=to_entity,
                        from_entity=from_entity,
                        column_lineage=processed_column_lineage,
                    )

        return None

    def yield_dashboard_chart(
        self, dashboard_details: LookerDashboard
    ) -> Iterable[Either[CreateChartRequest]]:
        """
        Method to fetch charts linked to dashboard
        """
        for chart in dashboard_details.dashboard_elements:
            try:
                if filter_by_chart(
                    chart_filter_pattern=self.source_config.chartFilterPattern,
                    chart_name=chart.id,
                ):
                    self.status.filter(chart.id, "Chart filtered out")
                    continue

                if not chart.id:
                    logger.debug(f"Found chart {chart} without id. Skipping.")
                    continue

                description = self.build_chart_description(chart)
                if chart.query is not None:
                    source_url = chart.query.share_url
                elif getattr(chart.result_maker, "query", None) is not None:
                    source_url = chart.result_maker.query.share_url
                else:
                    source_url = f"{clean_uri(self.service_connection.hostPort)}/merge?mid={chart.merge_result_id}"
                yield Either(
                    right=CreateChartRequest(
                        name=EntityName(chart.id),
                        displayName=chart.title or chart.id,
                        description=Markdown(description) if description else None,
                        chartType=get_standard_chart_type(chart.type).value,
                        sourceUrl=SourceUrl(source_url),
                        service=self.context.get().dashboard_service,
                    )
                )

            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name=chart.id,
                        error=f"Error creating chart [{chart}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    @staticmethod
    def build_chart_description(chart: DashboardElement) -> Optional[str]:
        """
        Chart descriptions will be based on the subtitle + note_text, if exists.
        If the chart is a text tile, we will add the text as the chart description as well.
        This should keep the dashboard searchable without breaking the original metadata structure.
        """

        # If the string is None or empty, filter it out.
        try:
            return "; ".join(
                filter(
                    lambda string: string,
                    [chart.subtitle_text, chart.body_text, chart.note_text],
                )
                or []
            )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Error getting chart description: {err}")
            return None

    def yield_dashboard_usage(  # pylint: disable=W0221
        self, dashboard_details: LookerDashboard
    ) -> Iterable[Either[DashboardUsage]]:
        """
        The dashboard.view_count gives us the total number of views. However, we need to
        pass the views for each day (execution).

        In this function we will first validate if the usageSummary
        returns us some usage for today's date. If so, we will stop the
        execution.

        Otherwise, we will add the difference between the usage from the last time
        the usage was reported and today's view_count from the dashboard.

        Example usage summary from OM API:
        "usageSummary": {
            "dailyStats": {
                "count": 51,
                "percentileRank": 0.0
            },
            "date": "2022-06-23",
            "monthlyStats": {
                "count": 105,
                "percentileRank": 0.0
            },
            "weeklyStats": {
                "count": 105,
                "percentileRank": 0.0
            }
        },
        :param dashboard_details: Looker Dashboard
        :return: UsageRequest, if not computed
        """

        dashboard_name = self.context.get().dashboard

        try:
            dashboard_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Dashboard,
                service_name=self.context.get().dashboard_service,
                dashboard_name=dashboard_name,
            )

            dashboard: Dashboard = self.metadata.get_by_name(
                entity=Dashboard,
                fqn=dashboard_fqn,
                fields=["usageSummary"],
            )

            current_views = dashboard_details.view_count

            if not current_views:
                logger.debug(f"No usage to report for {dashboard_details.title}")

            if not dashboard.usageSummary:
                logger.info(
                    f"Yielding fresh usage for {dashboard.fullyQualifiedName.root}"
                )
                yield Either(
                    right=DashboardUsage(
                        dashboard=dashboard,
                        usage=UsageRequest(date=self.today, count=current_views),
                    )
                )

            elif (
                str(dashboard.usageSummary.date.root) != self.today
                or not dashboard.usageSummary.dailyStats.count
            ):
                latest_usage = dashboard.usageSummary.dailyStats.count

                new_usage = current_views - latest_usage
                if new_usage < 0:
                    raise ValueError(
                        f"Wrong computation of usage difference. Got new_usage={new_usage}."
                    )

                logger.info(
                    f"Yielding new usage for {dashboard.fullyQualifiedName.root}"
                )
                yield Either(
                    right=DashboardUsage(
                        dashboard=dashboard,
                        usage=UsageRequest(
                            date=self.today, count=current_views - latest_usage
                        ),
                    )
                )

            else:
                logger.debug(
                    f"Latest usage {dashboard.usageSummary} vs. today {self.today}. Nothing to compute."
                )
                logger.info(
                    f"Usage already informed for {dashboard.fullyQualifiedName.root}"
                )

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=f"{dashboard_name} Usage",
                    error=f"Exception computing dashboard usage for {dashboard_name}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def close(self):
        self.metadata.compute_percentile(Dashboard, self.today)
        self.metadata.close()
