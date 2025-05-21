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
GraphQL queries used during ingestion
"""

TABLEAU_DATASOURCES_QUERY = """
{{
workbooks(filter:{{luid: "{workbook_id}"}}){{
  id
  luid
  name
  embeddedDatasourcesConnection(first: {first}, offset: {offset} ) {{
    nodes {{
      id
      name
      upstreamDatasources{{
        id
        name
        description
        tags {{
          name
        }}
        fields {{
          id
          name
          upstreamColumns{{
            id
            name
            remoteType
          }}
          description
        }}
      }}
      fields {{
        id
        name
        upstreamColumns{{
          id
          name
          remoteType
        }}
        description
      }}
      upstreamTables {{
        id
        luid
        name
        fullName
        schema
        referencedByQueries {{
          id
          name
          query
        }}
        columns {{
          id
          name
        }}
        database {{
          id
          name
        }}
      }}
    }}
    totalCount
  }}
  }}
}}
"""

TALEAU_GET_CUSTOM_SQL_QUERY = """
{
  customSQLTables {
    name
    id
    downstreamDatasources{
      id
      name
    }
    query
  }
}
"""
