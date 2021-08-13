# Dashboard

This schema defines the Dashboard entity. Dashboards are computed from data and visually present data, metrics, and KIPs. They are updated in real-time and allow interactive data exploration.

<b id="httpsopen-metadata.orgschemaentitydatadashboard.json">&#36;id: https://open-metadata.org/schema/entity/data/dashboard.json</b>

Type: `object`

## Properties
 - <b id="#https://open-metadata.org/schema/entity/data/dashboard.json/properties/id">id</b> `required`
	 - Unique identifier that identifies a dashboard instance.
	 - &#36;ref: [../../type/basic.json#/definitions/uuid](#....typebasic.jsondefinitionsuuid)
 - <b id="#https://open-metadata.org/schema/entity/data/dashboard.json/properties/name">name</b> `required`
	 - Name that identifies this dashboard.
	 - Type: `string`
	 - Length: between 1 and 64
 - <b id="#https://open-metadata.org/schema/entity/data/dashboard.json/properties/fullyQualifiedName">fullyQualifiedName</b>
	 - A unique name that identifies a dashboard in the format 'ServiceName.DashboardName'.
	 - Type: `string`
	 - Length: between 1 and 64
 - <b id="#https://open-metadata.org/schema/entity/data/dashboard.json/properties/description">description</b>
	 - Description of the dashboard, what it is, and how to use it.
	 - Type: `string`
 - <b id="#https://open-metadata.org/schema/entity/data/dashboard.json/properties/href">href</b>
	 - Link to the resource corresponding to this entity.
	 - &#36;ref: [../../type/basic.json#/definitions/href](#....typebasic.jsondefinitionshref)
 - <b id="#https://open-metadata.org/schema/entity/data/dashboard.json/properties/owner">owner</b>
	 - Owner of this dashboard.
	 - &#36;ref: [../../type/entityReference.json](#....typeentityreference.json)
 - <b id="#https://open-metadata.org/schema/entity/data/dashboard.json/properties/service">service</b> `required`
	 - Link to service where this dashboard is hosted in.
	 - &#36;ref: [../../type/entityReference.json](#....typeentityreference.json)
 - <b id="#https://open-metadata.org/schema/entity/data/dashboard.json/properties/usageSummary">usageSummary</b>
	 - Latest usage information for this database.
	 - &#36;ref: [../../type/usageDetails.json](#....typeusagedetails.json)
