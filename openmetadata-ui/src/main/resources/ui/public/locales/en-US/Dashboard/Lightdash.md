# Lightdash

In this section, we provide guides and references to use the Lightdash connector.

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
