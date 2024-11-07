# Custom Property

OpenMetadata supports custom properties in the data assets.

$$section
### Name $(id="name")

The name must start with a lowercase letter, as preferred in the camelCase format. Uppercase letters and numbers can be included in the field name; but spaces, underscores, and dots are not supported.
$$

$$section
### Display Name $(id="displayName")

Display Name that identifies this custom property.
$$

$$section
### Type $(id="propertyType")

Select the preferred property Type from among the options provided.
$$

$$section
### Description $(id="description")

Describe your custom property to provide more information to your team.
$$

$$section
### Enum Values $(id="enumConfig")

Add the list of values for enum property.
$$

$$section
### Multi Select $(id="multiSelect")

Enable multi select of values for enum property.
$$

$$section
### Format $(id="formatConfig")

To specify a format for the `date` or `dateTime` type, example you can use the following pattern: `dd-MM-yyyy` or `dd-MM-yyyy HH:mm:ss`.
$$

**Supported Date formats**

- `yyyy-MM-dd`
- `dd MMM yyyy`
- `MM/dd/yyyy`
- `dd/MM/yyyy`
- `dd-MM-yyyy`
- `yyyyDDD`
- `d MMMM yyyy`

**Supported DateTime formats**

- `MMM dd HH:mm:ss yyyy`
- `yyyy-MM-dd HH:mm:ss`
- `MM/dd/yyyy HH:mm:ss`
- `dd/MM/yyyy HH:mm:ss`
- `dd-MM-yyyy HH:mm:ss`
- `yyyy-MM-dd HH:mm:ss.SSS`
- `yyyy-MM-dd HH:mm:ss.SSSSSS`
- `dd MMMM yyyy HH:mm:ss`

**Supported Time formats**

- `HH:mm:ss`


$$section
### Entity Reference type $(id="entityReferenceConfig")

Select the reference type for your custom property value type.
$$