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
SAP Hana DB queries for metadata extraction
"""

SAPHANA_LINEAGE = """
SELECT
  PACKAGE_ID,
  OBJECT_NAME,
  OBJECT_SUFFIX,
  CDATA
FROM _SYS_REPO.ACTIVE_OBJECT
WHERE OBJECT_SUFFIX IN ('analyticview', 'attributeview', 'calculationview');
"""
