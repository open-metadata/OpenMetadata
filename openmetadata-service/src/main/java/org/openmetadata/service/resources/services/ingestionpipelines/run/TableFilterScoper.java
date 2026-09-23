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

package org.openmetadata.service.resources.services.ingestionpipelines.run;

import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.metadataIngestion.FilterPattern;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Narrows a database service run - profiler, auto classification, and the base of a metadata run -
 * to one table, through the database, schema and table filter patterns every such pipeline shares.
 */
public class TableFilterScoper implements SourceConfigScoper {

  // Escaped by hand rather than Pattern.quote: the patterns are matched by the Python ingestion,
  // which has no \Q...\E quoting.
  private static final Pattern REGEX_METACHARACTER = Pattern.compile("[\\\\.^$|?*+()\\[\\]{}]");

  @Override
  public Map<String, Object> sourceConfigOverride(EntityInterface target) {
    Table table = (Table) target;
    // Matching on FQNs rather than names keeps a table apart from a same-named one in another
    // schema; views are included so a view can be scoped too, the patterns still match only it.
    return Map.of(
        "useFqnForFiltering", true,
        "databaseFilterPattern", onlyMatching(table.getDatabase().getFullyQualifiedName()),
        "schemaFilterPattern", onlyMatching(table.getDatabaseSchema().getFullyQualifiedName()),
        "tableFilterPattern", onlyMatching(table.getFullyQualifiedName()),
        "includeViews", true);
  }

  static Map<String, Object> onlyMatching(String fullyQualifiedName) {
    return JsonUtils.getMap(
        new FilterPattern().withIncludes(List.of("^" + escapeRegex(fullyQualifiedName) + "$")));
  }

  static String escapeRegex(String text) {
    return REGEX_METACHARACTER
        .matcher(text)
        .replaceAll(match -> Matcher.quoteReplacement("\\" + match.group()));
  }
}
