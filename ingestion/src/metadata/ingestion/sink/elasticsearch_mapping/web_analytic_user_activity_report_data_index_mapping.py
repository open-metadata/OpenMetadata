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
Defines the Elasticsearch mapping for web analytic users
"""
import textwrap

WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA_INDEX_MAPPING = textwrap.dedent(
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
                        "userName": {
                            "type": "keyword"
                        },
                        "userId": {
                            "type": "text"
                        },
                        "team": {
                            "type": "keyword"
                        },
                        "totalSessions": {
                            "type": "integer"
                        },
                        "totalSessionDuration": {
                            "type": "double"
                        },
                        "totalPageView": {
                            "type": "integer"
                        },
                        "lastSession": {
                            "type": "long"
                        }
                    }
                }
            }
        }
    }
    """
)
