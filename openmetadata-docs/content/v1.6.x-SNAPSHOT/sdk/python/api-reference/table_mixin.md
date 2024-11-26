---
title: Table Mixin
slug: /sdk/python/api-reference/table-mixin
---



[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/table_mixin.py#L0")

# module `table_mixin`
Mixin class containing Table specific methods 

To be used by OpenMetadata class 

**Global Variables**
---------------
- **LRU_CACHE_SIZE**


---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/table_mixin.py#L51")

## class `OMetaTableMixin`
OpenMetadata API methods related to Tables. 

To be inherited by OpenMetadata 




---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/table_mixin.py#L295")

### method `create_or_update_custom_metric`

```python
create_or_update_custom_metric(
    custom_metric: CreateCustomMetricRequest,
    table_id: str
) → Table
```

Create or update custom metric. If custom metric name matches an existing one then it will be updated. 



**Args:**
 
 - <b>`custom_metric`</b> (CreateCustomMetricRequest):  custom metric to be create or updated 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/table_mixin.py#L210")

### method `create_or_update_table_profiler_config`

```python
create_or_update_table_profiler_config(
    fqn: str,
    table_profiler_config: TableProfilerConfig
) → Optional[Table]
```

Update the profileSample property of a Table, given its FQN. 

:param fqn: Table FQN :param profile_sample: new profile sample to set :return: Updated table 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/table_mixin.py#L282")

### method `get_latest_table_profile`

```python
get_latest_table_profile(fqn: FullyQualifiedEntityName) → Optional[Table]
```

Get the latest profile data for a table 



**Args:**
 
 - <b>`fqn`</b> (str):  table fully qualified name 



**Returns:**
 
 - <b>`Optional[Table]`</b>:  OM table object 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/table_mixin.py#L230")

### method `get_profile_data`

```python
get_profile_data(
    fqn: str,
    start_ts: int,
    end_ts: int,
    limit=100,
    after=None,
    profile_type: Type[~T] = <class 'metadata.generated.schema.entity.data.table.TableProfile'>
) → EntityList[~T]
```

Get profile data 



**Args:**
 
 - <b>`fqn`</b> (str):  fullyQualifiedName 
 - <b>`start_ts`</b> (int):  start timestamp 
 - <b>`end_ts`</b> (int):  end timestamp 
 - <b>`limit`</b> (int, optional):  limit of record to return. Defaults to 100. 
 - <b>`after`</b> (_type_, optional):  use for API pagination. Defaults to None. profile_type (Union[Type[TableProfile], Type[ColumnProfile]], optional):  Profile type to retrieve. Defaults to TableProfile. 



**Raises:**
 
 - <b>`TypeError`</b>:  if `profile_type` is not TableProfile or ColumnProfile 



**Returns:**
 
 - <b>`EntityList`</b>:  EntityList list object 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/table_mixin.py#L97")

### method `get_sample_data`

```python
get_sample_data(table: Table) → Optional[Table]
```

GET call for the /sampleData endpoint for a given Table 

Returns a Table entity with TableData (sampleData informed) 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/table_mixin.py#L130")

### method `ingest_profile_data`

```python
ingest_profile_data(
    table: Table,
    profile_request: CreateTableProfileRequest
) → Table
```

PUT profile data for a table 

:param table: Table Entity to update :param table_profile: Profile data to add 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/table_mixin.py#L145")

### method `ingest_table_data_model`

```python
ingest_table_data_model(table: Table, data_model: DataModel) → Table
```

PUT data model for a table 

:param table: Table Entity to update :param data_model: Model to add 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/table_mixin.py#L60")

### method `ingest_table_sample_data`

```python
ingest_table_sample_data(
    table: Table,
    sample_data: TableData
) → Optional[TableData]
```

PUT sample data for a table 

:param table: Table Entity to update :param sample_data: Data to add 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/table_mixin.py#L172")

### method `publish_frequently_joined_with`

```python
publish_frequently_joined_with(
    table: Table,
    table_join_request: TableJoins
) → None
```

POST frequently joined with for a table 

:param table: Table Entity to update :param table_join_request: Join data to add 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/table_mixin.py#L158")

### method `publish_table_usage`

```python
publish_table_usage(table: Table, table_usage_request: UsageRequest) → None
```

POST usage details for a Table 

:param table: Table Entity to update :param table_usage_request: Usage data to add 




---


