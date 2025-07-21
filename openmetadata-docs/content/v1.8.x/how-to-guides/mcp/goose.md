---
title: Getting Started with Goose Desktop
slug: /how-to-guides/mcp/goose
---

# Getting Started with Goose Desktop

Configure {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %}'s MCP Server to interact with block's AI agent [Goose](https://github.com/block/goose). 

## Prerequisites
For this guide, you will need:
- {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} v1.8.0 - You can upgrade your version of {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} with [this guide](https://docs.open-metadata.org/latest/deployment/upgrade)
- [Goose Desktop](https://block.github.io/goose/docs/quickstart/)


## Add MCP App to {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %}
{% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} has a variety of applications to improve your data such as MetaPilot, Data Insights, Search Indexing, and MCP.

- Go to <YOUR-OpenMetadata-SERVER>/marketplace/apps/McpApplication and select *Install*. If your {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} is installed locally, the url would be:
```
http://localhost:8585/settings/apps/McpApplication
```

{% image
src="/images/v1.8/how-to-guides/mcp/install-mcp.jpg"
alt="Add MCP app"
caption="Install MCP Server on OpenMetadata"
/%}

- The next screen, with *Origin Header URI* is for Streamable-Http requests. This guide uses SSE, so we can skip this portion, select *Submit*

## Creating your {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} Personal Access Token
The next step will be to create a Personal Access Token (PAT) and add it to Goose so your models can communicate with {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %}.

- To create an {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} Personal Access Token, go to:
```
 <YOUR-OpenMetadata-SERVER>/users/<YOUR-USERNAME>/access-token
```

If {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} is installed locally, it will be:
```
http://localhost:8585/users/admin/access-token
```

- Select *Generate New Token*. This will give your models the same role and access policy that is assigned to you in {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %}. If you would like your models in Goose to have different access controls, [create a new user](https://docs.open-metadata.org/latest/how-to-guides/admin-guide/roles-policies/use-cases).

{% image
src="/images/v1.8/how-to-guides/mcp/generate-new-token.jpg"
alt="Generate New Token"
caption="Creating a new Personal Access Token"
/%}

- Set your *Token Expiration*. This guide uses 60 days. Once your new token is created copy it.

{% image
src="/images/v1.8/how-to-guides/mcp/generate-new-token-2.jpg"
alt="Set Token Lifespan"
caption="Personal Access Token expires in 60 days"
/%}

## Adding your {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} MCP Server to Goose Desktop
This how-to guide uses Goose Desktop for macOS. Make sure that you already have an [LLM Provider configured](https://block.github.io/goose/docs/quickstart/#configure-provider) before prompting.

- Navigate to Goose Desktop's Settings, then under *Extensions*, select *+Add custom extension*. 

{% ossContent %}
{% image
src="/images/v1.8/how-to-guides/mcp/goose-settings.jpg"
alt="Goose settings"
caption="Settings are where you add custom extensions like OpenMetadata MCP Server"
/%}
{% /ossContent %}
{% collateContent %}
{% image
src="/images/v1.8/how-to-guides/mcp/goose-settings.jpg"
alt="Goose settings"
caption="Settings are where you add custom extensions like Collate MCP Server"
/%}
{% /collateContent %}

- The custom extension should have the following information:
  - *Extension Name* {% collateContent %}`Collate`{% /collateContent %}{% ossContent %}`OpenMetadata`{% /ossContent %}
  - *Command* paste the following command:
    ```
    npx -y mcp-remote <YOUR_OpenMetadata_SERVER>/mcp/sse --auth-server-url=<YOUR_OpenMetadata_SERVER>/mcp --client-id=openmetadata --verbose --clean --header Authorization:${AUTH_HEADER}
    ```
    - If you are running [it locally](https://docs.open-metadata.org/latest/quick-start/local-docker-deployment), your command will look like this:
      ```
      npx -y mcp-remote http://localhost:8585/mcp/sse --auth-server-url=http://localhost:8585/mcp --client-id=openmetadata --verbose --clean --header Authorization:${AUTH_HEADER}
      ```
  - Add 1 *Environment Variable*
    - *Variable name* is `AUTH_HEADER`
    - *Value* is "Bearer <YOUR_OpenMetadata_PAT>

{% ossContent %}
{% image
src="/images/v1.8/how-to-guides/mcp/goose-mcp-settings.jpg"
alt="Configuring OpenMetadata MCP Server"
caption="The proper settings for OpenMetadata MCP Server in Goose"
/%}
{% /ossContent %}
{% collateContent %}
{% image
src="/images/v1.8/how-to-guides/mcp/goose-mcp-settings.jpg"
alt="Configuring Collate MCP Server"
caption="The proper settings for Collate MCP Server in Goose"
/%}
{% /collateContent %}

    - Select *+Add* to store this Environment Variable
{% ossContent %}
{% image
src="/images/v1.8/how-to-guides/mcp/goose-mcp-settings.jpg"
alt="Configuring OpenMetadata MCP Server"
caption="The proper settings for OpenMetadata MCP Server in Goose"
/%}
{% /ossContent %}
{% collateContent %}
{% image
src="/images/v1.8/how-to-guides/mcp/goose-mcp-settings.jpg"
alt="Configuring Collate MCP Server"
caption="The proper settings for Collate MCP Server in Goose"
/%}
{% /collateContent %}

  - Select *Add Extension*
{% ossContent %}
{% image
src="/images/v1.8/how-to-guides/mcp/goose-add-extension.jpg"
alt="Adding extension"
caption="Adding OpenMetadata MCP Server as a custom extension to Goose"
/%}
{% /ossContent %}
{% collateContent %}
{% image
src="/images/v1.8/how-to-guides/mcp/goose-add-extension.jpg"
alt="Adding extension"
caption="Adding Collate MCP Server as a custom extension to Goose"
/%}
{% /collateContent %}

{% ossContent %}
{% image
src="/images/v1.8/how-to-guides/mcp/goose-success.jpg"
alt="OpenMetadata successfully added"
caption="OpenMetadata successfully added to Goose"
/%}
{% /ossContent %}
{% collateContent %}
{% image
src="/images/v1.8/how-to-guides/mcp/goose-success.jpg"
alt="Collate successfully added"
caption="Collate successfully added to Goose"
/%}
{% /collateContent %}

## Prompt to read from {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %}
This part of the guide assumes that you have assets in {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %}. You can add data assets into {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} [here](https://docs.open-metadata.org/latest/connectors).

Select a model from Goose and paste the following prompt to have it read from {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %}:
```
What tables do you have access to in OpenMetadata?
```


### Show us what you got
With MCP, we are finding new ways to use {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} all the time! Now that you have Goose and {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} configured to work together, think you've got a great new use case? Show us what you've got in the {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} #mcp Slack Channel!
