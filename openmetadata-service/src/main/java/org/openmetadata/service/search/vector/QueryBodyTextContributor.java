/*
 *  Copyright 2025 Collate
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
package org.openmetadata.service.search.vector;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.vector.VectorDocBuilder.BodyTextExtractor;

/**
 * Body text contributor for {@link Query}. A query is retrieved by matching a natural-language
 * question against it, so the intent text — displayName and description — leads the body and the
 * SQL follows as supporting signal (its table and column identifiers are what a question about a
 * specific asset lands on).
 *
 * <p>Without this contributor the default extractor emits description alone, and
 * {@code QueryRepository.prepare} names an unnamed query after the MD5 of its SQL — so an
 * ingested query with no description embeds as little more than a hex string.
 *
 * <p>The SQL is capped: a several-thousand-character statement would otherwise dominate the pooled
 * vector and push the intent text out of the first chunk.
 */
public final class QueryBodyTextContributor implements VectorBodyTextContributor {

  public static final QueryBodyTextContributor INSTANCE = new QueryBodyTextContributor();

  static final int MAX_SQL_CHARS = 2000;

  private QueryBodyTextContributor() {}

  @Override
  public String entityType() {
    return Entity.QUERY;
  }

  @Override
  public BodyTextExtractor extractor() {
    return QueryBodyTextContributor::extractBodyText;
  }

  static String extractBodyText(EntityInterface entity) {
    if (!(entity instanceof Query query)) {
      return null;
    }
    List<String> parts = new ArrayList<>();
    appendIfPresent(parts, "displayName", query.getDisplayName());
    appendIfPresent(parts, "description", query.getDescription());
    appendIfPresent(parts, "sql", cap(query.getQuery()));
    appendRefs(parts, "usedIn", query.getQueryUsedIn());
    return parts.isEmpty() ? "" : String.join("; ", parts);
  }

  /**
   * {@code queryUsedIn} is stripped from the stored JSON and only repopulated when a caller asks
   * for the field, so it is absent on some write paths. Absent means "omit", never "no tables".
   */
  private static void appendRefs(List<String> parts, String label, List<EntityReference> refs) {
    if (refs == null || refs.isEmpty()) {
      return;
    }
    List<String> names = new ArrayList<>();
    for (EntityReference ref : refs) {
      String value =
          ref.getFullyQualifiedName() != null ? ref.getFullyQualifiedName() : ref.getName();
      if (value != null && !value.isBlank()) {
        names.add(value.strip());
      }
    }
    if (!names.isEmpty()) {
      parts.add(label + ": " + String.join(", ", names));
    }
  }

  private static String cap(String sql) {
    if (sql == null || sql.length() <= MAX_SQL_CHARS) {
      return sql;
    }
    return sql.substring(0, MAX_SQL_CHARS) + "...";
  }

  private static void appendIfPresent(List<String> parts, String label, String value) {
    if (value == null || value.isBlank()) {
      return;
    }
    parts.add(label + ": " + value.strip());
  }
}
