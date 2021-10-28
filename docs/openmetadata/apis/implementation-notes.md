# Implementation notes

We use the [Dropwizard](https://www.dropwizard.io/en/latest/) Java framework for developing Restful web services. APIs are documented using [Swagger/OpenAPI 3.x](https://swagger.io/specification/). We take schema first approach and define metadata entities and types in [JSON schema](https://json-schema.org/) specification version [Draft-07 to 2019-09](https://json-schema.org/draft/2019-09/release-notes.html). Java code is generated from the JSON schema using [JSON schema 2 pojo](https://www.jsonschema2pojo.org/) tool and Python code is generated using the [Data model code generator](https://github.com/koxudaxi/datamodel-code-generator) tool.

