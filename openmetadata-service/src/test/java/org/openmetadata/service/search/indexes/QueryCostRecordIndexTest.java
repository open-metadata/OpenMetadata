/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;

class QueryCostRecordIndexTest {
  @Test
  void everyLanguageMapsTheFieldsUsedBySearchAuthorization() throws Exception {
    for (String language : List.of("en", "jp", "ko", "ru", "zh")) {
      try (InputStream source =
          getClass()
              .getResourceAsStream(
                  "/elasticsearch/" + language + "/query_cost_record_index_mapping.json")) {
        JsonNode fields = new ObjectMapper().readTree(source).path("mappings").path("properties");
        assertEquals("nested", fields.path("owners").path("type").asText(), language);
        assertEquals(
            "keyword",
            fields.path("owners").path("properties").path("id").path("type").asText(),
            language);
        assertEquals(
            "keyword",
            fields.path("domains").path("properties").path("id").path("type").asText(),
            language);
        assertEquals(
            "keyword",
            fields.path("tier").path("properties").path("tagFQN").path("type").asText(),
            language);
      }
    }
  }

  @Test
  void costRecordsInheritDedicatedTierAndOtherAccessFields() {
    TagLabel tier = new TagLabel().withTagFQN("Tier.Tier1");
    TagLabel tag = new TagLabel().withTagFQN("PII.Sensitive");
    Query query =
        new Query()
            .withTags(List.of(tier, tag))
            .withOwners(List.of(new EntityReference().withId(UUID.randomUUID()).withType("user")))
            .withDomains(
                List.of(new EntityReference().withId(UUID.randomUUID()).withType("domain")));
    Map<String, Object> doc = new HashMap<>();
    QueryCostRecordIndex.putAccessFields(doc, query);
    assertEquals(tier, doc.get("tier"));
    assertEquals(List.of(tag), doc.get("tags"));
    assertEquals(query.getOwners(), doc.get("owners"));
    assertEquals(query.getDomains(), doc.get("domains"));
  }

  @Test
  void anUntaggedQueryCanStillBeIndexed() {
    Map<String, Object> doc = new HashMap<>();
    QueryCostRecordIndex.putAccessFields(doc, new Query().withTags(null));
    assertEquals(List.of(), doc.get("tags"));
    assertTrue(doc.containsKey("tier"));
  }
}
