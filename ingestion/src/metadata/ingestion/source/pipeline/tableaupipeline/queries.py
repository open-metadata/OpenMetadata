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
GraphQL queries used against the Tableau Metadata API for the lineage of Prep
flows and extract refreshes.
ref: https://help.tableau.com/current/api/metadata_api/en-us/reference/flow.doc.html
"""

# A flow's own inputs and outputs are the tables and data sources of its input
# and output fields. Flow.upstreamTables, upstreamDatasources, downstreamTables
# and downstreamDatasources reach through other assets ("directly or
# indirectly"), so they list the tables behind a data source the flow reads and
# the outputs of flows that read its own. For the same reason nextDownstreamFlows
# rather than downstreamFlows: the latter would add an A -> C edge next to
# A -> B -> C. The fields make the answer grow with the flow's column count, so
# they are read a page at a time (a finished side asks for 0) and a page cut
# short by the node limit is a failed query. A custom SQL input
# carries its own query; TABLEAU_TABLE_QUERIES_QUERY is only for unnamed tables
# that come without one: referencedByQueries lists every query on the site that
# reads a table, which on a popular table would spend most of the node budget.
TABLEAU_FLOW_LINEAGE_QUERY = """
{{
  flows(filter: {{luid: "{flow_luid}"}}) {{
    inputFieldsConnection(first: {inputFields_first}, after: {inputFields_after}) {{
      pageInfo {{ hasNextPage endCursor }}
      nodes {{
      ... on FlowColumnInputField {{
        column {{
          table {{
            __typename
            id
            name
            ... on DatabaseTable {{
              fullName
              schema
              database {{
                name
                connectionType
              }}
            }}
            ... on CustomSQLTable {{
              query
              tables {{
                id
                name
                fullName
                schema
                database {{
                  name
                  connectionType
                }}
              }}
            }}
          }}
        }}
      }}
      ... on FlowFieldInputField {{
        field {{
          datasource {{
            id
            name
            ... on PublishedDatasource {{
              projectName
            }}
          }}
        }}
      }}
      }}
    }}
    outputSteps {{
      id
      name
    }}
    outputFieldsConnection(first: {outputFields_first}, after: {outputFields_after}) {{
      pageInfo {{ hasNextPage endCursor }}
      nodes {{
      ... on FlowColumnOutputField {{
        column {{
          table {{
            id
            name
            ... on DatabaseTable {{
              fullName
              schema
              database {{
                name
                connectionType
              }}
            }}
          }}
        }}
      }}
      ... on FlowFieldOutputField {{
        field {{
          datasource {{
            id
            name
            ... on PublishedDatasource {{
              projectName
            }}
          }}
        }}
      }}
      }}
    }}
    nextDownstreamFlows {{
      luid
      name
    }}
  }}
}}
"""

# Which of a flow's inputs feed which of its outputs, read from the lineage of
# every field its output steps write. Asked for only when a flow has several of
# each, in a query of its own whose references carry ids only.
TABLEAU_FLOW_FIELD_LINEAGE_QUERY = """
{{
  flows(filter: {{luid: "{flow_luid}"}}) {{
    outputSteps {{
      outputFields {{
        upstreamTables {{
          id
        }}
        upstreamDatasources {{
          id
        }}
        downstreamTables {{
          id
        }}
        downstreamDatasources {{
          id
        }}
      }}
    }}
  }}
}}
"""

TABLEAU_TABLE_QUERIES_QUERY = """
{{
  databaseTables(filter: {{idWithin: [{table_ids}]}}) {{
    id
    referencedByQueries {{
      query
    }}
  }}
}}
"""

TABLEAU_METADATA_API_PROBE_QUERY = """
{
  flowsConnection(first: 1) {
    nodes {
      id
    }
  }
}
"""

# Extract refreshes write the extract of a published data source, or the
# embedded extracts of a workbook. The dashboard Tableau connector names its data
# models after these Metadata API ids.
TABLEAU_PUBLISHED_DATASOURCE_ID_QUERY = """
{{
  publishedDatasources(filter: {{luid: "{luid}"}}) {{
    id
  }}
}}
"""

TABLEAU_WORKBOOK_EXTRACTS_QUERY = """
{{
  workbooks(filter: {{luid: "{luid}"}}) {{
    embeddedDatasources {{
      id
      hasExtracts
    }}
  }}
}}
"""
