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

package org.openmetadata.mcp;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import io.modelcontextprotocol.spec.McpSchema;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.rdf.RdfRepository;

/**
 * The knowledge-graph tools must only be advertised where they can actually run.
 *
 * <p>{@code rdf.enabled} defaults to false, so before gating a stock deployment listed four tools
 * that failed on every call - contradicting the rule stated on {@code buildServerCapabilities}, that
 * clients trust what we advertise. {@code ontology_describe} is the deliberate exception: it serves
 * the bundled ontology off the classpath and works with RDF switched off.
 */
class RdfToolGatingTest {

  private static final Set<String> RDF_DEPENDENT =
      Set.of("sparql_query", "entity_neighborhood", "find_by_tag", "shacl_validate");

  @Test
  void rdfToolsAreWithheldWhenRdfIsDisabled() {
    try (MockedStatic<RdfRepository> repositories = mockStatic(RdfRepository.class)) {
      repositories.when(RdfRepository::getInstanceOrNull).thenReturn(null);

      List<String> names = toolNames();

      assertTrue(names.contains("search_metadata"), "non-RDF tools must still be advertised");
      assertTrue(
          names.contains("ontology_describe"),
          "ontology_describe serves the bundled ontology and works without a triplestore");
      RDF_DEPENDENT.forEach(
          tool -> assertFalse(names.contains(tool), tool + " cannot run without RDF"));
    }
  }

  @Test
  void rdfToolsAreAdvertisedWhenRdfIsEnabled() {
    RdfRepository repository = mock(RdfRepository.class);
    when(repository.isEnabled()).thenReturn(true);
    try (MockedStatic<RdfRepository> repositories = mockStatic(RdfRepository.class)) {
      repositories.when(RdfRepository::getInstanceOrNull).thenReturn(repository);

      List<String> names = toolNames();

      RDF_DEPENDENT.forEach(
          tool -> assertTrue(names.contains(tool), tool + " must be advertised when RDF is on"));
    }
  }

  /** A repository that exists but is switched off must be treated the same as no repository. */
  @Test
  void aPresentButDisabledRepositoryStillWithholdsTheTools() {
    RdfRepository repository = mock(RdfRepository.class);
    when(repository.isEnabled()).thenReturn(false);
    try (MockedStatic<RdfRepository> repositories = mockStatic(RdfRepository.class)) {
      repositories.when(RdfRepository::getInstanceOrNull).thenReturn(repository);

      List<String> names = toolNames();

      assertEquals(
          List.of(),
          names.stream().filter(RDF_DEPENDENT::contains).toList(),
          "a disabled repository must withhold the graph tools");
    }
  }

  private static List<String> toolNames() {
    return new McpServer().getTools().stream().map(McpSchema.Tool::name).toList();
  }
}
