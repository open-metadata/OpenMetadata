---
title: Create the Java ClassConverter
slug: /developers/contribute/developing-a-new-connector/create-java-class-converter
---

# Create the Java ClassConverter

**If and only if you had to use the `oneOf` property type on your connector's JSON Schema you also need to implement a Java ClassConverter to be able to instantiate the correct class from the configuration.**

Without this, Java doesn't know the proper Class to instantiate and it wouldn't work as expected.

{% note %}
This is necessary even if you are indirectly using a `oneOf` property by referencing another JSON Schema that uses it.
{% /note %}


## Implementing your ClassConverter

In order to implement the `ClassConverter` you need to create a new file within

[`openmetadata-service/src/main/java/org/openmetadata/service/secrets/converter`](https://github.com/open-metadata/OpenMetadata/tree/main/openmetadata-service/src/main/java/org/openmetadata/service/secrets/converter)

There you should create a new public class that extends `ClassConverter`. The easiest way to achieve this is to use another `ClassConverter` as a reference.

### Example - MysqlConnectionClassConverter.java

Here we will see how to create a ClassConverter for the MysqlConnection, where we define the `authType` using the `oneOf` attribute.

{% note %}
The file will be shortened and parts of it will be replaced with `...` for readability.
{% /note %}

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=1 %}

Before anything else you need to remember to import the needed classes.

In this example we need to import the `MysqlConnection` itself and both the `IamAuthConfig` and `basicAuth`. It is important to remember that this classes are generated from the JSON Schema and can be found within `openmetadata-spec/target/classes/org/openmetadata/schema/services/connections`.

If you remember from [Define the JSON Schema](/developers/contribute/developing-a-new-connector/define-json-schema), the MysqlConnection uses `oneOf` to define the `authType` property:

```json
    ...
    "authType": {
      "title": "Auth Configuration Type",
      "description": "Choose Auth Config Type.",
      "oneOf": [
        {
          "$ref": "./common/basicAuth.json"
        },
        {
          "$ref": "./common/iamAuthConfig.json"
        }
      ]
    },
    ...
```

{% /codeInfo %}

{% codeInfo srNumber=2 %}

With the needed imports in place, now it is time to extend the `ClassConverter` class to create the `MysqlConnectionClassConverter`.

We are overriding the `convert` method and going the following:
1. Creating a `MysqlConnection` instance from the json object received
2. Getting the `AuthType` configuration and trying to use it to instantiate either a `basicAuth` or a `IamAuthConfig`. The first success will be returned.
3. We set the `AuthType` to be this newly instantaited class
4. We return the `MysqlConnection` instance.

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="DatabaseServiceUtils.ts" %}

```java {% srNumber=1 %}
...
package org.openmetadata.service.secrets.converter;

import java.util.List;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.IamAuthConfig;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.service.util.JsonUtils;
```
```java {% srNumber=2 %}

/** Converter class to get an `MysqlConnectionClassConverter` object. */
public class MysqlConnectionClassConverter extends ClassConverter {

  private static final List<Class<?>> CONFIG_SOURCE_CLASSES =
      List.of(basicAuth.class, IamAuthConfig.class);

  public MysqlConnectionClassConverter() {
    super(MysqlConnection.class);
  }

  @Override
  public Object convert(Object object) {
    MysqlConnection mysqlConnection = (MysqlConnection) JsonUtils.convertValue(object, this.clazz);

    tryToConvert(mysqlConnection.getAuthType(), CONFIG_SOURCE_CLASSES)
        .ifPresent(mysqlConnection::setAuthType);

    return mysqlConnection;
  }
}
```

{% /codeBlock %}
{% /codePreview %}

## Making your ClassConverter visible

Now that your ClassConverter is implemented you need to add it to the [`ClassconverterFactory.java`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-service/src/main/java/org/openmetadata/service/secrets/converter/ClassConverterFactory.java) file, located in the same path.

### Example - MysqlConnectionClassconverter

{% note %}
The file will be shortened and parts of it will be replaced with `...` for readability.
{% /note %}

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=3 %}

Before anything else you need to remember to import your `ClassConverter`

{% /codeInfo %}

{% codeInfo srNumber=4 %}

Now you just need to add a new `Map.entry` to the `converterMap`.

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="DatabaseServiceUtils.ts" %}

```java {% srNumber=3 %}
...
import org.openmetadata.schema.services.connections.database.MysqlConnection;
...
```
```java {% srNumber=4 %}
public final class ClassConverterFactory {
  ...
  static {
    converterMap =
        Map.ofEntries(
            ...
            Map.entry(MysqlConnection.class, new MysqlConnectionClassConverter()));
  }
  ...
}
```

{% /codeBlock %}
{% /codePreview %}

## Next Step

Now that the code is ready, let's learn how to test it!

{%inlineCallout
  color="violet-70"
  bold="Test It"
  icon="MdArrowForward"
  href="/developers/contribute/developing-a-new-connector/test-it"%}
  Learn how to test your new connector!
{%/inlineCallout%}
