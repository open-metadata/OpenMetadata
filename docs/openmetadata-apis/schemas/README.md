# Schemas

## Schema Modeling

OpenMetadata takes the **schema-first** approach to model metadata as a Single Source of Truth with clear vocabulary for the system. First, the Entities and Types in the system are identified and schemas are defined for them. Code is then generated from these schemas and is used in implementing the system. We use [JSON schema](https://json-schema.org/) as the Schema Definition Language as it offers several advantages:

* Easy to describe the structure and semantics of metadata models with readable documentation that is both human and machine consumable.
* Common types can be developed once and can be reused as building blocks in other schemas and become the basis of vocabulary development.
* Models can include structural validation, such as required/optional fields, default values, allowed values, regex that not only serve as automated testing and validation but also as documentation of API contract.
* A rich set of tools are available that supports JSON schema support for generating code and validation from JSON schema in various languages, reducing the manual boilerplate coding.
* Supports rich formats to convert schema types into native standard types during code generation, such as URI, date, and time.

## Reference

1. [JSON schema](https://json-schema.org/) specification version [Draft-07 to 2019-099](https://json-schema.org/draft/2019-09/release-notes.html)
2. [JSON schema 2 POJO](https://www.jsonschema2pojo.org/) tool used for Java code generation from JSON schema
3. [Data model code generator](https://github.com/koxudaxi/datamodel-code-generator) for generating python code from JSON schema

## Top-level Schemas

* [Bot entity](entities/bots.md) – `https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/bots.json`
* [Common types](types/common.md) – `https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/common.json`
* [Daily count of some measurement](types/dailycount.md) – `https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/dailyCount.json`
* [Dashboard entity](entities/dashboard.md) – `https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/dashboard.json`
* [Data classification related types](types/classification.md) – `https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/classification.json`
* [Database entity](entities/database.md) – `https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json`
* [Database service entity](entities/databaseservice.md) – `https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json`
* [Feed entity](entities/thread.md) – `https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/feed/thread.json`
* [JDBC connection](types/jdbcconnection.md) – `https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json`
* [Metrics entity](entities/metrics.md) – `https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/metrics.json`
* [Pipeline entity](entities/pipeline.md) – `https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/pipeline.json`
* [Report entity](entities/report.md) – `https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/report.json`
* [Schema for collection descriptor](types/collectiondescriptor.md) – `https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/collectionDescriptor.json`
* [Table entity](entities/table.md) – `https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json`
* [Team entity](entities/team.md) – `https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/teams/team.json`
* [Types related to tag category](entities/tagcategory.md) – `https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/tags/tagCategory.json`
* [Usage details for an entity class](types/categoryusage.md) – `https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/categoryUsage.json`
* [Usage details of an entity](https://github.com/StreamlineData/catalog/tree/7a2138a90f4fb063ef6d4f8cac3a2668f1dcf67b/docs/api/schemas/types/entityusage.md) – `https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/type/entityUsage.json`
* [User entity](entities/user.md) – `https://github.com/StreamlineData/catalog/blob/master/catalog-rest-service/src/main/resources/json/schema/entity/teams/user.json`

## Version Note

The schemas linked above follow the JSON Schema Spec version: `http://json-schema.org/draft-07/schema#`

