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
Defines the Elasticsearch mapping for web analytic entity views
"""
import textwrap

WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA_INDEX_MAPPING = textwrap.dedent(
    """
    {
        "mappings": {
            "properties": {
                "timestamp": {
                    "type": "date"
                },
                "reportDataType": {
                    "type": "keyword"
                },
                "data": {
                    "properties": {
                        "entityType": {
                            "type": "keyword"
                        },
                        "entityTier": {
                            "type": "keyword"
                        },
                        "entityFqn": {
                            "type": "keyword"
                        },
                        "owner": {
                            "type": "keyword"
                        },
                        "ownerId": {
                            "type": "text"
                        },
                        "views": {
                            "type": "integer"
                        }
                    }
                }
            }
        }
    }
    """
)
