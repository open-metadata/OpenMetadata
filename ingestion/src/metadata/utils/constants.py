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
Define constants useful for the metadata ingestion
"""

DOT = "_DOT_"
TEN_MIN = 10 * 60
UTF_8 = "utf-8"


ES_SOURCE_TO_ES_OBJ_ARGS = {
    "caCerts": "ca_certs",
    "regionName": "region_name",
    "timeout": "timeout",
    "useAwsCredentials": "use_AWS_credentials",
    "useSSL": "use_ssl",
    "verifyCerts": "verify_certs",
}

TABLEAU_GET_WORKBOOKS_PARAM_DICT = {
    "fields": "fields=_default_,owner.email,description"
}
TABLEAU_GET_VIEWS_PARAM_DICT = {"fields": "fields=_default_,sheetType"}
