---
title: Apply UI Changes
slug: /developers/contribute/developing-a-new-connector/apply-ui-changes
---

# Apply UI Changes

To be able to configure your connector from the UI and test it through there as well you will need to modify a file located within [`openmetadata-ui/src/main/resources/ui/src/utils/`](https://github.com/open-metadata/OpenMetadata/tree/main/openmetadata-ui/src/main/resources/ui/src/utils)

Which file you need to modify depends on the Source Type you are developing a connector for: `{source_type}ServiceUtils.ts`.

The change itself is pretty straightforward since you only need to add the JSON Schema connection you created.

### Example - MySQL

{% note %}
The file will be shortened and parts of it will be replaced with `...` for readability.
{% /note %}

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=1 %}

* **import mysqlConnection from ...**: Import your connection from the JSON Schema file.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

* **getDatabaseConfig**: In the `switch` statement within the `getDatabaseConfig` add a new case for your new Connector.

For example, if you were developing the `myOwnConnection.json` connector, you could add the following case:

```js
case DatabaseServiceType.MyOwn: {
    schema = myOwnConnection;
    break;
}
```

where
- **MyOwn**: Would be the Service Type defined on `myOwnConnection.json`
- **myOWnConnection**: Would be the import startement

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="DatabaseServiceUtils.ts" %}
```js {% srNumber=1 %}
...
import mysqlConnection from '../jsons/connectionSchemas/connections/database/mysqlConnection.json';
```
```js {% srNumber=2 %}

export const getDatabaseConfig = (type: DatabaseServiceType) => {
  let schema = {};
  const uiSchema = { ...COMMON_UI_SCHEMA };
  switch (type as unknown as DatabaseServiceType) {
    ...
    case DatabaseServiceType.Mysql: {
      schema = mysqlConnection;

      break;
    }
    ...
    default: {
      schema = {};

      break;
    }
  }

  return cloneDeep({ schema, uiSchema });
};

```

{% /codeBlock %}
{% /codePreview %}

## UI Documentation to follow along

If you pay attention when configuring a connector through the UI you will see that there is a follow along documentation to assist you.

In order to add this feature, you need to create a new file `YourConnector.md` within

[`openmetadata-ui/src/main/resources/ui/public/locales/en-US/{source_type}`](https://github.com/open-metadata/OpenMetadata/tree/main/openmetadata-ui/src/main/resources/ui/public/locales/en-US), in the proper Source Type.

### Example - MySQL

{% note %}
The file will be shortened and parts of it will be replaced with `...` for readability.
{% /note %}

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=3 %}

First we give an overview about the Connector and any requirements or important information the user should know

{% /codeInfo %}

{% codeInfo srNumber=4 %}

Within the `## Connection Details` section you can see that we use some special notation `$(id="{something}")`.

This is used to sync the documentation here with the property that the user is configuring at a given time (The "follow along" feature if you will).

In order to make it work properly you need to set the ID of each section to the property of the JSON Schema.

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="DatabaseServiceUtils.ts" %}

```md {% srNumber=3 %}
# MySQL

In this section, we provide guides and references to use the MySQL connector.

## Requirements
To extract metadata the user used in the connection needs to have access to the `INFORMATION_SCHEMA`. By default, a user can see only the rows in the `INFORMATION_SCHEMA` that correspond to objects for which the user has the proper access privileges.

~~~SQL
-- Create user. If <hostName> is ommited, defaults to '%'
-- More details https://dev.mysql.com/doc/refman/8.0/en/create-user.html
CREATE USER '<username>'[@'<hostName>'] IDENTIFIED BY '<password>';

-- Grant select on a database
GRANT SELECT ON world.* TO '<username>';

-- Grant select on a database
GRANT SELECT ON world.* TO '<username>';

-- Grant select on a specific object
GRANT SELECT ON world.hello TO '<username>';
~~~

$$note
OpenMetadata supports MySQL version `8.0.0` and up.
$$

### Profiler & Data Quality
Executing the profiler Workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. The user should also be allowed to view information in `tables` for all objects in the database. More information on the profiler workflow setup can be found [here](https://docs.open-metadata.org/connectors/ingestion/workflows/profiler) and data quality tests [here](https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality).

You can find further information on the MySQL connector in the [docs](https://docs.open-metadata.org/connectors/database/mysql).

```
```md {% srNumber=4 %}
## Connection Details

$$section
### Scheme $(id="scheme")
SQLAlchemy driver scheme options. If you are unsure about this setting, you can use the default value.
$$

$$section
### Username $(id="username")
Username to connect to MySQL. This user should have access to the `INFORMATION_SCHEMA` to extract metadata. Other workflows may require different permissions -- refer to the section above for more information.
$$

...
```

{% /codeBlock %}
{% /codePreview %}

## Next Step

It is possible that you need to implement a small piece of Java code to make everything work perfectly depending on the Connection Schema.
You can learn more about it in the next step.

{%inlineCallout
  color="violet-70"
  bold="Create the Java ClassConverter"
  icon="MdArrowForward"
  href="/developers/contribute/developing-a-new-connector/create-java-class-converter"%}
  Learn what is the Java ClassConverter and how to create it
{%/inlineCallout%}
