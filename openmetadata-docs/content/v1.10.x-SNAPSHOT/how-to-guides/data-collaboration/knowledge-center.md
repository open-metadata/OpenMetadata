---
title: Overview of Knowledge Center
slug: /how-to-guides/data-collaboration/knowledge-center
collate: true
---

# Overview of Knowledge Center

As organizations increasingly rely on OpenMetadata for discovery, collaboration, data quality, observability, and governance, there is a need to house long-form articles right within OpenMetadata to describe architecture, showcase usage tutorials, and document best practices in data management. Instead of turning to tools like Google Docs or Confluence to document these extensive details, data teams can create articles in OpenMetadata's Knowledge Center to share crucial information with the team.

Knowledge Center helps to **centralize tribal knowledge** and **enhance data documentation** in your organization. The Knowledge Center supports the creation of **in-depth, long-form knowledge articles**. The innovative new editor facilitates rich content creation, embedding images and other media to elucidate complex details. OpenMetadata's knowledge center **fosters seamless connection** between documentation and data assets by allowing users to **tag teams and data assets** as references. Knowledge Articles come equipped with **comments, version history,** and all the other features that are an integral part of OpenMetadata.

{% image
src="/images/v1.10/how-to-guides/collaboration/knowledge-center.gif"
alt="Knowledge Center"
caption="Knowledge Center"
/%}

## Create Knowledge Articles
To create a knowledge article, navigate to the **Knowledge Center** and click on **Add Article**.
{% image
src="/images/v1.10/how-to-guides/collaboration/article.png"
alt="Knowledge Center"
caption="Knowledge Center"
/%}

Type **/** to select text styles like Headers, Text, Bulleted List, Numbered List, Code Block, Data Assets, Quote, Images, Divider, and @ Mentions.
{% image
src="/images/v1.10/how-to-guides/collaboration/options.png"
alt="Knowledge Center"
caption="Knowledge Center"
/%}

Knowledge articles can be owned by Users as well as Teams.
{% image
src="/images/v1.10/how-to-guides/collaboration/team.png"
alt="A Team or a User can be the Owner"
caption="A Team or a User can be the Owner"
/%}

## OpenMetadata Supports Nested Articles
You can arrange your articles hierarchically by nesting the articles. From the left menu in the Knowledge Center, click on the + next to an article to create a nested article.

{% image
src="/images/v1.10/how-to-guides/collaboration/nested.png"
alt="Nested Articles"
caption="Nested Articles"
/%}

## Associate Data Assets with the Knowledge Articles
Knowledge articles can be associated with the concerned data assets, so that information about the data assets is readily available. Click on + in the right hand menu for Data Assets to search and add the related data assets for an article.

{% image
src="/images/v1.10/how-to-guides/collaboration/data-asset.png"
alt="Associate Data Assets"
caption="Associate Data Assets"
/%}

{% image
src="/images/v1.10/how-to-guides/collaboration/data-asset2.png"
alt="Associated Data Assets"
caption="Associated Data Assets"
/%}

In the knowledge article, you can also type **#** and start typing to be able to select the relevant data asset to tag it.
{% image
src="/images/v1.10/how-to-guides/collaboration/da.png"
alt="Associate Data Assets"
caption="Associate Data Assets"
/%}

You can also use the **/** command, scroll down, and select the option **Link Data Asset**.
{% image
src="/images/v1.10/how-to-guides/collaboration/da2.png"
alt="Associate Data Assets"
caption="Associate Data Assets"
/%}

## Tag Teams and Users using @ Mentions
Use the **/** command, scroll down, and select the option **Mention**.
{% image
src="/images/v1.10/how-to-guides/collaboration/mention.png"
alt="Tag Teams and Users"
caption="Tag Teams and Users"
/%}

Or you can simply type **@** and start typing to be able to mention the concerned person or team.
{% image
src="/images/v1.10/how-to-guides/collaboration/mention2.png"
alt="Tag Teams and Users"
caption="Tag Teams and Users"
/%}

## Add Tags to Categorize the Articles
You can categorize the articles in your Knowledge Center by tagging the articles. The option to tag is available on the right hand panel of the article.
{% image
src="/images/v1.10/how-to-guides/collaboration/tag.png"
alt="Tag the Article"
caption="Tag the Article"
/%}

## Add Glossary Terms
Similarly, you can add glossary terms to the knowledge article by selecting the required glossary terms from the right hand panel of the article.
{% image
src="/images/v1.10/how-to-guides/collaboration/term.png"
alt="Associate with Glossary Terms"
caption="Associate with Glossary Terms"
/%}

## Collaborate with your Team using Comments
While creating or updating articles, or even when deleting existing articles, you can communicate with your fellow team members using **comments** for that article.

Click on the chat icon to add comments.
{% image
src="/images/v1.10/how-to-guides/collaboration/chat.png"
alt="Comment on an Article"
caption="Comment on an Article"
/%}

You can tag your team in the comments and also add emojis.
{% image
src="/images/v1.10/how-to-guides/collaboration/chat2.png"
alt="Comment on an Article"
caption="Comment on an Article"
/%}

## Add Quicklinks to External Resources
If you already have a comprehensive knowledge article in an external source, and you want to reference those links within the knowledge center, then such links can be added as Quicklinks. From the Knowledge Center, click on the **Add** button to add a quicklink.

{% image
src="/images/v1.10/how-to-guides/collaboration/quicklink.png"
alt="Add a Quicklink"
caption="Add a Quicklink"
/%}

Enter the details and save the quicklink
{% image
src="/images/v1.10/how-to-guides/collaboration/quicklink2.png"
alt="Quicklink Details"
caption="Quicklink Details"
/%}

You can also **add tags and associate glossary terms** with the quicklinks.
{% image
src="/images/v1.10/how-to-guides/collaboration/quicklink3.png"
alt="Quicklink Details"
caption="Quicklink Details"
/%}

## Search Support for Knowledge Articles
Users can search for knowledge articles by **Owners** and **Tags**.
{% image
src="/images/v1.10/how-to-guides/collaboration/search.png"
alt="Associated Data Assets"
caption="Associated Data Assets"
/%}

## Bookmark the Articles
Users can click on the **Star icon** to bookmark the articles while in the knowledge article page.
{% image
src="/images/v1.10/how-to-guides/collaboration/star.png"
alt="Star to Bookmark the Article"
caption="Star to Bookmark the Article"
/%}

When in the article listing page, users can click on the **Bookmark icon**.
{% image
src="/images/v1.10/how-to-guides/collaboration/bookmark.png"
alt="Bookmark the Article"
caption="Bookmark the Article"
/%}

You can view all the bookmarked articles in the right hand side.
{% image
src="/images/v1.10/how-to-guides/collaboration/bookmark2.png"
alt="Bookmarked Article"
caption="Bookmarked Article"
/%}

## Upvote or Downvote the Articles
Users can rate the knowledge articles by upvoting or downvoting them.
{% image
src="/images/v1.10/how-to-guides/collaboration/vote.png"
alt="Rate the Article"
caption="Rate the Article"
/%}

## Preview the Articles
When viewing the list of knowledge articles, you can get a quick preview of the selected article. The preview is displayed on the right hand side.

## Version History
OpenMetadata displays the version history of the knowledge articles. Click on the version history icon to view the details.
{% image
src="/images/v1.10/how-to-guides/collaboration/vh.png"
alt="Version History of the Article"
caption="Version History of the Article"
/%}

## Delete an Article
Click on the **⋮** icon on the top right of the knowledge article or quicklinks page and select the option **Delete**.
{% image
src="/images/v1.10/how-to-guides/collaboration/delete.png"
alt="Delete an Article"
caption="Delete an Article"
/%}

## Knowledge Center Widget on 'My Data' Page
All the articles that are owned by you or your team are displayed in the Knowledge Center widget on your 'My Data' page.
{% image
src="/images/v1.10/how-to-guides/collaboration/kc-widget.png"
alt="Knowledge Center Widget"
caption="Knowledge Center Widget"
/%}

With Knowledge Center, critical knowledge and documentation are readily available where users need them, making OpenMetadata a comprehensive hub for all things data.