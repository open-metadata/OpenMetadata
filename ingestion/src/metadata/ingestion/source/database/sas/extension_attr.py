#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Extension attributes
"""

TABLE_CUSTOM_ATTR = [
    # Dataset attributes
    {
        "name": "analysisTimeStamp",
        "description": "The timestamp indicating when this object was last analyzed.",
        "propertyType": {"id": "STRING_TYPE", "type": "type"},
    },
    {
        "name": "creator",
        "description": "The creator/author of this object.",
        "propertyType": {"id": "STRING_TYPE", "type": "type"},
    },
    {
        "name": "editor",
        "description": "Specifies the Person who edited the object.",
        "propertyType": {"id": "STRING_TYPE", "type": "type"},
    },
    {
        "name": "rowCount",
        "description": "Number of rows in the data set.",
        "propertyType": {"id": "INT_TYPE", "type": "type"},
    },
    {
        "name": "columnCount",
        "description": "Number of columns in the data set.",
        "propertyType": {"id": "INT_TYPE", "type": "type"},
    },
    {
        "name": "dataSize",
        "description": "Size of the data set in bytes.",
        "propertyType": {"id": "INT_TYPE", "type": "type"},
    },
    {
        "name": "completenessPercent",
        "description": "The percentage of completeness for this data set.",
        "propertyType": {"id": "INT_TYPE", "type": "type"},
    },
    {
        "name": "dateCreated",
        "description": "The date on which the object was created.",
        "propertyType": {"id": "STRING_TYPE", "type": "type"},
    },
    {
        "name": "dateModified",
        "description": "The date on which the object was most recently modified.",
        "propertyType": {"id": "STRING_TYPE", "type": "type"},
    },
    {
        "name": "source",
        "description": "The context from which the referenced resource was obtained.",
        "propertyType": {
            "id": "STRING_TYPE",
            "type": "type",
        },
    },
    # SAS Table attributes
    {
        "name": "CASLIB",
        "description": "The name of the CAS library for this table.",
        "propertyType": {"id": "STRING_TYPE", "type": "type"},
    },
    {
        "name": "casHost",
        "description": "The CAS host for the library for this table.",
        "propertyType": {"id": "STRING_TYPE", "type": "type"},
    },
    {
        "name": "engineName",
        "description": "The name of the SAS data access engine used to connect to data.",
        "propertyType": {"id": "STRING_TYPE", "type": "type"},
    },
    {
        "name": "casPort",
        "description": "The CAS port for the library for this table.",
        "propertyType": {"id": "INT_TYPE", "type": "type"},
    },
    # CAS Table attributes
    {
        "name": "sourceName",
        "description": "Name of the file source for this data set.",
        "propertyType": {"id": "STRING_TYPE", "type": "type"},
    },
    {
        "name": "sourceCaslib",
        "description": "Name of the caslib source for this data set.",
        "propertyType": {"id": "STRING_TYPE", "type": "type"},
    },
]
