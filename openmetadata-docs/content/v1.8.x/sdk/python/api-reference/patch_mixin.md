---
title: Patch Mixin
slug: /sdk/python/api-reference/patch-mixin
---



[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/patch_mixin.py#L0")

# module `patch_mixin`
Mixin class containing PATCH specific methods 

To be used by OpenMetadata class 

**Global Variables**
---------------
- **OWNER_TYPES**

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/patch_mixin.py#L57")

## function `update_column_tags`

```python
update_column_tags(
    columns: List[Column],
    column_tag: ColumnTag,
    operation: PatchOperation
) → None
```

Inplace update for the incoming column list 


---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/patch_mixin.py#L82")

## function `update_column_description`

```python
update_column_description(
    columns: List[Column],
    column_fqn: str,
    description: str,
    force: bool = False
) → None
```

Inplace update for the incoming column list 


---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/patch_mixin.py#L104")

## class `OMetaPatchMixin`
OpenMetadata API methods related to Tables. 

To be inherited by OpenMetadata 




---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/patch_mixin.py#L113")

### method `patch`

```python
patch(entity: Type[~T], source: ~T, destination: ~T) → Optional[~T]
```

Given an Entity type and Source entity and Destination entity, generate a JSON Patch and apply it. 

Args  entity (T): Entity Type  source: Source payload which is current state of the source in OpenMetadata  destination: payload with changes applied to the source. 

Returns  Updated Entity 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/patch_mixin.py#L457")

### method `patch_automation_workflow_response`

```python
patch_automation_workflow_response(
    automation_workflow: Workflow,
    test_connection_result: TestConnectionResult,
    workflow_status: WorkflowStatus
) → None
```

Given an AutomationWorkflow, JSON PATCH the status and response. 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/patch_mixin.py#L417")

### method `patch_column_description`

```python
patch_column_description(
    table: Table,
    column_fqn: str,
    description: str,
    force: bool = False
) → Optional[~T]
```

Given an Table , Column FQN, JSON PATCH the description of the column 

Args  src_table: origin Table object  column_fqn: FQN of the column to update  description: new description to add  force: if True, we will patch any existing description. Otherwise, we will maintain  the existing data. Returns  Updated Entity 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/patch_mixin.py#L398")

### method `patch_column_tag`

```python
patch_column_tag(
    table: Table,
    column_fqn: str,
    tag_label: TagLabel,
    operation: Union[ForwardRef(<ADD: 'add'>), ForwardRef(<REMOVE: 'remove'>)] = <PatchOperation.ADD: 'add'>
) → Optional[~T]
```

Will be deprecated in 1.3 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/patch_mixin.py#L357")

### method `patch_column_tags`

```python
patch_column_tags(
    table: Table,
    column_tags: List[ColumnTag],
    operation: Union[ForwardRef(<ADD: 'add'>), ForwardRef(<REMOVE: 'remove'>)] = <PatchOperation.ADD: 'add'>
) → Optional[~T]
```

Given an Entity ID, JSON PATCH the tag of the column 

Args  entity_id: ID  tag_label: TagLabel to add or remove  column_name: column to update  operation: Patch Operation to add or remove Returns  Updated Entity 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/patch_mixin.py#L159")

### method `patch_description`

```python
patch_description(
    entity: Type[~T],
    source: ~T,
    description: str,
    force: bool = False
) → Optional[~T]
```

Given an Entity type and ID, JSON PATCH the description. 

Args  entity (T): Entity Type  source: source entity object  description: new description to add  force: if True, we will patch any existing description. Otherwise, we will maintain  the existing data. Returns  Updated Entity 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/patch_mixin.py#L516")

### method `patch_domain`

```python
patch_domain(entity: BaseModel, domain: Domain) → Optional[BaseModel]
```

Patch domain data for an Entity 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/patch_mixin.py#L494")

### method `patch_life_cycle`

```python
patch_life_cycle(entity: BaseModel, life_cycle: LifeCycle) → Optional[BaseModel]
```

Patch life cycle data for a entity 

:param entity: Entity to update the life cycle for :param life_cycle_data: Life Cycle data to add 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/patch_mixin.py#L317")

### method `patch_owner`

```python
patch_owner(
    entity: Type[~T],
    source: ~T,
    owner: EntityReference = None,
    force: bool = False
) → Optional[~T]
```

Given an Entity type and ID, JSON PATCH the owner. If not owner Entity type and not owner ID are provided, the owner is removed. 

Args  entity (T): Entity Type of the entity to be patched  entity_id: ID of the entity to be patched  owner: Entity Reference of the owner. If None, the owner will be removed  force: if True, we will patch any existing owner. Otherwise, we will maintain  the existing data. Returns  Updated Entity 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/patch_mixin.py#L205")

### method `patch_table_constraints`

```python
patch_table_constraints(
    table: Table,
    constraints: List[TableConstraint]
) → Optional[~T]
```

Given an Entity ID, JSON PATCH the table constraints of table 

Args  source_table: Origin table  description: new description to add  table_constraints: table constraints to add 

Returns  Updated Entity 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/patch_mixin.py#L302")

### method `patch_tag`

```python
patch_tag(
    entity: Type[~T],
    source: ~T,
    tag_label: TagLabel,
    operation: Union[ForwardRef(<ADD: 'add'>), ForwardRef(<REMOVE: 'remove'>)] = <PatchOperation.ADD: 'add'>
) → Optional[~T]
```

Will be deprecated in 1.3 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/patch_mixin.py#L261")

### method `patch_tags`

```python
patch_tags(
    entity: Type[~T],
    source: ~T,
    tag_labels: List[TagLabel],
    operation: Union[ForwardRef(<ADD: 'add'>), ForwardRef(<REMOVE: 'remove'>)] = <PatchOperation.ADD: 'add'>
) → Optional[~T]
```

Given an Entity type and ID, JSON PATCH the tag. 

Args  entity (T): Entity Type  source: Source entity object  tag_label: TagLabel to add or remove  operation: Patch Operation to add or remove the tag. Returns  Updated Entity 

---

[{% image align="right" style="float:right;" src="https://img.shields.io/badge/-source-cccccc?style=flat-square" /%}](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/metadata/ingestion/ometa/mixins/patch_mixin.py#L234")

### method `patch_test_case_definition`

```python
patch_test_case_definition(
    source: TestCase,
    entity_link: str,
    test_case_parameter_values: Optional[List[TestCaseParameterValue]] = None
) → Optional[TestCase]
```

Given a test case and a test case definition JSON PATCH the test case 

Args  test_case: test case object  test_case_definition: test case definition to add 




---


