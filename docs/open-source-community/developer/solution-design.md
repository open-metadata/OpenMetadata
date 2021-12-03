---
description: >-
  The Solution Design will help us explore and understand the internals of
  OpenMetadata services, how are they built and their interactions.
---

# Solution Design

We will start by describing the big picture of the software design of the application. Bit by bit we will get inside specific components, describing their behaviour and showing examples on how to use them.

## System Context

The goal of this first section is to get familiar with the high-level concepts and technologies involved. The learning objectives here are:

* Describe the elements that compose OpenMetadata and their relationships.
* How end-users and external applications can communicate with the system.

Here we have the main actors of the solution:

![System Context Diagram](../../.gitbook/assets/system-context-diagram.drawio.png)

* **API:** This is the main pillar of OpenMetadata. Here we have defined how we can interact with the metadata **Entities**. It powers all the other components of the solution.
* **UI:** Discovery-focused tool that helps users keep track of all the data assets in the organisation. Its goal is enabling and fueling **collaboration**.
* **Ingestion Framework:** Based on the API specifications, this system is the foundation of all the **Connectors**, i.e., the components that define the interaction between OpenMetadata and external systems containing the metadata we want to integrate.
* **Entity Store:** MySQL storage that contains real-time information on the state of all the **Entities** and their **Relationships**.
* **Search Engine:** Powered by ElasticSearch, it is the indexing system for the UI to help users **discover** the metadata.

### JSON Schemas

If we abstract away from the Storage Layer for a moment, we then realize that the OpenMetadata implementation is basically the integration of three blocks:

1. The core **API** unifying and centralising the communication with internal and external systems.
2. The **UI** for a team-centric metadata Serving Layer.
3. The **Ingestion Framework** as an Interface between OpenMetadata and external sources.

The only thing these components have in common is the **vocabulary** -> All of them are shaping, describing, and moving around metadata **Entities**.

OpenMetadata is based on a **standard definition** for metadata. Therefore, we need to make sure that in our implementation of this standard we share this definition in the end-to-end workflow. To this end, the main lexicon is defined as JSON Schemas, a readable and language-agnostic solution.

Then, when packaging the main components, we generate the specific programming classes for all the Entities. What we achieve is three views from the same source:

* Java Classes for the API,
* Python Classes for the Ingestion Framework and
* Javascript Classes for the UI,

each of them modelled after a single source of truth. Thanks to this approach we can be sure that it does not matter at which point we zoom in throughout the whole process, we are always going to find a univocal well-defined Entity.

##
