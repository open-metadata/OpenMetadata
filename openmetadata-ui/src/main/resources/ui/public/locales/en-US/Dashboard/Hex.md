# Hex

In this section, we provide guides and references to use the Hex connector.

## Requirements

To access the Hex APIs and import projects, notebooks, and datasets from Hex into OpenMetadata, you'll need a **Hex API token**.

## Hex Account Setup and Permissions

### Step 1: Generate an API Token

To generate an API token in Hex:

1. Log into your <a href="https://app.hex.tech" target="_blank">Hex account</a>.
2. Navigate to your account settings or workspace settings.
3. Go to the API tokens section.
4. Generate a new token based on your needs:
   - **Personal Token**: For accessing your personal projects
   - **Workspace Token**: For accessing all projects in a workspace (requires admin permissions)
5. Copy and securely store the generated token.

### Step 2: Verify API Access

Ensure that your token has the necessary permissions to:
- List and read projects
- Access project metadata
- Read notebook contents and outputs

You can find further information on the Hex connector in the <a href="https://docs.open-metadata.org/connectors/dashboard/hex" target="_blank">docs</a>.

## Connection Details

$$section
### Host and Port $(id="hostPort")

The URL for your Hex instance. 

For Hex cloud users, use `https://app.hex.tech`.

For self-hosted Hex instances, provide your custom domain URL.
$$

$$section
### Token Type $(id="tokenType")

Select the type of token you're using for authentication:

- `personal`: Use a personal access token to import projects you have access to
- `workspace`: Use a workspace token to import all projects in the workspace (requires workspace admin permissions)

Default value is `personal`.
$$

$$section
### API Token $(id="token")

The API token for authentication with Hex.

To generate a token:
1. Log into your Hex account
2. Navigate to Settings
3. Go to the API tokens section
4. Generate a new personal or workspace token
5. Copy the token value

**Important**: Store this token securely as it provides access to your Hex projects.
$$

$$section
### Include Categories and Status as Tags $(id="includeTags")

Enable this option to import Hex project categories and status as OpenMetadata tags.

When enabled, any categories and status assigned to your Hex projects will be automatically converted to tags in OpenMetadata, helping you organize and search for projects more effectively.

Default value is `true`.
$$