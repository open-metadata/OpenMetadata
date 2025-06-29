---
title: OpenMetadata Browser Extension
slug: /how-to-guides/guide-for-data-users/browser-ext
---

# OpenMetadata Browser Extension

OpenMetadata’s Browser Extension bridges the gap between users and metadata. Visit the Chrome webstore and search for OpenMetadata to add the extension to your Chrome browser with just a few clicks. You can find the Chrome browser extension [here](https://chromewebstore.google.com/detail/openmetadata/pakbbdhbbiclnceabdmnghamabjloofc?hl=en&authuser=0&pli=1)

Once installed, pin the extension for easy accessibility. Simply click on the OpenMetadata icon in your Chrome browser to start using the extension. Add the base URL for your OpenMetadata instance, and connect by signing in. Once signed in, the OpenMetadata Chrome extension will display your Activity Feeds from My Data page. While working on a third party tool, which is integrated with OpenMetadata, you can simply click on the extension to view the associated metadata to access details about ownership, description, associated tags, glossary terms, schema, lineage, custom properties, and more.

Watch the video to learn how you can access all the metadata you need, directly into your active workspace.
{% youtube videoId="ZQckSIXAA6k" start="0:00" end="1:37" width="800px" height="450px" /%}

{% note %}

If you are using your own OpenMetadata instance which utilises Single Sign-On (SSO), you need to add the following URL to your SSO redirect list:

`https://pakbbdhbbiclnceabdmnghamabjloofc.chromiumapp.org/auth0`

\
For more information on how to add URL to SSO redirect list, you can visit this [page](/deployment/security).

{% /note %}

