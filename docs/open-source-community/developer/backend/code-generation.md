# Code Generation

OpenMetadata is built on schema-first principle. We define schema in json-schema definition under
[`OpenMetadata/catalog-rest-service/src/main/resources/json/schema`](https://github.com/open-metadata/OpenMetadata/tree/main/catalog-rest-service/src/main/resources/json/schema)

We use [jsonschema2pojo](https://www.jsonschema2pojo.org/) for code generation.

Run `mvn generate-sources` in the project root directory to generate Java code from the json schema definitions.
The generated POJOs are placed under `OpenMetadata/catalog-rest-service/target/generated-sources/jsonschema2pojo`.
