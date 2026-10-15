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
package org.openmetadata.service.rdf.repair;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.OptionalLong;
import java.util.Set;
import org.junit.jupiter.api.Test;

class RdfProjectedEntitiesTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final String TABLE_PREFIX = BASE + "entity/table/";
  private static final String ORDERS = "1b6a1d0e-4c55-4a64-9a35-8d7ef4b8f2a1";
  private static final String PAYMENTS = "2c7b2e1f-5d66-4b75-8b46-9e8f05c903b2";
  private static final long UPDATED_AT = 1_791_733_748_573L;

  private final List<String> queries = new ArrayList<>();

  @Test
  void modifiedTimesReadBothFormsAProjectionWrites() {
    final RdfProjectedEntities projected =
        answering(
            """
            {"results": {"bindings": [
              {"s": {"value": "%1$s%2$s"}, "modified": {"value": "%3$d"}},
              {"s": {"value": "%1$s%2$s"}, "modified": {"value": "%4$s"}}
            ]}}
            """
                .formatted(TABLE_PREFIX, ORDERS, UPDATED_AT, Instant.ofEpochMilli(UPDATED_AT)));

    final Map<String, Set<Long>> modified =
        projected.modifiedTimes("table", List.of(ORDERS, PAYMENTS));

    assertEquals(Map.of(ORDERS, Set.of(UPDATED_AT)), modified);
    assertTrue(queries.getFirst().contains("<" + TABLE_PREFIX + ORDERS + ">"));
    assertTrue(queries.getFirst().contains("<" + TABLE_PREFIX + PAYMENTS + ">"));
  }

  @Test
  void countsEveryTypesEntityIrisInOneQuery() {
    final RdfProjectedEntities counted =
        answering(
            "{\"results\": {\"bindings\": ["
                + "{\"type\": {\"value\": \"table\"}, \"n\": {\"value\": \"42\"}},"
                + "{\"type\": {\"value\": \"topic\"}, \"n\": {\"value\": \"7\"}}]}}");

    assertEquals(Map.of("table", 42L, "topic", 7L), counted.counts());
    assertEquals(1, queries.size());
    assertTrue(queries.getFirst().contains("GROUP BY ?type"));
    assertTrue(queries.getFirst().contains("!CONTAINS(STRAFTER(?rest, \"/\"), \"/\")"));
  }

  @Test
  void listsTheIdsUnderAnIdPrefix() {
    final RdfProjectedEntities listed =
        answering(
            "{\"results\": {\"bindings\": [{\"s\": {\"value\": \""
                + TABLE_PREFIX
                + ORDERS
                + "\"}}]}}");

    assertEquals(List.of(ORDERS), listed.ids("table", "1"));
    assertTrue(queries.getFirst().contains("STRSTARTS(STR(?s), \"" + TABLE_PREFIX + "1\")"));
  }

  @Test
  void unreadableTimesCountAsNoTime() {
    assertEquals(OptionalLong.of(UPDATED_AT), RdfProjectedEntities.epochMillis("" + UPDATED_AT));
    assertEquals(
        OptionalLong.of(UPDATED_AT),
        RdfProjectedEntities.epochMillis(Instant.ofEpochMilli(UPDATED_AT).toString()));
    assertEquals(OptionalLong.empty(), RdfProjectedEntities.epochMillis("yesterday"));
    assertEquals(OptionalLong.empty(), RdfProjectedEntities.epochMillis(""));
  }

  private RdfProjectedEntities answering(final String results) {
    return new RdfProjectedEntities(
        query -> {
          queries.add(query);
          return results;
        },
        () -> BASE);
  }
}
