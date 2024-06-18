---
title: createMlModel
slug: /main-concepts/metadata-standard/schemas/api/data/createmlmodel
---

# CreateMlModelRequest

*Create Ml Model entity request*

## Properties

- **`name`**: Name that identifies this ML model. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this ML model. It could be title or label from the source services.
- **`description`**: Description of the ML model instance. How it was trained and for what it is used. Refer to *../../type/basic.json#/definitions/markdown*.
- **`algorithm`** *(string)*: Algorithm used to train the ML Model.
- **`mlFeatures`** *(array)*: Features used to train the ML Model. Default: `None`.
  - **Items**: Refer to *../../entity/data/mlmodel.json#/definitions/mlFeature*.
- **`target`**: For supervised ML Models, the value to estimate. Refer to *../../type/basic.json#/definitions/entityName*.
- **`mlHyperParameters`** *(array)*: Hyper Parameters used to train the ML Model. Default: `None`.
  - **Items**: Refer to *../../entity/data/mlmodel.json#/definitions/mlHyperParameter*.
- **`dashboard`**: Performance Dashboard fqn to track metric evolution. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`mlStore`**: Location containing the ML Model. It can be a storage layer and/or a container repository. Refer to *../../entity/data/mlmodel.json#/definitions/mlStore*.
- **`server`**: Endpoint that makes the ML Model available, e.g,. a REST API serving the data or computing predictions. Refer to *../../type/basic.json#/definitions/href*.
- **`tags`** *(array)*: Tags for this ML Model. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`owner`**: Owner of this database. Refer to *../../type/entityReference.json*.
- **`service`**: Link to the MLModel service fqn where this pipeline is hosted in. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.
- **`sourceUrl`**: Source URL of mlModel. Refer to *../../type/basic.json#/definitions/sourceUrl*.
- **`domain`** *(string)*: Fully qualified name of the domain the MLModel belongs to.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *../../type/lifeCycle.json*.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
