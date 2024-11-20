# Mode

In this section, we provide guides and references to use the Mode connector.

## Requirements

OpenMetadata relies on Mode's API, which is exclusive to members of the Mode Business Workspace. This means that only resources that belong to a Mode Business Workspace can be accessed via the API.

You can find further information on the Mode connector in the [docs](https://docs.open-metadata.org/connectors/dashboard/mode).

## Connection Details

$$section
### Host Port $(id="hostPort")

This parameter specifies the host and port of the Mode server. This should be specified as a URI string in the format `https://app.mode.com`.
$$

$$section
### Access Token $(id="accessToken")

Get the Access Token by following these steps:
1. Navigate to your Mode instance homepage.
2. Click on your name in the upper left corner and click `My Account`.
3. Click on `API Tokens` on the left side.
4. To generate a new API token and password, enter a token name and click `Create token`.
5. Copy the generated access token and password.

For detailed information, you can visit the official [docs](https://mode.com/developer/api-reference/introduction/).
$$

$$section
### Access Token Password $(id="accessTokenPassword")

Copy the access token password from the step above where a new token is generated.

For detailed information, you can visit the official [docs](https://mode.com/developer/api-reference/introduction/).
$$

$$section
### Workspace Name $(id="workspaceName")

Name of the Mode workspace.
$$

$$section
### Filter Query Param $(id="filterQueryParam")

This value is the `filter` query parameter that is passed to the Mode API. Different API
calls use different types of acceptable values. Currently this parameter is only implemented
to [list all collections](https://mode.com/developer/api-reference/management/collections/#listCollections). 
The valid values that is currently supported are: `all`
and `custom`. If this field is left empty, `all` will be used.

$$