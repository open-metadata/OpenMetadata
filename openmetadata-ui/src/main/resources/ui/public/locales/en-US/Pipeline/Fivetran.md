# Fivetran

In this section, we provide guides and references to use the Fivetran connector.

## Requirements
To access Fivetran APIs, a Fivetran account on a Standard, Enterprise, or Business Critical plan is required.

You can find further information on the Fivetran connector in the <a href="https://docs.open-metadata.org/connectors/pipeline/fivetran" target="_blank">docs</a>.

## Connection Details

$$section
### API Key $(id="apiKey")

Follow the steps mentioned below to generate the Fivetran API key and API secret:

1. Click your user name in your Fivetran dashboard.

2. Click API Key.

3. Click Generate API key. (If you already have an API key, then the button text is Generate new API key.)

4. Make a note of the key and secret as they won't be displayed once you close the page or navigate away.

For more detailed documentation visit <a href="https://fivetran.com/docs/rest-api/getting-started" target="_blank">here</a>.

$$

$$section
### Host and Port $(id="hostPort")

Pipeline Service Management URI. This should be specified as a URI string in the format `scheme://hostname:port`. By default, OpenMetadata will use `https://api.fivetran.com` to connect to the Fivetran APIs.

$$

$$section
### API Secret $(id="apiSecret")

Follow the steps mentioned below to generate the Fivetran API key and API secret:

1. Click your user name in your Fivetran dashboard.
2. Click `API Key`.
3. Click `Generate API key`. If you already have an API key, then the button text is `Generate new API key`.
4. Make a note of the key and secret as they won't be displayed once you close the page or navigate away.

For more detailed documentation visit <a href="https://fivetran.com/docs/rest-api/.getting-started" target="_blank">here</a>

$$

$$section
### Limit $(id="limit")

This refers to the maximum number of records that can be returned in a single page of results when using Fivetran's API for pagination.
$$
