# Category Usage Type

## categoryusage

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/categoryUsage.json
```

Type used for capturing usage details of an entity class

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | No | Forbidden | Allowed | none | [categoryUsage.json](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/categoryUsage.json) |

### Usage details for an entity class Type

`object` \([Usage details for an entity class](categoryusage.md)\)

## Usage details for an entity class Properties

| Property | Type | Required | Nullable | Defined by |
| :--- | :--- | :--- | :--- | :--- |
| [entity](categoryusage.md#entity) | `string` | Optional | cannot be null | [Usage details for an entity class](categoryusage.md#categoryusage-properties-entity) |
| [usage](categoryusage.md#usage) | `array` | Required | cannot be null | [Usage details for an entity class](categoryusage.md#categoryusage-properties-usage) |

### entity

Name of the entity class for which usage is returned

`entity`

* is optional
* Type: `string`
* cannot be null
* defined in: [Usage details for an entity class](categoryusage.md#categoryusage-properties-entity)

#### entity Type

`string`

### usage

List usage details per day

`usage`

* is required
* Type: `object[]` \([Details](common.md#common-definitions-usagedetails)\)
* cannot be null
* defined in: [Usage details for an entity class](categoryusage.md#categoryusage-properties-usage)

#### usage Type

`object[]` \([Details](common.md#common-definitions-usagedetails)\)

## categoryusage-properties-entity

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/categoryUsage.json#/properties/entity
```

Name of the entity class for which usage is returned

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [categoryUsage.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/categoryUsage.json) |

### entity Type

`string`

## categoryusage-properties-usage

```text
https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/categoryUsage.json#/properties/usage
```

List usage details per day

| Abstract | Extensible | Status | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Can be instantiated | No | Unknown status | Unknown identifiability | Forbidden | Allowed | none | [categoryUsage.json\*](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/https:/github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/categoryUsage.json) |

### usage Type

`object[]` \([Details](common.md#common-definitions-usagedetails)\)

