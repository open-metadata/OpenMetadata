---
title: Getting Started with Claude Desktop
slug: /how-to-guides/mcp/claude
---

# Getting Started with Claude Desktop

Configure OpenMetadata's MCP Server to interact with Anthropic's AI assistant platform. 

## Prerequisites
For this guide, you will need:
- [nvm](https://github.com/nvm-sh/nvm)
- OpenMetadata v1.8.0 - You can upgrade your version of OpenMetadata with [this guide](https://docs.open-metadata.org/latest/deployment/upgrade)
- [Claude Desktop](https://claude.ai/download)


## Add MCP App to OpenMetadata
OpenMetadata has a variety of applications to improve your data such as MetaPilot, Data Insights, Search Indexing, and MCP.

- Go to <YOUR-OpenMetadata-SERVER>/marketplace/apps/McpApplication and select *Install*

{% image
src="/images/v1.8/how-to-guides/mcp/install-mcp.jpg"
alt="Add MCP app"
caption="Install MCP Server on OpenMetadata"
/%}

- The next screen, with *Origin Header URI* is for Streamable-Http requests. This guide uses SSE, so we can skip this portion, select *Submit*

## Install mcp-remote
Next, we will be adding mcp-remote to Claude Desktop so we can give Claude secure access to your OpenMetadata MCP Server via support for HTTP+SSE.

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

This will start mcp-remote's MCP Inspector on your localhost at [http://127.0.0.1:6274/](http://127.0.0.1:6274/). *Note the Session Token provider, this will be used to authenticate your MCP Inspector session.

{% image
src="/images/v1.8/how-to-guides/mcp/mcp-inspector-auth.jpg"
alt="Generate New Token"
caption="Copy your token or use the pre-filled link"
/%}

Keep your terminal window open, you will see requests coming from Claude to OpenMetadata through mcp-remote in this window once you start prompting.

## Creating your OpenMetadata Personal Access Token
The next step will be to add your Personal Access Token (PAT) to mcp-remote so that Claude can communicate with OpenMetadata

- To create an OpenMetadata Personal Access Token, go to:
```
 <YOUR-OpenMetadata-SERVER>/users/<YOUR-USERNAME>/access-token
```
- Select *Generate New Token*. This will give Claude the same role and access policy that is assigned to you in OpenMetadata. If you would like Claude to have different role-based access controls, create a new user.

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

## Configuring your MCP Inspector for OpenMetadata
The right configuration will allow verification that OpenMetadata's MCP Server can be reached.
  - MCP Inspector URL is [http://127.0.0.1:6274/](http://127.0.0.1:6274/)
  - *Transport Type* is SSE
  - *URL* is <YOUR-OpenMetadata-SERVER>/mcp/sse
  - *Bearer Token* is your OpenMetadata Personal Access Token
  - In Configuration, *Inspector Proxy Address* is [127.0.0.1:6277](127.0.0.1:6277)
  - *Proxy Session Token* is the Session Token provided in your `npx @modelcontextprotocol/inspector` command
  - Select *Connect*

{% image
src="/images/v1.8/how-to-guides/mcp/mcp-inspector.jpg"
alt="MCP Inspector Configuration"
caption="Setting up OpenMetadata in MCP Inspector"
/%}

## Adding your OpenMetadata MCP Server to Claude Desktop
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

{% image
src="/images/v1.8/how-to-guides/mcp/claude-settings.jpg"
alt="Claude Settings"
caption="OpenMetadata MCP Server running in Claude Desktop"
/%}

## Prompt to read from OpenMetadata
This part of the guide assumes that you have assets in OpenMetadata that Claude can read. You can add data assets into OpenMetadata [here](https://docs.open-metadata.org/latest/connectors).

Paste the following prompt into Claude to have it read from OpenMetadata:
```
What tables do you have access to in OpenMetadata?
```

Claude will ask if it can use the external integration `openmetadata`, select *Allow always*. You may have to do this multiple times, once for each tool. Claude is now reading from OpenMetadata via its MCP Server!

{% image
src="/images/v1.8/how-to-guides/mcp/claude-allow.jpg"
alt="Allow Claude to use OpenMetadata"
caption="Claude asking for permission to search OpenMetadata"
/%}


### Show us what you got
With MCP, we are finding new ways to use OpenMetadata all the time! Now that you have Claude and OpenMetadata configured to work together, think you've got a great new use case? Show us what you've got in the OpenMetadata #mcp Slack Channel!
