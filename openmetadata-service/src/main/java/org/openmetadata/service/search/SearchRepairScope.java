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
package org.openmetadata.service.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Documents that a write to many documents at once (an update-by-query or delete-by-query) may
 * have left wrong, recorded so they can be rebuilt from the database later. Documents rebuilt from
 * a read at or after {@code notRewrittenSince} already reflect the change and are skipped.
 *
 * @param indexes the indexes or aliases the write targeted
 * @param query the write's query, as search-engine JSON
 */
public record SearchRepairScope(List<String> indexes, String query, long notRewrittenSince) {

  /** The retry-queue entity type of a repair row. */
  public static final String ENTITY_TYPE = "searchDocuments";

  public SearchRepairScope {
    indexes = List.copyOf(indexes);
  }

  /** The same documents, matched by the same query, coalesce into one retry row. */
  public String retryKey() {
    final String identity = String.join(",", indexes) + "|" + query;
    return UUID.nameUUIDFromBytes(identity.getBytes(StandardCharsets.UTF_8)).toString();
  }

  /** The scope's documents that no rebuild has rewritten since the scope was recorded. */
  public JsonNode staleDocumentsQuery() {
    final ObjectNode bool = JsonUtils.getObjectNode();
    bool.putArray("filter").add(JsonUtils.readTree(query));
    final ArrayNode rewritten = bool.putArray("must_not");
    rewritten
        .addObject()
        .putObject("range")
        .putObject(SearchVersionGuard.SOURCE_READ_AT)
        .put("gte", notRewrittenSince);
    return JsonUtils.getObjectNode("bool", bool);
  }

  /** The same documents, further limited by {@code filter}. */
  public SearchRepairScope narrowedBy(final JsonNode filter) {
    final ObjectNode bool = JsonUtils.getObjectNode();
    bool.putArray("filter").add(JsonUtils.readTree(query)).add(filter);
    return new SearchRepairScope(
        indexes, JsonUtils.getObjectNode("bool", bool).toString(), notRewrittenSince);
  }

  /**
   * A query for documents whose {@code fields} hold {@code value}; an id field may be mapped as a
   * keyword or as text with a keyword sub-field.
   */
  public static String anyFieldEquals(final List<String> fields, final String value) {
    return anyFieldIn(fields, List.of(value));
  }

  /** A query for documents whose {@code fields} hold any of {@code values}. */
  public static String anyFieldIn(final List<String> fields, final List<String> values) {
    final ObjectNode bool = JsonUtils.getObjectNode();
    final ArrayNode should = bool.putArray("should");
    for (final String field : fields) {
      addTerms(should, field, values);
      addTerms(should, field + ".keyword", values);
    }
    bool.put("minimum_should_match", 1);
    return JsonUtils.getObjectNode("bool", bool).toString();
  }

  private static void addTerms(
      final ArrayNode should, final String field, final List<String> values) {
    final ArrayNode terms = should.addObject().putObject("terms").putArray(field);
    values.forEach(terms::add);
  }

  public String toJson() {
    return JsonUtils.pojoToJson(this);
  }

  public static SearchRepairScope fromJson(final String json) {
    return JsonUtils.readValue(json, SearchRepairScope.class);
  }

  /** A short description for logs and the retry queue's listing. */
  public String label() {
    final String description = String.join(",", indexes) + " " + query;
    return description.length() > 512 ? description.substring(0, 512) : description;
  }
}
