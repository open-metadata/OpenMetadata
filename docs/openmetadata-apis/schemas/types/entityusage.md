# entityusage

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityUsage.json
```

Type used for capturing usage details of an entity

| Abstract            | Extensible | Status         | Identifiable | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                       |
| :------------------ | :--------- | :------------- | :----------- | :---------------- | :-------------------- | :------------------ | :------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | No           | Forbidden         | Allowed               | none                | [entityUsage.json](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityUsage.json "open original schema") |

## Usage details of an entity Type

`object` ([Usage details of an entity](entityusage.md))

# Usage details of an entity Properties

| Property          | Type     | Required | Nullable       | Defined by                                                                                                                                                                                                                    |
| :---------------- | :------- | :------- | :------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [entity](#entity) | `object` | Required | cannot be null | [Usage details of an entity](entityreference.md "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json#/properties/entity")         |
| [usage](#usage)   | `array`  | Required | cannot be null | [Usage details of an entity](#entityusage-properties-usage "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityUsage.json#/properties/usage") |

## entity

Entity reference that includes entity ID and entity type

`entity`

*   is required

*   Type: `object` ([Entity Reference](entityreference.md))

*   cannot be null

*   defined in: [Usage details of an entity](entityreference.md "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json#/properties/entity")

### entity Type

`object` ([Entity Reference](entityreference.md))

## usage

List usage details per day

`usage`

*   is required

*   Type: `object[]` ([Type used to return usage details of an entity](usagedetails.md))

*   cannot be null

*   defined in: [Usage details of an entity](#entityusage-properties-usage "https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityUsage.json#/properties/usage")

### usage Type

`object[]` ([Type used to return usage details of an entity](usagedetails.md))
# entityusage-properties-usage

```txt
https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityUsage.json#/properties/usage
```

List usage details per day

| Abstract            | Extensible | Status         | Identifiable            | Custom Properties | Additional Properties | Access Restrictions | Defined In                                                                        |
| :------------------ | :--------- | :------------- | :---------------------- | :---------------- | :-------------------- | :------------------ | :-------------------------------------------------------------------------------- |
| Can be instantiated | No         | Unknown status | Unknown identifiability | Forbidden         | Allowed               | none                | [entityUsage.json*](../../https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityUsage.json "open original schema") |

## usage Type

`object[]` ([Type used to return usage details of an entity](usagedetails.md))
