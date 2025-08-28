# Snowplow

In this section, we provide guides and references to use the Snowplow connector.

## Requirements

The Snowplow connector supports integration with both Snowplow BDP (managed deployment) and Community (self-hosted) deployments.

For BDP deployments, you'll need:
- Access to the Snowplow Console
- An API Key with appropriate permissions
- Your Organization ID

For Community deployments, you'll need:
- Access to your pipeline configuration files
- Proper file system permissions to read the configuration

You can find further information on the Snowplow connector in the <a href="https://docs.open-metadata.org/connectors/pipeline/snowplow" target="_blank">docs</a>.

## Connection Details

$$section
### Deployment Type $(id="deployment")

Select your Snowplow deployment type:
- **BDP**: Snowplow's managed Business Data Platform
- **Community**: Self-hosted Snowplow deployment

The required configuration fields will change based on your selection.
$$

$$section
### Console URL $(id="consoleUrl")

The URL of your Snowplow Console for BDP deployments. This should be the base URL where you access the Snowplow Console UI.

Example: `https://console.snowplow.io`

This field is required for BDP deployments only.
$$

$$section
### API Key $(id="apiKey")

The API Key for accessing the Snowplow Console API. This key should have sufficient permissions to read pipeline configurations and metadata.

To generate an API key:
1. Log into your Snowplow Console
2. Navigate to Account Settings
3. Select API Keys section
4. Create a new API key with read permissions

This field is required for BDP deployments only.
$$

$$section
### Organization ID $(id="organizationId")

Your Snowplow BDP Organization ID. This unique identifier is used to access your organization's resources in the Snowplow Console.

You can find your Organization ID in:
1. Snowplow Console Account Settings
2. The URL when accessing your console (e.g., `https://console.snowplow.io/organizations/{org-id}`)

This field is required for BDP deployments only.
$$

$$section
### Configuration Path $(id="configPath")

The file system path to your Snowplow pipeline configuration files for Community deployments.

This should point to the directory containing your Snowplow configuration files (e.g., collector configs, enrichment configs, etc.).

Example: `/opt/snowplow/configs`

<span style="font-size: 1.1em; color: #b22222; font-style: italic; font-weight: bold;">If you are using the Configuration Path option, you must run the ingestion workflow through the CLI instead of the UI.</span>

This field is required for Community deployments only.
$$

$$section
### Cloud Provider $(id="cloudProvider")

Select the cloud provider where your Snowplow infrastructure is deployed:
- **AWS**: Amazon Web Services
- **GCP**: Google Cloud Platform
- **Azure**: Microsoft Azure

This information helps optimize the metadata extraction based on cloud-specific configurations.

Default: AWS
$$

$$section
### Pipeline Filter Pattern $(id="pipelineFilterPattern")

A regular expression pattern to exclude certain pipelines from ingestion.

Examples:
- Exclude test pipelines: `.*test.*`
- Exclude development pipelines: `^dev-.*`
- Exclude multiple patterns: `(.*test.*|.*dev.*|.*staging.*)`

Leave empty to ingest all available pipelines.
$$