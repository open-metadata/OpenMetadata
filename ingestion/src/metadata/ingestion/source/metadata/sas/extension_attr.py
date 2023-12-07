# String id = 9fc463a5-84bc-49c8-84f2-acfdcd3dc705
# Int id = 189dc756-717d-4630-8478-e2ffb8866b0f
# The string and int id's can be found using http://localhost:8585/api/v1/metadata/types?category=field

TABLE_CUSTOM_ATTR = [
    # Dataset attributes
    {
        "name": "analysisTimeStamp",
        "description": "The timestamp indicating when this object was last analyzed.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "creator",
        "description": "The creator/author of this object.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "editor",
        "description": "Specifies the Person who edited the object.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "rowCount",
        "description": "Number of rows in the data set.",
        "propertyType": {"id": "189dc756-717d-4630-8478-e2ffb8866b0f", "type": "type"},
    },
    {
        "name": "columnCount",
        "description": "Number of columns in the data set.",
        "propertyType": {"id": "189dc756-717d-4630-8478-e2ffb8866b0f", "type": "type"},
    },
    {
        "name": "dataSize",
        "description": "Size of the data set in bytes.",
        "propertyType": {"id": "189dc756-717d-4630-8478-e2ffb8866b0f", "type": "type"},
    },
    {
        "name": "completenessPercent",
        "description": "The percentage of completeness for this data set.",
        "propertyType": {"id": "189dc756-717d-4630-8478-e2ffb8866b0f", "type": "type"},
    },
    {
        "name": "dateCreated",
        "description": "The date on which the object was created.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "dateModified",
        "description": "The date on which the object was most recently modified.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    # SAS Table attributes
    {
        "name": "CASLIB",
        "description": "The name of the CAS library for this table.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "casHost",
        "description": "The CAS host for the library for this table.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "engineName",
        "description": "The name of the SAS data access engine used to connect to data.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "casPort",
        "description": "The CAS port for the library for this table.",
        "propertyType": {"id": "189dc756-717d-4630-8478-e2ffb8866b0f", "type": "type"},
    },

    # CAS Table attributes
    {
        "name": "sourceName",
        "description": "Name of the file source for this data set.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "sourceCaslib",
        "description": "Name of the caslib source for this data set.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
]