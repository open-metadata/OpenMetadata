# Sigma

In this section, we provide guides and references to use the Sigma connector.

## Requirements

OpenMetadata relies on Sigma's REST API. To know more you can read the <a href="https://help.sigmacomputing.com/reference/get-started-sigma-api#about-the-api" target="_blank">Sigma API Get Started docs</a>. To <a href="https://help.sigmacomputing.com/reference/generate-client-credentials#user-requirements" target="_blank">generate API client credentials</a>, you must be assigned the Admin account type.

## Connection Details

$$section
### Host Port $(id="hostPort")

The hostPort parameter specifies the host and port of the Sigma's API request URL. This should be specified as a string in the format `https://aws-api.sigmacomputing.com`. Sigma's API request URL varies according to the sigma cloud. you can determine your API url by following the docs <a href="https://help.sigmacomputing.com/reference/get-started-sigma-api#identify-your-api-request-url" target="_blank">here</a>.
$$

$$section
### Client Id $(id="clientId")

Get the Client Id and client Secret by following below steps:
- Navigate to your Sigma homepage.
- Click on Administration in the lower left corner.
- Click on Developer Access on the left side.
- To generate a new Client Id and client Secret, On upper left corner click `Create New`.
- Enter the required details asked and click `Create`.
- Copy the generated access token and password.

For detailed information visit <a href="https://help.sigmacomputing.com/reference/generate-client-credentials#generate-api-client-credentials" target="_blank">here</a>.
$$

$$section
### Client Secret $(id="clientSecret")

Copy the access token password from the step above where a new token is generated.

For detailed information visit <a href="https://help.sigmacomputing.com/reference/generate-client-credentials#generate-api-client-credentials" target="_blank">here</a>.
$$

$$section
### Api Version $(id="apiVersion")

Version of the Sigma REST API by default `v2`.

To get to know the Sigma REST API Version visit <a href="https://help.sigmacomputing.com/reference/get-started-sigma-api#identify-your-api-request-url" target="_blank">here</a> and look into the `Token URL` section.
$$
