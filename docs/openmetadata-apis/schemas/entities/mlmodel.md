# MlModel

This schema defines the Model entity. Models are algorithms trained on data to find patterns or make predictions.

**$id:**[**https://open-metadata.org/schema/entity/data/mlmodel.json**](https://open-metadata.org/schema/entity/data/mlmodel.json)

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
 - **id** `required`
	 - Unique identifier of an ML Model instance.
	 - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
 - **name** `required`
	 - Name that identifies this ML Model.
	 - Type: `string`
	 - Length: between 1 and 128
 - **fullyQualifiedName**
	 - A unique name that identifies an ML Model.
	 - Type: `string`
	 - Length: between 1 and 256
 - **displayName**
	 - Display Name that identifies this ML Model.
	 - Type: `string`
 - **description**
	 - Description of the ML Model, what it is, and how to use it.
	 - Type: `string`
 - **algorithm** `required`
	 - Algorithm used to train the ML Model.
	 - Type: `string`
 - **mlFeatures**
	 - Features used to train the ML Model.
	 - Type: `array`
		 - **Items**
		 - $ref: [#/definitions/mlFeature](#mlfeature)
 - **mlHyperParameters**
	 - Hyper Parameters used to train the ML Model.
	 - Type: `array`
		 - **Items**
		 - $ref: [#/definitions/mlHyperParameter](#mlhyperparameter)
 - **target**
	 - For supervised ML Models, the value to estimate.
	 - $ref: [#/definitions/featureName](#featurename)
 - **dashboard**
	 - Performance Dashboard URL to track metric evolution.
	 - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **mlStore**
	 - Location containing the ML Model. It can be a storage layer and/or a container repository.
	 - $ref: [#/definitions/mlStore](#mlstore)
 - **server**
	 - Endpoint that makes the ML Model available, e.g,. a REST API serving the data or computing predictions.
	 - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
 - **href**
	 - Link to the resource corresponding to this entity.
	 - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
 - **owner**
	 - Owner of this ML Model.
	 - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **followers**
	 - Followers of this ML Model.
	 - $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
 - **tags**
	 - Tags for this ML Model.
	 - Type: `array`
		 - **Items**
		 - $ref: [../../type/tagLabel.json](../types/taglabel.md)
 - **usageSummary**
	 - Latest usage information for this ML Model.
	 - $ref: [../../type/usageDetails.json](../types/usagedetails.md)
 - **version**
	 - Metadata version of the entity.
	 - $ref: [../../type/entityHistory.json#/definitions/entityVersion](../types/entityhistory.md#entityversion)
 - **updatedAt**
	 - Last update time corresponding to the new version of the entity in Unix epoch time milliseconds.
	 - $ref: [../../type/basic.json#/definitions/timestamp](../types/basic.md#timestamp)
 - **updatedBy**
	 - User who made the update.
	 - Type: `string`
 - **changeDescription**
	 - Change that lead to this version of the entity.
	 - $ref: [../../type/entityHistory.json#/definitions/changeDescription](../types/entityhistory.md#changedescription)
 - **deleted**
	 - When `true` indicates the entity has been soft deleted.
	 - Type: `boolean`
	 - Default: _false_


## Type definitions in this schema
### featureType

 - This enum defines the type of data stored in a ML Feature.
 - Type: `string`
 - The value is restricted to the following: 
	 1. _"numerical"_
	 2. _"categorical"_


### featureSourceDataType

 - This enum defines the type of data of a ML Feature source.
 - Type: `string`
 - The value is restricted to the following: 
	 1. _"integer"_
	 2. _"number"_
	 3. _"string"_
	 4. _"array"_
	 5. _"date"_
	 6. _"timestamp"_
	 7. _"object"_
	 8. _"boolean"_


### featureName

 - Local name (not fully qualified name) of the ML Feature.
 - Type: `string`
 - The value must match this pattern: `^[^.]*$`
 - Length: between 1 and 128


### featureSourceName

 - Local name (not fully qualified name) of a ML Feature source.
 - Type: `string`
 - The value must match this pattern: `^[^.]*$`
 - Length: between 1 and 128


### fullyQualifiedFeatureSourceName

 - Fully qualified name of the ML Feature Source that includes `serviceName.[databaseName].tableName/fileName/apiName.columnName[.nestedColumnName]`.
 - Type: `string`
 - Length: between 1 and 256


### fullyQualifiedFeatureName

 - Fully qualified name of the ML Feature that includes `modelName.featureName`.
 - Type: `string`
 - Length: between 1 and 256


### featureSource

 - This schema defines the sources of a ML Feature.
 - Type: `object`
 - This schema <u>does not</u> accept additional properties.
 - **Properties**
	 - **name**
		 - $ref: [#/definitions/featureSourceName](#featuresourcename)
	 - **dataType**
		 - Data type of the source (int, date etc.).
		 - $ref: [#/definitions/featureSourceDataType](#featuresourcedatatype)
	 - **description**
		 - Description of the feature source.
		 - Type: `string`
	 - **fullyQualifiedName**
		 - $ref: [#/definitions/fullyQualifiedFeatureSourceName](#fullyqualifiedfeaturesourcename)
	 - **dataSource**
		 - Description of the Data Source (e.g., a Table).
		 - $ref: [../../type/entityReference.json](../types/entityreference.md)
	 - **tags**
		 - Tags associated with the feature source.
		 - Type: `array`
			 - **Items**
			 - $ref: [../../type/tagLabel.json](../types/taglabel.md)


### mlFeature

 - This schema defines the type for an ML Feature used in an ML Model.
 - Type: `object`
 - This schema <u>does not</u> accept additional properties.
 - **Properties**
	 - **name**
		 - $ref: [#/definitions/featureName](#featurename)
	 - **dataType**
		 - Data type of the column (numerical vs. categorical).
		 - $ref: [#/definitions/featureType](#featuretype)
	 - **description**
		 - Description of the ML Feature.
		 - Type: `string`
	 - **fullyQualifiedName**
		 - $ref: [#/definitions/fullyQualifiedFeatureName](#fullyqualifiedfeaturename)
	 - **featureSources**
		 - Columns used to create the ML Feature.
		 - Type: `array`
			 - **Items**
			 - $ref: [#/definitions/featureSource](#featuresource)
	 - **featureAlgorithm**
		 - Description of the algorithm used to compute the feature, e.g., PCA, bucketing...
		 - Type: `string`
	 - **tags**
		 - Tags associated with the feature.
		 - Type: `array`
			 - **Items**
			 - $ref: [../../type/tagLabel.json](../types/taglabel.md)


### mlHyperParameter

 - This schema defines the type for an ML HyperParameter used in an ML Model.
 - Type: `object`
 - This schema <u>does not</u> accept additional properties.
 - **Properties**
	 - **name**
		 - Hyper parameter name.
		 - Type: `string`
	 - **value**
		 - Hyper parameter value.
		 - Type: `string`
	 - **description**
		 - Description of the Hyper Parameter.
		 - Type: `string`


### mlStore

 - Location containing the ML Model. It can be a storage layer and/or a container repository.
 - Type: `object`
 - This schema <u>does not</u> accept additional properties.
 - **Properties**
	 - **storage**
		 - Storage Layer containing the ML Model data.
		 - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
	 - **imageRepository**
		 - Container Repository with the ML Model image.
		 - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)




_This document was updated on: Monday, March 7, 2022_