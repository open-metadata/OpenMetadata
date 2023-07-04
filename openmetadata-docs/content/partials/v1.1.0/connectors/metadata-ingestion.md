{% stepsContainer %}

{% step srNumber=1 %}

{% stepDescription title="1. Visit the Services Page" %}

The first step is to ingest the metadata from your sources. To do that, you first need to create a Service connection first. This
Service will be the bridge between OpenMetadata and your source system.

Once a Service is created, it can be used to configure your ingestion workflows.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.1.0/connectors/visit-database-service-page.png"
alt="Visit Services Page"
caption="Find Databases option on left panel of the settings page" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=2 %}

{% stepDescription title="2. Create a New Service" %}

Click on the 'Add New Service' button to start the Service creation.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.1.0/connectors/create-database-Service.png"
alt="Create a new Service"
caption="Add a new Service from the Database Services page" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=3 %}

{% stepDescription title="3. Select the Service Type" %}

Select {% $connector %} as the Service type and click Next.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.1.0/connectors/$connectorPath/select-service.png"
alt="Select Service"
caption="Select your Service from the list" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=4 %}

{% stepDescription title="4. Name and Describe your Service" %}

Provide a name and description for your Service as illustrated below.

#### Service Name

OpenMetadata uniquely identifies Services by their Service Name. Provide
a name that distinguishes your deployment from other Services, including
the other {% $connector %} Services that you might be ingesting metadata
from.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.1.0/connectors/$connectorPath/add-new-Service.png"
alt="Add New Service"
caption="Provide a Name and description for your Service" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=5 %}

{% stepDescription title="5. Configure the Service Connection" %}

In this step, we will configure the connection settings required for
this connector. Please follow the instructions below to ensure that
you've configured the connector to read from your {% $connector %} Service as
desired.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.1.0/connectors/$connectorPath/service-connection.png"
alt="Configure Service connection"
caption="Configure the Service connection by filling the form" /%}

{% /stepVisualInfo %}

{% /step %}

{% extraContent parentTagName="stepsContainer" %}
