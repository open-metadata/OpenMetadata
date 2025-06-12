## QlikCloud

In this section, we provide guides and references to use the Qlik Cloud connector.

Configure and schedule QlikCloud metadata and profiler workflows from the OpenMetadata UI:


## Requirements

We will extract the metadata using the [Qlik Cloud REST APIs](https://qlik.dev/apis/).

You can find further information on the Qlik Cloud connector in the [docs](https://docs.open-metadata.org/connectors/dashboard/qlikcloud).


## Connection Details

$$section
### Qlik Cloud API Token $(id="token")

API token for Qlik Cloud APIs access. Refer to [this](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Admin/mc-generate-api-keys.htm) document for more details.

Example: `eyJhbGciOiJFU***`
$$


$$section
### Qlik Cloud Host Port $(id="hostPort")

This field refers to the base url of your Qlik Cloud Portal, will be used for generating the redirect links for dashboards and charts.

Example: `https://<TenantURL>.qlikcloud.com`
$$


$$section
### Qlik Cloud Space Types $(id="spaceTypes")

Select relevant space types of Qlik Cloud to filter the dashboards ingested into the platform.

Example: `Personal`, `Shared`, `Managed`, `Data`
$$