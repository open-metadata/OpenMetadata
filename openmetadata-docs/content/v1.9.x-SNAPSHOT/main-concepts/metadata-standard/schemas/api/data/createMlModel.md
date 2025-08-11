---
title: Create ML Model API | OpenMetadataML Model API
description: Connect Createmlmodel to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/api/data/createmlmodel
---

# CreateMlModelRequest

*Create Ml Model entity request*

## Properties

- **`name`**: Name that identifies this ML model. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this ML model. It could be title or label from the source services.
- **`description`**: Description of the ML model instance. How it was trained and for what it is used. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`algorithm`** *(string)*: Algorithm used to train the ML Model. Default: `"mlmodel"`.
- **`mlFeatures`** *(array)*: Features used to train the ML Model. Default: `null`.
  - **Items**: Refer to *[../../entity/data/mlmodel.json#/definitions/mlFeature](#/../entity/data/mlmodel.json#/definitions/mlFeature)*.
- **`target`**: For supervised ML Models, the value to estimate. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`mlHyperParameters`** *(array)*: Hyper Parameters used to train the ML Model. Default: `null`.
  - **Items**: Refer to *[../../entity/data/mlmodel.json#/definitions/mlHyperParameter](#/../entity/data/mlmodel.json#/definitions/mlHyperParameter)*.
- **`dashboard`**: Performance Dashboard fqn to track metric evolution. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`mlStore`**: Location containing the ML Model. It can be a storage layer and/or a container repository. Refer to *[../../entity/data/mlmodel.json#/definitions/mlStore](#/../entity/data/mlmodel.json#/definitions/mlStore)*.
- **`server`**: Endpoint that makes the ML Model available, e.g,. a REST API serving the data or computing predictions. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`tags`** *(array)*: Tags for this ML Model. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`owners`**: Owners of this database. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`service`**: Link to the MLModel service fqn where this pipeline is hosted in. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *[../../type/basic.json#/definitions/entityExtension](#/../type/basic.json#/definitions/entityExtension)*.
- **`sourceUrl`**: Source URL of mlModel. Refer to *[../../type/basic.json#/definitions/sourceUrl](#/../type/basic.json#/definitions/sourceUrl)*.
- **`domain`** *(string)*: Fully qualified name of the domain the MLModel belongs to.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *[../../type/lifeCycle.json](#/../type/lifeCycle.json)*.
- **`sourceHash`** *(string)*: Source hash of the entity.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
