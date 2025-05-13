{% stepsContainer %}

{% step srNumber=1 %}

{% stepDescription title="1. Visit the Services Page" %}
Click `Settings` in the side navigation bar and then `Services`.

The first step is to ingest the metadata from your sources. To do that, you first need to create a Service connection first. 

This Service will be the bridge between OpenMetadata and your source system.

Once a Service is created, it can be used to configure your ingestion workflows.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.7/connectors/visit-services-page.png"
  alt="Visit Services Page"
  caption="Select your Service Type and Add a New Service" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=2 %}

{% stepDescription title="2. Create a New Service" %}

Click on _Add New Service_ to start the Service creation.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.7/connectors/create-new-service.png"
  alt="Create a new Service"
  caption="Add a new Service from the Services page" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=3 %}

{% stepDescription title="3. Select the Service Type" %}

Select {% $connector %} as the Service type and click _Next_.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src=$selectServicePath
  alt="Select Service"
  caption="Select your Service from the list" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=4 %}

{% stepDescription title="4. Name and Describe your Service" %}

Provide a name and description for your Service.

#### Service Name

OpenMetadata uniquely identifies Services by their **Service Name**. Provide
a name that distinguishes your deployment from other Services, including
the other {% $connector %} Services that you might be ingesting metadata
from.

Note that when the name is set, it cannot be changed.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src=$addNewServicePath
  alt="Add New Service"
  caption="Provide a Name and description for your Service" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=5 %}

{% stepDescription title="5. Configure the Service Connection" %}

In this step, we will configure the connection settings required for {% $connector %}.

Please follow the instructions below to properly configure the Service to read from your sources. You will also find 
helper documentation on the right-hand side panel in the UI.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src=$serviceConnectionPath
  alt="Configure Service connection"
  caption="Configure the Service connection by filling the form" /%}

{% /stepVisualInfo %}

{% /step %}
