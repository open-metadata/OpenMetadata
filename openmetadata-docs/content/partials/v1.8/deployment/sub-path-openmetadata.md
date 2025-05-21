# Subpath in OpenMetadata

To configure **OpenMetadata** to operate under a subpath (e.g., `/openmetadata`)—useful when deploying behind a reverse proxy or load balancer—you need to adjust specific settings in the `openmetadata.yaml` configuration file.

---

## Configuration Steps

### 1. Set the Base Path

Define the `basePath` parameter to configure the application's root context, and ensure that the `publicKeyUrl` is updated accordingly to reflect the new base path.

This sets the root context for the application.

```yaml
basePath: ${BASE_PATH:-/openmetadata}
```

This configuration sets the base path to /openmetadata by default. You can override it by setting the BASE_PATH environment variable.

### 2. Configure Web Paths

Adjust the web-related paths to align with the specified base path.


```yaml
assets:
  resourcePath: /openmetadata/assets/
  uriPath: ${BASE_PATH:-/openmetadata}
```

- `applicationContextPath`: Defines the context path for the web application.
- `rootPath`: Specifies the root path for API endpoints. [GitHub](https://github.com/open-metadata/OpenMetadata/discussions/17954)

### 3. Set Asset Paths

Ensure that asset paths are correctly prefixed with the base path.

```yaml
assets:
  resourcePath: /openmetadata/assets/
  uriPath: ${BASE_PATH:-/openmetadata}
```

- `resourcePath`: Path to static resources.
- `uriPath`: URI path prefix for assets.

{% image
  src="/images/v1.8/deployment/subpath/subpath.gif"
/%}

## Example Configuration

Here's how the relevant section of your `openmetadata.yaml` might look:

```yaml
basePath: ${BASE_PATH:-/openmetadata}
publicKeyUrl: ${BASE_PATH:-/}api/v1/system/config/jwks

web:
  applicationContextPath: ${BASE_PATH:-/openmetadata}
  rootPath: ${BASE_PATH:-/openmetadata}api/*

assets:
  resourcePath: /openmetadata/assets/
  uriPath: ${BASE_PATH:-/openmetadata}
```

## Deployment Considerations

- **Reverse Proxy Configuration**: Ensure that your reverse proxy (e.g., NGINX, Apache) is configured to forward requests to the OpenMetadata application with the correct subpath.

- **Environment Variables**: You can override the default base path by setting the BASE_PATH environment variable in your deployment environment. Ensure that related parameters such as basePath, applicationContextPath, rootPath, and publicKeyUrl are updated to reflect this change.

- **Static Assets**: Verify that static assets are accessible under the new subpath to prevent broken links or missing resources.
