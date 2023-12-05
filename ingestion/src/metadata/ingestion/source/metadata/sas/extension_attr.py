# String id = 9fc463a5-84bc-49c8-84f2-acfdcd3dc705
# Int id = 189dc756-717d-4630-8478-e2ffb8866b0f
# The string and int id's can be found using http://localhost:8585/api/v1/metadata/types?category=field

TABLE_CUSTOM_ATTR = [
    # Dataset attributes
    {
        "name": "source",
        "description": "The context from which the referenced resource was obtained.",
        "propertyType": {
            "id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705",  # String type
            "type": "type",
        },
    },
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
        "name": "mostImportantFields",
        "description": "Most important columns in the data set.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
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
        "name": "dataQualityScore",
        "description": "A high-level data quality score derived from other field and data set metrics.",
        "propertyType": {"id": "189dc756-717d-4630-8478-e2ffb8866b0f", "type": "type"},
    },
    {
        "name": "languagesIdentified",
        "description": "The languages detected in the data set.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "informationPrivacy",
        "description": "The data privacy setting suggestion for this data set.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "maxTimeStamp",
        "description": "The maximum timestamp field found in the data set.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "minTimeStamp",
        "description": "The minimum timestamp field found in the data set.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "characterSet",
        "description": "The character set of the data.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "dataLocale",
        "description": "The data set locale",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
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
    {
        "name": "encoding",
        "description": "The encoding used in the data.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "extension",
        "description": "The file extension (if any).",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "reviewStatus",
        "description": "Review status assigned by a data steward.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "sourceSystem",
        "description": "The type of source system that hosts the data set.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "keywords",
        "description": "Terms used to search and describe the data set.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "runId",
        "description": "Agent run identifier.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "runStatus",
        "description": "Agent run status.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "nColsPositiveSentiment",
        "description": "The number of columns with a positive sentiment polarity.",
        "propertyType": {"id": "189dc756-717d-4630-8478-e2ffb8866b0f", "type": "type"},
    },
    {
        "name": "nColsNegativeSentiment",
        "description": "The number of columns with a negative sentiment polarity.",
        "propertyType": {"id": "189dc756-717d-4630-8478-e2ffb8866b0f", "type": "type"},
    },
    {
        "name": "nColsNeutralSentiment",
        "description": "The number of columns with a neutral sentiment polarity.",
        "propertyType": {"id": "189dc756-717d-4630-8478-e2ffb8866b0f", "type": "type"},
    },
    {
        "name": "sentimentIDScore",
        "description": "Sentiment ID Score.",
        "propertyType": {"id": "189dc756-717d-4630-8478-e2ffb8866b0f", "type": "type"},
    },
    {
        "name": "sentimentID",
        "description": "Sentiment ID.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "nlpTerms",
        "description": "A comma-delimited list of NLP entity terms.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "nlpTags",
        "description": "A comma-delimited list of all the NLP entity tags associated with the NLP Terms.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "dateAccessed",
        "description": "The date on which the data set was most recently accessed.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "accessor",
        "description": "The principal who most recently accessed the data set.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "observationFrequency",
        "description": "The frequency of observations within the data set.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "observationFrequencyField",
        "description": "The field name used to derive the observation frequency.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "dateFieldCount",
        "description": "The number of date fields detected in the data set.",
        "propertyType": {"id": "189dc756-717d-4630-8478-e2ffb8866b0f", "type": "type"},
    },
    {
        "name": "topic",
        "description": "A generated label that describes the subject area of the data set.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "topicParent",
        "description": "Another classification that further describes the topic of the data set.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "topicKeywords",
        "description": "The keywords that influenced the selection of the topic.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    # SAS Table attributes
    {
        "name": "isView",
        "description": "Is this a view.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    {
        "name": "isEncrypted",
        "description": "Is this an encrypted data set.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
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
    {
        "name": "SESSREF",
        "description": "Specifies the name of the default CAS session to use if a statement or procedure does not explicitly identify a session reference name.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
    # CAS Table attributes
    {
        "name": "isLoaded",
        "description": "Is this data set loaded into memory.",
        "propertyType": {"id": "9fc463a5-84bc-49c8-84f2-acfdcd3dc705", "type": "type"},
    },
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