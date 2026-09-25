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
GraphQL queries used to extract Tableau Prep flow lineage
via the Tableau Metadata API.
ref: https://help.tableau.com/current/api/metadata_api/en-us/reference/flow.doc.html
"""

# nextDownstreamFlows rather than downstreamFlows: the latter is transitive and
# would add an A -> C edge next to A -> B -> C.
TABLEAU_FLOW_LINEAGE_QUERY = """
{{
  flows(filter: {{luid: "{flow_luid}"}}) {{
    id
    luid
    name
    upstreamTables {{
      id
      luid
      name
      fullName
      schema
      database {{
        name
        connectionType
      }}
      referencedByQueries {{
        id
        name
        query
      }}
    }}
    upstreamDatasources {{
      id
      luid
      name
      projectName
    }}
    outputSteps {{
      id
      name
    }}
    downstreamTables {{
      id
      luid
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
      luid
      name
      projectName
    }}
    nextDownstreamFlows {{
      id
      luid
      name
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
