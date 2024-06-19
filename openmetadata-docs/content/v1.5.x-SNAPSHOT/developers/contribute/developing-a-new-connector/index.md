---
title: Developing a new Connector
slug: /developers/contribute/developing-a-new-connector
---

# Developing a New Connector

## Overview

There is an ever-increasing source of metadata and it is possible that OpenMetadata doesn't already have implemented the one you need.

On this guide we will go through the steps needed in order to be able to contribute by developing a new connector yourself by using the already implemented MySQL connector as an example.

{% note %}

**Developing a new Connector vs Custom Connectors**

Developing a new connector makes sense if it could be used by many other users. **If you are dealing with a custom solution used only in your case, it makes more sense to actually create your own Custom Connector by following [this guide](/connectors/custom-connectors)**

{% /note %}

## Prerequisite

Before starting developing your own connector you need to have the developing environment properly setup and OpenMetadata up and running locally for testing purposes.

Please follow the instructions [here](/developers/contribute/build-code-and-run-tests)

## Steps

1. [Define the JSON Schema](/developers/contribute/developing-a-new-connector/define-json-schema)
2. [Develop the Ingestion Code](/developers/contribute/developing-a-new-connector/develop-ingestion-code)
3. [Apply UI Changes](/developers/contribute/developing-a-new-connector/apply-ui-changes)
4. [Create the Java ClassConverter](/developers/contribute/developing-a-new-connector/create-java-class-converter)
5. [Test it](/developers/contribute/developing-a-new-connector/test-it)
6. [Update the Documentation](/developers/contribute/developing-a-new-connector/update-documentation)

## References

### Previous Webinars

There are some interesting webiners that cover an overview of the ingestion framework as well as a hands-on workshop for creating a new connector.

Note that while specific technicalities might be outdated (patterns for naming files or functions), the overall structure, flow and abstractions described in the videos are still relevant. For any nuances you can look at the current state of the ingestion code to see what is the best practice.

1. [How does the Ingestion Framework Work?](https://youtu.be/i7DhG_gZMmE)
2. [How to Create your Own OpenMetadata Connector](https://youtu.be/ZvA4wuvINFA)
