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
package org.openmetadata.it.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import org.awaitility.Awaitility;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Counts triples in the knowledge graph and waits for live writes: the projection is applied after
 * the metadata commit.
 */
public final class RdfGraphAssertions {
  public static final String BASE_URI = "https://open-metadata.org/";
  public static final String OM = BASE_URI + "ontology/";
  private static final String KNOWLEDGE_GRAPH = BASE_URI + "graph/knowledge";
  private static final Duration PROJECTION_WAIT = Duration.ofSeconds(90);

  private RdfGraphAssertions() {}

  public static String iri(final String entityType, final EntityInterface<?> entity) {
    return "<" + BASE_URI + "entity/" + entityType + "/" + entity.getId() + ">";
  }

  public static String om(final String localName) {
    return "<" + OM + localName + ">";
  }

  /** Waits until {@code pattern} matches exactly {@code expected} solutions in the graph. */
  public static void awaitCount(final String pattern, final long expected) {
    Awaitility.await(pattern)
        .atMost(PROJECTION_WAIT)
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(() -> assertEquals(expected, count(pattern), pattern));
  }

  public static void awaitPresent(final String pattern) {
    Awaitility.await(pattern)
        .atMost(PROJECTION_WAIT)
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(() -> assertTrue(count(pattern) > 0, pattern));
  }

  /** Waits until no triple has {@code resourceIri} as its subject or object. */
  public static void awaitAbsent(final String resourceIri) {
    awaitCount(mentions(resourceIri), 0);
  }

  public static String mentions(final String resourceIri) {
    return "{ " + resourceIri + " ?p ?o } UNION { ?s ?p " + resourceIri + " }";
  }

  /**
   * Reads the store directly rather than through the SPARQL API, whose per-principal concurrency
   * limit rejects the polls of tests running in parallel.
   */
  public static long count(final String pattern) {
    final String query =
        "SELECT (COUNT(*) AS ?count) WHERE { GRAPH <" + KNOWLEDGE_GRAPH + "> { " + pattern + " } }";
    final String response = RdfTestUtils.executeSparqlSelect(query);
    assertNotNull(response, "SPARQL count failed: " + query);
    final JsonNode bindings = JsonUtils.readTree(response).path("results").path("bindings");
    assertTrue(bindings.isArray() && !bindings.isEmpty(), "SPARQL count result is missing");
    return bindings.get(0).path("count").path("value").asLong();
  }
}
