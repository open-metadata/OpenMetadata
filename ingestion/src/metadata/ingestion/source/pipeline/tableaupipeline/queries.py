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

# nextDownstreamFlows rather than downstreamFlows: the latter is transitive and
# would add an A -> C edge next to A -> B -> C. Custom SQL is fetched separately
# (TABLEAU_TABLE_QUERIES_QUERY) and only for unnamed tables: referencedByQueries
# lists every query on the site that reads a table, which on a popular table
# would spend most of the query's node budget.
TABLEAU_FLOW_LINEAGE_QUERY = """
{{
  flows(filter: {{luid: "{flow_luid}"}}) {{
    upstreamTables {{
      id
      name
      fullName
      schema
      database {{
        name
        connectionType
      }}
    }}
    upstreamDatasources {{
      id
      name
      projectName
    }}
    outputSteps {{
      id
      name
    }}
    downstreamTables {{
      id
      name
      fullName
      schema
      database {{
        name
        connectionType
      }}
    }}
    downstreamDatasources {{
      id
      name
      projectName
    }}
    nextDownstreamFlows {{
      luid
      name
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
