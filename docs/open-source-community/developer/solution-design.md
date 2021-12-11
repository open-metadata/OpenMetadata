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

If we abstract away from the Storage Layer for a moment, we then realize that the OpenMetadata implementation is the integration of three blocks:

1. The core **API,** unifying and centralising the communication with internal and external systems.
2. The **UI** for a team-centric metadata Serving Layer.
3. The **Ingestion Framework** as an Interface between OpenMetadata and external sources.

The only thing these components have in common is the **vocabulary** -> All of them are shaping, describing, and moving around metadata **Entities**.

OpenMetadata is based on a **standard definition** for metadata. Therefore, we need to make sure that in our implementation of this standard we share this definition in the end-to-end workflow. To this end, the main lexicon is defined as JSON Schemas, a readable and language-agnostic solution.

Then, when packaging the main components, we generate the specific programming classes for all the Entities. What we achieve is three views from the same source:

* Java Classes for the API,
* Python Classes for the Ingestion Framework and
* Javascript Classes for the UI,

each of them modelled after a single source of truth. Thanks to this approach we can be sure that it does not matter at which point we zoom in throughout the whole process, we are always going to find a univocal well-defined Entity.

## API Container Diagram

Now we are going to zoom inside the API Container. As the central Software System of the solution, its goal is to **manage calls** (both from internal and external sources, e.g., Ingestion Framework or any custom integration) and update the **state** of the metadata Entities.

While the data is stored in the MySQL container, the API will be the one fetching it and completing the necessary information, validating the Entities data and all the relationships.

Having a **Serving Layer** (API) decoupled from the Storage Layer allows users and integrations to ask for what they need in a simple language (REST), without the learning curve of diving into specific data models and design choices.

![API Container Diagram](../../.gitbook/assets/system-context-diagram-API-Container-Diagram.drawio.png)

### Entity Resource

When we interact with most of our Entities, we follow the same endpoint structure. For example:

* `GET <url>/api/v1/<collectionName>/<id>` to retrieve an Entity instance by ID, or
* `GET <url>/api/v1/<collectionName>/name/<FQDN>` to query by its fully qualified domain name.

Similarly, we support other CRUD operations, each of them expecting a specific incoming data structure, and returning the Entity's class. As the foundations of OpenMetadata are the Entities definitions, we have this data contract with any consumer, where the backend will validate the received data, as well as the outputs.

The endpoint definition and datatype setting are what happens at the **Entity Resource**. Each metadata Entity is packed with a Resource class, which builds the API definition for the given Entity.

This logic is what then surfaces in the API [docs](https://sandbox.open-metadata.org/docs).

### Entity Repository

The goal of the Entity Repository is to perform Read & Write operations to the **backend database** to Create, Retrieve, Update and Delete Entities.

While the Entity Resource handles external communication, the Repository is in charge of managing how the whole process interacts with the Storage Layer, making sure that incoming and outcoming Entities are valid and hold proper and complete information.

This means that here is where we define our **DAO (Data Access Object)**, with all the validation and data storage logic.

As there are processes repeated across all Entities (e.g., listing entities in a collection or getting a specific version from an Entity), the Entity Repository extends an **Interface** that implements some basic functionalities and abstracts Entity specific logic.

Each Entity then needs to implement its **server-side processes** such as building the FQDN based on the Entity hierarchy, how the Entity stores and retrieves **Relationship** information with other Entities or how the Entity reacts to **Change Events**.

## Entity Storage Layer

In the _API Container Diagram,_ we showed how the Entity Repository interacts with three different Storage Containers (tables) depending on what type of information is being processed.

To fully understand this decision, we should first talk about the information contained by Entities instances.

An Entity has two types of fields: **attributes** (JSON Schema `properties`) and **relationships** (JSON Schema `href`_):_

* **Attributes** are the core properties of the Entity: the name and id, the columns for a table, or the algorithm for an ML Model. Those are **intrinsic** pieces of information of an Entity and their existence and values are what help us differentiate both Entity instances (Table A vs. Table B) and Entity definitions (Dashboard vs. Topic).
* **Relationships** are associations between two Entities. For example, a Table belongs to a Database, a User owns a Dashboard, etc. Relationships are a special type of attribute that is captured using **Entity** **References**.

### Entity and Relationship Store

Entities are stored as JSON documents in the database. Each entity has an associated table (`<entityName>_entity`) which contains the JSON defining the Entity **attributes** and other metadata fields, such as the `id`, `updatedAt` or `updatedBy`.

This JSON does not store any Relationship. E.g., a User owning a Dashboard is a piece of information that is materialised in a separate table `entity_relationship` as graph nodes, where the edge holds the type of the Relationship (e.g., `contains`, `uses`, `follows`...).

This separation helps us decouple concerns. We can process related entities independently and validate at runtime what information needs to be updated and/or retrieved. For example, if we delete a Dashboard being owned by a User, we will then clean up this row in `entity_relationship`, but that won't alter the information from the User.

Another trickier example would be trying to delete a Database that contains Tables. In this case, the process would check that the Database Entity is not empty, and therefore we cannot continue with the removal.
