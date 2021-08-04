# Entities

An Entity is a special type that has an identity and represents an object that is either real or conceptual. An entity can be related to another entity through relationships. An Entity has two types of **Fields** - **Attributes** and **Relationships**:

### **Attributes**

**Attributes** represent an Entity’s data. Entities MUST include an attribute called **ID** that uniquely identifies an instance of an entity. It might optionally include a human-readable **fullyQualitifedName** attribute that uniquely identifies the entity. An attribute of an entity MUST not be another Entity and should be captured through a relationship. Entities typically SHOULD have the following common attributes:

| Abstract | Extensible |
| :--- | :--- |
| **id** | Mandatory attribute of type UUID that identifies the entity instance |
| **name** | Name of the entity \(example database name\). For some entities, the name may uniquely identify an entity. |
| **fullyQualifiedName** | Human-readable name that uniquely identifies an entity that is formed using all the names in the hierarchy above the given entity. Example -  Attributes of an entity may also have  to uniquely identify a field. For example, a column of a table has  attribute set to  |
| **displayName** | Optional name used for display purposes. For example, the name could be john.smith@domain.com and displayName could be John Smith. |
| **description** | Description of the entity instance. Not all entities need a description. For example, a User entity might not need a description and just the name of the user might suffice. A  entity needs  to provide details of what is stored in the database when to use it and other information on how to use it. |
| **Owner** | Optional attribute used to capture the ownership information. Not all entities have ownership information \(for example User, Team, and Organization). |
| **href** | An attribute generated on the fly as part of API response to provide the URL link to the entity returned. |

### **Relationships**

**Relationships** capture information about the association of an Entity with another Entity. Relationships can have cardinality - **One-to-one**, **One-to-many**, **Many-to-one**, and **Many-to-many**. Example of relationships:

* One-to-one: A Table is owned by a User
* One to Many: a Database contains multiple Tables.
* Many-to-Many: A User belongs to multiple Teams. A team has multiple Users.

All relationships are captured using the EntityReference type.

Following is an example of a JSON schema of the User entity with attributes id, displayName, and email. User entity has one-to-many relationships to another entity Team \(user is member of multiple teams\).: is a special shell builtin
string: not found

## Metadata system entities

Metadata system has the following core entities:
1. **Data Entities** - These entities represent data, such as databases, tables, and topics, and assets created using data, such as Dashboards, Reports, Metrics, and ML Features. It also includes entities such as Pipelines that are used for creating data assets.
2. **Services** - Services represent platforms and services used for storing and processing data. It includes Online Data Stores, Data Warehouses, ETL tools, Dashboard services, etc.
3. **Users & Teams** - These entities represent users within an organization and teams that they are organized under.
4. **Activities** - These entities are related to feeds, posts, and notifications for collaboration between users.
5. **Glossary and Tags** - Entities for defining business glossary that includes hierarchical tags.

## List of Schema Entities

{% page-ref page="bots.md" %}

{% page-ref page="dashboard.md" %}

{% page-ref page="database.md" %}

{% page-ref page="databaseservice.md" %}

{% page-ref page="thread.md" %}

{% page-ref page="metrics.md" %}

{% page-ref page="pipeline.md" %}

{% page-ref page="report.md" %}

{% page-ref page="table.md" %}

{% page-ref page="tagcategory.md" %}

{% page-ref page="team.md" %}

{% page-ref page="user.md" %}
