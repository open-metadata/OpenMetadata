# Lightdash

In this section, we provide guides and references to use the Lightdash connector.

## Requirements

### API Key

To extract metadata from Lightdash, you need an API key with appropriate permissions. The API key is used to authenticate all requests to the Lightdash REST API.

#### Generating an API Key

1. Log into your Lightdash instance
2. Navigate to **Settings** → **Personal Access Tokens** or **API Tokens**
3. Generate a new API token with the following permissions:
   - **Read access** to projects
   - **Read access** to spaces
   - **Read access** to dashboards and charts

#### Required Permissions

The API key needs the following capabilities:

```
- GET /api/v1/projects - List all projects
- GET /api/v1/projects/{projectUuid} - Get project details
- GET /api/v1/projects/{projectUuid}/spaces - List spaces in a project
- GET /api/v1/spaces/{spaceUuid}/dashboards - List dashboards in a space
- GET /api/v1/dashboards/{dashboardUuid} - Get dashboard details
- GET /api/v1/saved/{savedChartUuid} - Get chart details
```

$$note
The API key should have at minimum **Viewer** role permissions on the projects and spaces you want to extract metadata from. **Editor** or **Admin** roles are not required for metadata extraction.
$$

### Network Access

Ensure that the Lightdash instance is network accessible from where OpenMetadata ingestion runs:

- The `hostPort` URL must be reachable
- Firewall rules should allow HTTPS/HTTP traffic
- If using a proxy, configure proxy authentication settings

### Project and Space UUIDs

While optional, specifying Project UUID and Space UUID can help scope metadata extraction to specific projects or spaces. This is useful if you want to restrict extraction to a subset of your Lightdash content.

You can find further information on the Lightdash connector in the <a href="https://docs.open-metadata.org/connectors/dashboard/lightdash" target="_blank">docs</a>.

## Connection Details

$$section
### Host Port $(id="hostPort")

This parameter specifies the network location where your Lightdash instance is accessible, combining both the hostname and the port number. It should be formatted as a URI string, either `http://hostname:port` or `https://hostname:port`, depending on your security requirements.

For example, if you're hosting Lightdash on your local machine, you might use `http://localhost:8080`. If it's deployed on a server, you could use something like `https://lightdash.example.com:3000`.

Make sure that the port specified is open and accessible through your network firewall settings.
$$

$$section
### API Key $(id="apiKey")

This parameter is used to authenticate requests made to your Lightdash instance. The API Key should be kept secure and only shared with authorized applications or users. 

To use the API Key, include it in the headers of your HTTP requests as a means of validating your access to the Lightdash API.

For example, in an HTTP request, you might include the API Key like this:
Authorization: Bearer YOUR_API_KEY

Replace `YOUR_API_KEY` with the actual key provided by your Lightdash instance.
$$

$$section
### Project UUID $(id="projectUUID")

This parameter uniquely identifies a project within your Lightdash instance. The Project UUID is a critical piece of information used to associate API requests or configuration settings with a specific project.

You can find the Project UUID in your Lightdash dashboard or through the API, and it should be included in requests that need to target a particular project.

Keep your Project UUID handy when configuring integrations or automating workflows that involve your Lightdash projects.
$$

$$section
### Space UUID $(id="spaceUUID")

This parameter identifies a specific "Space" within your Lightdash instance, which is a container for organizing dashboards, charts, and other assets. The Space UUID is used to target a particular space when making API requests or configuring settings.

You can retrieve the Space UUID from your Lightdash dashboard or via the API. It should be included in requests that interact with resources within that space.

Make sure to reference the correct Space UUID when organizing your data or automating tasks to ensure you're interacting with the intended space.
$$

$$section
### Proxy Authentication $(id="proxyAuthentication")

This parameter is used to provide credentials when your Lightdash instance needs to authenticate through a proxy server. Proxy authentication ensures that only authorized traffic can pass through the proxy to access external resources or communicate with Lightdash.

When configuring proxy authentication, you typically need to provide a username and password, which are often combined into a single string and passed in the `Proxy-Authorization` header.

Make sure your credentials are securely stored and avoid hardcoding sensitive information directly in your configuration files. Regularly update and rotate credentials to maintain security.
$$
