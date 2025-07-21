---
title: Getting Started with Claude Desktop
slug: /how-to-guides/mcp/claude
---

# Getting Started with Claude Desktop

Configure {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %}'s MCP Server to interact with Anthropic's AI assistant platform. 

## Prerequisites
For this guide, you will need:
- {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} v1.8.0 - You can upgrade your version of {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} with [this guide](https://docs.open-metadata.org/latest/deployment/upgrade)
- [Claude Desktop](https://claude.ai/download)

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
The next step will be to create a Personal Access Token (PAT) and add it to Claude Desktop so that it can communicate with {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %}

- To create an {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} Personal Access Token, go to:
```
 <YOUR-OpenMetadata-SERVER>/users/<YOUR-USERNAME>/access-token
```

If {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} is installed locally, it will be:
```
http://localhost:8585/users/admin/access-token
```

- Select *Generate New Token*. This will give your models the same role and access policy that is assigned to you in {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %}. If you would like Claude to have different access controls, [create a new user](https://docs.open-metadata.org/latest/how-to-guides/admin-guide/roles-policies/use-cases).

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

## Adding your {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} MCP Server to Claude Desktop
This how-to guide uses the free version of Claude Desktop for macOS with Sonnet 4.

- Navigate to Claude Desktop's Settings, then select *Developer* and *Edit Config*. Paste the following into `claude_desktop_config.json`

```
{"mcpServers": {
    "openmetadata": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "<YOUR-OpenMetadata-SERVER>/mcp/sse",                 #http://localhost:8585/mcp/sse
        "--auth-server-url=<YOUR-OpenMetadata-SERVER>/mcp",   #http://localhost:8585/mcp
        "--client-id=openmetadata",
        "--verbose",
        "--clean",
        "--header",
        "Authorization:${AUTH_HEADER}"
      ],
      "env": {
        "AUTH_HEADER": "Bearer <YOUR-OpenMetadata-PAT>"
      }
    }
  }
}
```

- Restart Claude Desktop. You should see your {% collateContent %}`Collate`{% /collateContent %}{% ossContent %}`OpenMetadata`{% /ossContent %}`openmetadata` service running


## Prompt to read from {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %}
This part of the guide assumes that you have assets in {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} that Claude can read, and that some of your data assets have references to customers. You can change the prompt accordingly and/or add data sources into {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} [here](https://docs.open-metadata.org/latest/connectors).

Paste the following prompt into Claude to have it read from {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %}:
```
What tables do you have access to in OpenMetadata?
```

Claude will ask if it can use the external integration `openmetadata`, select *Allow always*. You may have to do this multiple times, once for each tool. Claude is now reading from {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} via its MCP Server!

{% image
src="/images/v1.8/how-to-guides/mcp/claude-allow.jpg"
alt="Allow Claude to use OpenMetadata"
caption="Claude asking for permission to search OpenMetadata"
/%}



### Show us what you got
With MCP, we are finding new ways to use {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} all the time! Now that you have Claude and {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} configured to work together, think you've got a great new use case? Show us what you've got in the {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} #mcp Slack Channel!
