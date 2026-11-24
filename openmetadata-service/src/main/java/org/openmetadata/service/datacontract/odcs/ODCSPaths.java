/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.datacontract.odcs;

import static java.util.Map.entry;

import java.util.Map;
import java.util.regex.Pattern;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssueCategory;

/** Locations inside an ODCS document, written the way the import report shows them. */
final class ODCSPaths {
  private static final Pattern QUALITY_RULE_PATH = Pattern.compile("(^|\\.)quality(\\[|\\.|$)");
  private static final Map<String, ODCSImportIssueCategory> CATEGORY_BY_SECTION =
      Map.ofEntries(
          entry("schema", ODCSImportIssueCategory.SCHEMA),
          entry("slaProperties", ODCSImportIssueCategory.SLA),
          entry("slaDefaultElement", ODCSImportIssueCategory.SLA),
          entry("team", ODCSImportIssueCategory.TEAM),
          entry("roles", ODCSImportIssueCategory.ROLES),
          entry("servers", ODCSImportIssueCategory.SERVERS),
          entry("support", ODCSImportIssueCategory.SUPPORT));

  private ODCSPaths() {}

  static String child(String parent, String field) {
    return parent.isEmpty() ? field : parent + "." + field;
  }

  static String element(String parent, int index) {
    return parent + "[" + index + "]";
  }

  /** Quality rules are grouped together wherever they sit, the rest by top-level section. */
  static ODCSImportIssueCategory category(String path) {
    String section = path.split("[.\\[]", 2)[0];
    return QUALITY_RULE_PATH.matcher(path).find()
        ? ODCSImportIssueCategory.QUALITY
        : CATEGORY_BY_SECTION.getOrDefault(section, ODCSImportIssueCategory.DOCUMENT);
  }
}
