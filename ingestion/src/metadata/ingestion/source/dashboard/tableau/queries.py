#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
GraphQL queries used during ingestion
"""

TABLEAU_LINEAGE_GRAPHQL_QUERY = """
{
  workbooks {
    id
    luid
    name
    upstreamTables{
      id
      name
      schema
      upstreamDatabases{
        id
        name
      }
      referencedByQueries{
        id
        name
        query
      }
    }
  }
}
"""

TABLEAU_SHEET_QUERY_BY_ID = """
query SheetQuery {{
  sheets(filter: {{id: "{id}" }} ) {{
    name
    id
    worksheetFields {{ 
      name
      id
      dataType
    }}
    datasourceFields {{
      __typename
      name
      id
      ... on DatasourceField {{
        remoteField {{
          __typename
          ... on ColumnField {{
            dataType
          }}
        }}
      }}
    }}
  }}
}}
"""
