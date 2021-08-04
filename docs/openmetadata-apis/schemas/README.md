# Schemas

## Schema Modeling

OpenMetadata takes the **schema-first** approach to model metadata as a Single Source of Truth with clear vocabulary for the system. First, the Entities and Types in the system are identified and schemas are defined for them. Code is then generated from these schemas and is used in implementing the system. We use [JSON schema](https://json-schema.org/) as the Schema Definition Language as it offers several advantages:

* Easy to describe the structure and semantics of metadata models with readable documentation that is both human and machine consumable.
* Common types can be developed once and can be reused as building blocks in other schemas and become the basis of vocabulary development.
* Models can include structural validation, such as required/optional fields, default values, allowed values, regex that not only serve as automated testing and validation but also as documentation of API contract.
* A rich set of tools are availble that supports JSON schema support for generating code and validation from JSON schema in various languages, reducing the manual boilerplate coding.
* Supports rich formats to convert schema types into native standard types during code generation, such as URI, date, and time.

## Reference

1. [JSON schema](https://json-schema.org/) specification version [Draft-07 to 2019-099](https://json-schema.org/draft/2019-09/release-notes.html)
2. [JSON schema 2 POJO](https://www.jsonschema2pojo.org/) tool used for Java code generation from JSON schema
3. [Data model code generator](https://github.com/koxudaxi/datamodel-code-generator) for generating python code from JSON schema

## Schemas

{% page-ref page="entities" %}

{% page-ref page="types" %}

## Version Note

The schemas linked above follow the JSON Schema Spec version: http://json-schema.org/draft-07/schema#
