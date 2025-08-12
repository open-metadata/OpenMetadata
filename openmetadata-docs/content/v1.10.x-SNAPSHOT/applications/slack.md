---
title: Slack Integration with Collate for Data Collaboration
description: Integrate Collate with Slack to enable real-time data collaboration, search assets, receive notifications, and share metadata insights directly in Slack.
slug: /applications/slack
collate: true
---

# Slack Application in Collate

Integrate Collate with Slack to enhance data collaboration and streamline team workflows. This integration enables real-time notifications, in-Slack search and sharing of metadata assets, and message interactions—all within your existing Slack workspace.

## Overview

The Slack application connects your Slack workspace with Collate, enabling seamless communication and metadata access:

- **Real-Time Notifications**: Receive instant alerts, mentions, and updates directly in Slack.
- **Metadata Search**: Quickly search for glossaries, terms, tags, and tables within Slack.
- **Asset Sharing**: Share Collate assets effortlessly with your team from Slack.
- **Enhanced Productivity**: Stay informed and connected without leaving your workspace.

## Key Capabilities

- **Search Entities**: Use Slack to search glossaries, terms, tags, and tables.
- **Share Assets**: Share metadata assets from Collate to your team directly in Slack.
- **Notifications**: Get notified when someone mentions `@collate2`, or when updates occur in your data workspace.

## Authorizations

When connected, Collate will have the following permissions in Slack:

- View and respond to messages that mention `@collate2`.
- Access content in public channels where Collate is added.
- Join public channels and view their basic information.
- Add and respond to shortcuts and slash commands.
- Access content in direct messages and group direct messages.
- View user profiles in the workspace.
- Send messages as `@collate2`, including to channels it's not a member of.
- Post messages to designated Slack channels.

## Slack App Configuration

To enable Slack integration in Collate:

1. Navigate to **Settings** → **Applications** → **Add Apps**.

{% image
src="/images/v1.10/applications/slack1.png"
alt="Configuration"
caption="Configuration"
/%}

2. Search for **Slack** and install the application.

{% image
src="/images/v1.10/applications/slack2.png"
alt="Configuration"
caption="Configuration"
/%}

### Configuration Fields

- **User Token**: Token used to authenticate Slack API requests on behalf of a user.
- **Bot Token**: Token used to authenticate Slack API requests on behalf of the bot.

{% image
src="/images/v1.10/applications/slack3.png"
alt="Configuration"
caption="Configuration"
/%}

{% note %}

Ensure that both tokens are securely stored and have the required scopes for interaction with your Slack workspace.

{% /note %}

## How to Obtain Slack Bot Token and User Token

To integrate Slack with Collate, you need to generate both a **Bot Token** and a **User Token** from your Slack workspace. These tokens allow Collate to interact with Slack APIs on behalf of your application and users.

## Step-by-Step Instructions

### 1. Create a Slack App

1. Go to the [Slack API: Your Apps](https://api.slack.com/apps) page.
2. Click **Create New App**.

{% image
src="/images/v1.10/applications/slack4.png"
alt="Configuration"
caption="Configuration"
/%}

3. Select **From scratch**.

{% image
src="/images/v1.10/applications/slack5.png"
alt="Configuration"
caption="Configuration"
/%}

4. Enter the **App Name** (e.g., `Collate Integration`) and choose your **Slack workspace**.
5. Click **Create App**.

{% image
src="/images/v1.10/applications/slack6.png"
alt="Configuration"
caption="Configuration"
/%}

### 2. Configure OAuth & Permissions

1. In your app’s dashboard, navigate to **OAuth & Permissions**.

{% image
src="/images/v1.10/applications/slack7.png"
alt="Configuration"
caption="Configuration"
/%}

2. Under **Scopes**, configure the following:

{% image
src="/images/v1.10/applications/slack8.png"
alt="Configuration"
caption="Configuration"
/%}

#### For **Bot Token Scopes**:
Add these scopes:
- `chat:write`
- `channels:read`
- `groups:read`
- `im:read`
- `mpim:read`
- `users:read`
- `commands`
- `app_mentions:read`

#### For **User Token Scopes**:
Add these scopes:
- `channels:history`
- `groups:history`
- `im:history`
- `mpim:history`

{% note %}

Only add the scopes you need. Ensure your Slack workspace allows user token generation (may require admin privileges).

{% /note %}

### 3. Install the App to Workspace

1. Still in **OAuth & Permissions**, click **Install** to install App to your Workspace.

{% image
src="/images/v1.10/applications/slack9.png"
alt="Configuration"
caption="Configuration"
/%}

2. Authorize the permissions requested by the app.

After installation, you'll be redirected to the OAuth screen where your tokens will be displayed.

### 4. Copy the Tokens

- **Bot User OAuth Token**: Starts with `xoxb-...`
- **User OAuth Token**: Starts with `xoxp-...`

Store these tokens securely and provide them in the Slack app configuration within Collate.

{% note %}

- Never expose your tokens publicly.
- Rotate tokens periodically.
- Use Slack's [token rotation policy](https://api.slack.com/authentication/token-types#rotating) for better security.

{% /note %}

For more information, refer to the [Slack API documentation](https://api.slack.com/).
