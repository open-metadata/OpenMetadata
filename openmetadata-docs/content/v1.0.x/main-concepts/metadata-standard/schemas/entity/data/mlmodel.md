---
title: mlmodel
slug: /main-concepts/metadata-standard/schemas/entity/data/mlmodel
---

# MlModel

*This schema defines the Model entity. Models are algorithms trained on data to find patterns or make predictions.*

## Properties

- **`id`**: Unique identifier of an ML Model instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this ML Model. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: A unique name that identifies an ML Model. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this ML Model.
- **`description`**: Description of the ML Model, what it is, and how to use it. Refer to *../../type/basic.json#/definitions/markdown*.
- **`algorithm`** *(string)*: Algorithm used to train the ML Model.
- **`mlFeatures`** *(array)*: Features used to train the ML Model. Default: `None`.
  - **Items**: Refer to *#/definitions/mlFeature*.
- **`mlHyperParameters`** *(array)*: Hyper Parameters used to train the ML Model. Default: `None`.
  - **Items**: Refer to *#/definitions/mlHyperParameter*.
- **`target`**: For supervised ML Models, the value to estimate. Refer to *../../type/basic.json#/definitions/entityName*.
- **`dashboard`**: Performance Dashboard URL to track metric evolution. Refer to *../../type/entityReference.json*.
- **`mlStore`**: Location containing the ML Model. It can be a storage layer and/or a container repository. Refer to *#/definitions/mlStore*.
- **`server`**: Endpoint that makes the ML Model available, e.g,. a REST API serving the data or computing predictions. Refer to *../../type/basic.json#/definitions/href*.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`owner`**: Owner of this ML Model. Refer to *../../type/entityReference.json*.
- **`followers`**: Followers of this ML Model. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
- **`tags`** *(array)*: Tags for this ML Model. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`usageSummary`**: Latest usage information for this ML Model. Refer to *../../type/usageDetails.json*. Default: `None`.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`service`**: Link to service where this pipeline is hosted in. Refer to *../../type/entityReference.json*.
- **`serviceType`**: Service type where this pipeline is hosted in. Refer to *../services/mlmodelService.json#/definitions/mlModelServiceType*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
## Definitions

- **`featureType`** *(string)*: This enum defines the type of data stored in a ML Feature. Must be one of: `['numerical', 'categorical']`.
- **`featureSourceDataType`** *(string)*: This enum defines the type of data of a ML Feature source. Must be one of: `['integer', 'number', 'string', 'array', 'date', 'timestamp', 'object', 'boolean']`.
- **`featureSource`** *(object)*: This schema defines the sources of a ML Feature. Cannot contain additional properties.
  - **`name`**: Refer to *../../type/basic.json#/definitions/entityName*.
  - **`dataType`**: Data type of the source (int, date etc.). Refer to *#/definitions/featureSourceDataType*.
  - **`description`**: Description of the feature source. Refer to *../../type/basic.json#/definitions/markdown*.
  - **`fullyQualifiedName`**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
  - **`dataSource`**: Description of the Data Source (e.g., a Table). Refer to *../../type/entityReference.json*.
  - **`tags`** *(array)*: Tags associated with the feature source. Default: `None`.
    - **Items**: Refer to *../../type/tagLabel.json*.
- **`mlFeature`** *(object)*: This schema defines the type for an ML Feature used in an ML Model. Cannot contain additional properties.
  - **`name`**: Refer to *../../type/basic.json#/definitions/entityName*.
  - **`dataType`**: Data type of the column (numerical vs. categorical). Refer to *#/definitions/featureType*.
  - **`description`**: Description of the ML Feature. Refer to *../../type/basic.json#/definitions/markdown*.
  - **`fullyQualifiedName`**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
  - **`featureSources`** *(array)*: Columns used to create the ML Feature. Default: `None`.
    - **Items**: Refer to *#/definitions/featureSource*.
  - **`featureAlgorithm`** *(string)*: Description of the algorithm used to compute the feature, e.g., PCA, bucketing...
  - **`tags`** *(array)*: Tags associated with the feature. Default: `None`.
    - **Items**: Refer to *../../type/tagLabel.json*.
- **`mlHyperParameter`** *(object)*: This schema defines the type for an ML HyperParameter used in an ML Model. Cannot contain additional properties.
  - **`name`** *(string)*: Hyper parameter name.
  - **`value`** *(string)*: Hyper parameter value.
  - **`description`**: Description of the Hyper Parameter. Refer to *../../type/basic.json#/definitions/markdown*.
- **`mlStore`** *(object)*: Location containing the ML Model. It can be a storage layer and/or a container repository. Cannot contain additional properties.
  - **`storage`**: Storage Layer containing the ML Model data. Refer to *../../type/basic.json#/definitions/href*.
  - **`imageRepository`**: Container Repository with the ML Model image. Refer to *../../type/basic.json#/definitions/href*.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
