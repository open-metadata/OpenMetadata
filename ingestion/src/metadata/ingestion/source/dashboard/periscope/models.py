"""
Periscope Models
"""
from typing import List, Optional
from pydantic import BaseModel, validator

from metadata.generated.schema.entity.data.table import DataType

PERISCOPE_TYPE_MAPPER = {
    "INTEGER": DataType.INT,
    "STRING": DataType.STRING,
    "FLOAT": DataType.FLOAT,
    "DATE": DataType.DATE
}

class PeriscopeColumnSchema(BaseModel):
    column_name: str
    column_type: DataType
    is_datetime: bool

    @validator("column_type", pre=True)
    def str_to_enum(cls, value: str):
        return PERISCOPE_TYPE_MAPPER.get(value, DataType.UNKNOWN)

class PeriscopeViewsModel(BaseModel):
    name: str
    description: Optional[str]
    view_schema: List[PeriscopeColumnSchema]
    sql: str


class PeriscopeDashboard(BaseModel):
    """
    Periscope dashboard model
    """
    id: int
    name: Optional[str]
    description: Optional[str]
    aggregation: Optional[str]
    user_name: Optional[str]
    user_id: Optional[int]
    collection_id: Optional[str]
    popularity: Optional[int]
    last_7_day_usage_hours: Optional[int]
    visibility: str
    last_update: str
    create_time: str

class PeriscopeChart(BaseModel):
    id: int
    title: Optional[str]
    chart_type: str
    dashboard_id: int
    sync_version: int
    user_id: int
    shared_dashboard_id: None
    api_enabled: Optional[bool]
    chart_description: Optional[str]
    sql: str
    database_id: int
    formula_source_hash_key: str
    api_token: None
    fluid_row: int
    fluid_column: int
    fluid_width: int
    fluid_height: int
    default_color_theme_id: None
    use_periscope_theme: None
    csv_download_disabled: Optional[bool]
    sql_limit: Optional[int]
    code: None
    code_language: None
    code_version: None
    drag_drop_config: None
    archived_at: None
    content_type: Optional[str]
    content_id: Optional[int]
    code_hash_key: None
    last_update: float
    is_shell: bool

class PeriscopeView(BaseModel):
    id: int
    archived_at: None
    archived_by_user_id: None
    code: Optional[str]
    code_language: Optional[str]
    code_preview_source_hash_key: Optional[str]
    code_version: Optional[str]
    database_id: int
    description: Optional[str]
    error_count: int
    excluded_from_auto_archive: Optional[bool]
    guid: str
    icon_color: str
    last_materializer_error: Optional[str]
    last_successful_materialize_at: Optional[str]
    last_successful_materialize_time_ms: int
    last_updated_by_user_at: str
    name: str
    next_materialize_at: Optional[str]
    no_cache_results: Optional[bool]
    owner_user_id: int
    popularity: Optional[int]
    preview_source_hash_key: str
    published_at: None
    site_id: int
    sql: str
    sql_limit: Optional[int]
    started_materialization_at: None
    used_by_view_count: int
    used_by_widget_count: int
    user_id: int
    view_schema: List[PeriscopeColumnSchema]
    columns: List[str]
    complete_sql_for_redshift: str
    tag_names: List
    last_update: float
    materialize_pending: bool
    code_hash_key: str
    user_name: str

    @validator("view_schema", pre=True)
    def parse_view_schema(cls, value: dict):
        return [PeriscopeColumnSchema.parse_obj(value[key]) for key in value.keys()]


class PeriscopeViewList(BaseModel):
    SqlView: List[PeriscopeView]
    CacheSchedule: List

class PeriscopeDashboardList(BaseModel):
    Dashboard: Optional[List[PeriscopeDashboard]]

class PeriscopeDashboardDetails(BaseModel):
    charts: Optional[List[PeriscopeChart]]
    dashboard: PeriscopeDashboard
