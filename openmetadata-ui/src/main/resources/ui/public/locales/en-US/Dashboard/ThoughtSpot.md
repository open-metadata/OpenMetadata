# ThoughtSpot

In this section, we provide guides and references to use the ThoughtSpot connector.

## Requirements

To access the ThoughtSpot APIs and import liveboards, charts, and data models from ThoughtSpot into OpenMetadata, you need appropriate permissions on your ThoughtSpot instance.

## ThoughtSpot Account Setup and Permissions

### Step 1: Authentication Setup

ThoughtSpot supports multiple authentication methods:

**Basic Authentication:**
- Username and password authentication
- The user should have appropriate permissions to read metadata from ThoughtSpot

**API Access Token Authentication:**
- Use ThoughtSpot API access tokens for authentication
- Generate API access tokens from your ThoughtSpot instance

### Step 2: API Permissions

Ensure your ThoughtSpot user or service account has the following permissions:
- Read access to liveboards and answers
- Read access to worksheets and data models
- Access to metadata APIs
- Export permissions for TML (ThoughtSpot Modeling Language) data

### Step 3: Multi-tenant Configuration (Optional)

If you're using ThoughtSpot Cloud with multiple organizations:
- Set the `Organization ID` parameter to specify which organization to connect to
- This is only applicable for ThoughtSpot Cloud instances

You can find further information on the ThoughtSpot connector in the [docs](https://docs.open-metadata.org/connectors/dashboard/thoughtspot).

## Connection Details

$$section
### Host and Port $(id="hostPort")

The URL of your ThoughtSpot instance. This should be the base URL of your ThoughtSpot deployment.

**Examples:**
- For ThoughtSpot Cloud: `https://my-company.thoughtspot.cloud`
- For on-premise: `https://thoughtspot.company.com`
- For local development: `https://localhost`

If you are running the OpenMetadata ingestion in a docker and your ThoughtSpot instance is hosted on `localhost`, then use `host.docker.internal` as the hostname.
$$

$$section
### Authentication $(id="authentication")

Choose the authentication method for connecting to ThoughtSpot:

**Basic Authentication:**
- **Username**: Your ThoughtSpot username
- **Password**: Your ThoughtSpot password

**API Access Token Authentication:**
- **Access Token**: Your ThoughtSpot API access token
$$

$$section
### API Version $(id="apiVersion")

The ThoughtSpot API version to use for metadata extraction.

**Options:**
- **v1**: Legacy API version (callosum endpoints)
- **v2**: Current API version (recommended)

**Default:** v2
$$

$$section
### Organization ID $(id="orgId")

Organization ID for multi-tenant ThoughtSpot instances. This parameter is only applicable for ThoughtSpot Cloud deployments.

**Usage:**
- Leave empty for single-tenant instances
- Set to your organization ID for multi-tenant ThoughtSpot Cloud
- This helps identify which organization's data to extract

**Default:** null (single-tenant)
$$
