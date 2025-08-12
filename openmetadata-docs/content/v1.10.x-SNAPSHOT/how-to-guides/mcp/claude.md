---
title: Getting Started with Claude Desktop
slug: /how-to-guides/mcp/claude
---

# Getting Started with Claude Desktop

Configure {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %}'s MCP Server to interact with Anthropic's AI assistant platform.

## Prerequisites
For this guide, you will need:
- [nvm](https://github.com/nvm-sh/nvm)
- OpenMetadata v1.8.0 - You can upgrade your version of {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} with [this guide](https://docs.open-metadata.org/latest/deployment/upgrade)
- [Claude Desktop](https://claude.ai/download)

## Add MCP App to {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %}
{% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} has a variety of applications to improve your data such as MetaPilot, Data Insights, Search Indexing, and MCP.

- Go to <YOUR-OpenMetadata-SERVER>/marketplace/apps/McpApplication and select *Install*

{% ossContent %}
{% image
src="/images/v1.10/how-to-guides/mcp/install-mcp.jpg"
alt="Add MCP app"
caption="Install MCP Server on OpenMetadata"
/%}
{% /ossContent %}

{% collateContent %}
{% image
src="/images/v1.10/how-to-guides/mcp/install-mcp.jpg"
alt="Add MCP app"
caption="Install MCP Server on Collate"
/%}
{% /collateContent %}

- The next screen, with *Origin Header URI* is for Streamable-Http requests. This guide uses SSE, so we can skip this portion, select *Submit*

## Install mcp-remote
Next, we will be adding mcp-remote to Claude Desktop so we can give Claude secure access to your {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} MCP Server via support for HTTP+SSE.

- Install the latest node version
```
nvm install 22 && nvm alias default 22
```

- Install mcp-remote globally*
```
npm install -g mcp-remote
```

*Note: Installing globally may require you to run as root `sudo npm install -g mcp-remote`

- Start mcp-remote
```
npx @modelcontextprotocol/inspector
```

This will start mcp-remote's MCP Inspector on your localhost at [http://127.0.0.1:6274/](http://127.0.0.1:6274/). Keep your terminal window open, you will see requests coming from Claude to OpenMetadata through mcp-remote in this window once you start prompting.

## Adding your {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} PAT to mcp-remote
The next step will be to add your Personal Access Token (PAT) to mcp-remote so that Claude can communicate with {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %}

- Go to <YOUR-OpenMetadata-SERVER>/users/<YOUR-USERNAME>/access-token and select *Generate New Token*. This will give Claude the same role and access policy that is assign to you in {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %}, if you would like Claude to have different role-based access controls, create a new user.

{% image
src="/images/v1.10/how-to-guides/mcp/generate-new-token.jpg"
alt="Generate New Token"
caption="Creating a new Personal Access Token"
/%}

- Set your *Token Expiration*. This guide uses 60 days. Once your new token is created copy it.

{% image
src="/images/v1.10/how-to-guides/mcp/generate-new-token-2.jpg"
alt="Set Token Lifespan"
caption="Personal Access Token expires in 60 days"
/%}

- Paste your PAT in mcp-remote's MCP Inspector. 
  - MCP Inspector URL is [http://127.0.0.1:6274/](http://127.0.0.1:6274/)
  - *Transport Type* is SSE
  - *URL* is <YOUR-OpenMetadata-SERVER>/mcp/sse
  - *Bearer Token* is your PAT
  - Select *Connect*

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
        "<YOUR-OpenMetadata-SERVER>/mcp/sse",
        "--auth-server-url=<YOUR-OpenMetadata-SERVER>/mcp",
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

- Restart Claude Desktop. You should see your `openmetadata` service running

{% ossContent %}
{% image
src="/images/v1.10/how-to-guides/mcp/claude-settings.jpg"
alt="Claude Settings"
caption="OpenMetadata MCP Server running in Claude Desktop"
/%}
{% /ossContent %}
{% collateContent %}
{% image
src="/images/v1.10/how-to-guides/mcp/claude-settings.jpg"
alt="Claude Settings"
caption="Collate MCP Server running in Claude Desktop"
/%}
{% /collateContent %}

## Prompt to read from {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %}
This part of the guide assumes that you have assets in {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} that Claude can read, and that some of your data assets have references to customers. You can change the prompt accordingly and/or add data sources into OpenMetadata [here](https://docs.open-metadata.org/latest/connectors).

Past the following prompt into Claude to have it read from {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %}:
```
Imagine you're a data analyst tasked with building a customer retention dashboard. Can you help me identify which tables or datasets in the openmetadata database might contain relevant information?
```

Claude will ask if it can use the external integration {% collateContent %}`Collate`{% /collateContent %}{% ossContent %}`OpenMetadata`{% /ossContent %}, select *Allow always*. You may have to do this multiple times, once for each tool. Claude is now reading from {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} via its MCP Server!

{% ossContent %}
{% image
src="/images/v1.10/how-to-guides/mcp/claude-allow.jpg"
alt="Allow Claude to use OpenMetadata"
caption="Claude asking for permission to search OpenMetadata"
/%}
{% /ossContent %}
{% collateContent %}
{% image
src="/images/v1.10/how-to-guides/mcp/claude-allow.jpg"
alt="Allow Claude to use Collate"
caption="Claude asking for permission to search Collate"
/%}
{% /collateContent %}


### Show us what you got
With MCP, we are finding new ways to use {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} all the time! Now that you have Claude and {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} configured to work together, think you've got a great new use case? Show us what you've got in the {% collateContent %}Collate{% /collateContent %}{% ossContent %}OpenMetadata{% /ossContent %} #mcp Slack Channel!
