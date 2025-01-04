---
title: Schemas
slug: /main-concepts/metadata-standard/schemas
---

# Schemas

The OpenMetadata standard is powered by [JSON Schemas](https://json-schema.org/), as a readable and language-agnostic
solution that allows us to automatically generate code for the different pieces of the project.

{% note %}

Curious about how OpenMetadata is built? You can take a look at the [High Level Design](/main-concepts/high-level-design).

{% /note %}

You can explore the JSON Schemas in different ways:

**1.** You can check all the definitions in [GitHub](https://github.com/open-metadata/OpenMetadata/tree/main/openmetadata-spec/src/main/resources/json/schema).
    Navigating through the directories you can find, for example, the definition of a [Table](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/data/table.json).

**2.** If you prefer to stay in the docs, we also have you covered. We have converted the JSON Schemas to markdown files
    that you can explore following the left menu titles, or navigating the structure by clicking on `Next` at the
    end of each page. Again, this would be the structure of a [Table](/main-concepts/metadata-standard/schemas/entity/data/table).
    In this generation we wanted to maintain the same structure as the GitHub repository. Any empty file means that you reached
    a directory, but you can keep exploring until finding the right Entity, or you can also look for it using the Search Bar.
