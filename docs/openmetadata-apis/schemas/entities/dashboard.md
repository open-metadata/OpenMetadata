# Dashboard

This schema defines the Dashboard entity. Dashboards are computed from data and visually present data, metrics, and KIPs. They are updated in real-time and allow interactive data exploration.

**$id:** [**https://open-metadata.org/schema/entity/data/dashboard.json**](https://open-metadata.org/schema/entity/data/dashboard.json)

Type: `object`

## Properties

* **id** `required`
  * Unique identifier that identifies a dashboard instance.
  * $ref: [../../type/basic.json\#/definitions/uuid](../types/basic.md#types-definitions-in-this-schema)
* **name** `required`
  * Name that identifies this dashboard.
  * Type: `string`
  * Length: between 1 and 64
* **fullyQualifiedName**
  * A unique name that identifies a dashboard in the format 'ServiceName.DashboardName'.
  * Type: `string`
  * Length: between 1 and 64
* **description**
  * Description of the dashboard, what it is, and how to use it.
  * Type: `string`
* **href**
  * Link to the resource corresponding to this entity.
  * $ref: [../../type/basic.json\#/definitions/href](../types/basic.md#types-definitions-in-this-schema)
* **owner**
  * Owner of this dashboard.
  * $ref: [../../type/entityReference.json](../types/entity-reference.md)
* **service** `required`
  * Link to service where this dashboard is hosted in.
  * $ref: [../../type/entityReference.json](../types/entity-reference.md)
* **usageSummary**
  * Latest usage information for this database.
  * $ref: [../../type/usageDetails.json](../types/usage-details.md)

