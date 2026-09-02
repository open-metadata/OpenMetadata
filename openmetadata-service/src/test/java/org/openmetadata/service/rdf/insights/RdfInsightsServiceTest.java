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

package org.openmetadata.service.rdf.insights;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.service.rdf.RdfRepository;

/**
 * Unit tests for {@link RdfInsightsService}. The service is a thin application-layer adapter: it
 * parses the request direction, delegates path finding to {@link LineagePathFinder}, and routes
 * every read-only SPARQL query through {@link RdfRepository#executeSparqlQuery} using the
 * {@code application/sparql-results+json} content type. The only injected boundary is the
 * {@link RdfRepository}, which is mocked here.
 */
class RdfInsightsServiceTest {

  private static final String SPARQL_JSON = "application/sparql-results+json";
  private static final String EMPTY_RESULTS = "{\"results\":{\"bindings\":[]}}";
  private static final String A = "https://open-metadata.org/instance/Table/a";
  private static final String B = "https://open-metadata.org/instance/Table/b";

  private static RdfRepository mockRepo(String response) {
    RdfRepository repo = mock(RdfRepository.class);
    when(repo.executeSparqlQuery(anyString(), anyString())).thenReturn(response);
    return repo;
  }

  @Test
  @DisplayName("Constructor rejects a null RdfRepository")
  void constructorRejectsNullRepository() {
    assertThrows(NullPointerException.class, () -> new RdfInsightsService(null));
  }

  @Test
  @DisplayName("findLineagePath parses direction and reflects it in the returned path")
  void findLineagePathParsesDirection() {
    RdfInsightsService service = new RdfInsightsService(mockRepo(EMPTY_RESULTS));

    LineagePathFinder.Path path = service.findLineagePath(A, B, "downstream", 6);

    assertEquals("downstream", path.direction());
    assertEquals(A, path.from());
    assertEquals(B, path.to());
    assertEquals(6, path.maxHops());
  }

  @Test
  @DisplayName("findLineagePath defaults a null direction to upstream")
  void findLineagePathDefaultsNullDirectionToUpstream() {
    RdfInsightsService service = new RdfInsightsService(mockRepo(EMPTY_RESULTS));

    LineagePathFinder.Path path = service.findLineagePath(A, B, null, 6);

    assertEquals("upstream", path.direction());
  }

  @Test
  @DisplayName("findLineagePath rejects an unparseable direction via Direction.parse")
  void findLineagePathRejectsBadDirection() {
    RdfInsightsService service = new RdfInsightsService(mockRepo(EMPTY_RESULTS));

    assertThrows(
        IllegalArgumentException.class, () -> service.findLineagePath(A, B, "sideways", 6));
  }

  @Test
  @DisplayName("findLineagePath delegates BFS to LineagePathFinder and returns a resolved path")
  void findLineagePathDelegatesToFinder() {
    RdfRepository repo = mock(RdfRepository.class);
    when(repo.executeSparqlQuery(anyString(), anyString()))
        .thenAnswer(
            inv -> {
              String sparql = inv.getArgument(0);
              if (sparql.contains("?node ?type")) {
                return EMPTY_RESULTS;
              }
              if (sparql.contains("<" + A + ">")) {
                return "{\"results\":{\"bindings\":[{\"from\":{\"value\":\""
                    + A
                    + "\"},\"to\":{\"value\":\""
                    + B
                    + "\"},\"predicate\":{\"value\":\"prov:wasDerivedFrom\"}}]}}";
              }
              return EMPTY_RESULTS;
            });

    LineagePathFinder.Path path = new RdfInsightsService(repo).findLineagePath(A, B, "upstream", 6);

    assertTrue(path.found());
    assertEquals(1, path.hops());
    assertEquals(2, path.nodes().size());
  }

  @Test
  @DisplayName("listImportantEntities delegates to executeSparqlQuery with sparql-results+json")
  void listImportantEntitiesUsesSparqlJsonContentType() {
    RdfRepository repo = mockRepo("importance-result");
    RdfInsightsService service = new RdfInsightsService(repo);

    String result = service.listImportantEntities("Table", "monthly", 10);

    assertSame("importance-result", result);
    assertContentType(repo);
  }

  @Test
  @DisplayName("listCommunities routes through executeSparqlQuery with sparql-results+json")
  void listCommunitiesUsesSparqlJsonContentType() {
    RdfRepository repo = mockRepo("communities-result");
    RdfInsightsService service = new RdfInsightsService(repo);

    String result = service.listCommunities("Table", "lineage");

    assertSame("communities-result", result);
    assertContentType(repo);
  }

  @Test
  @DisplayName("datasetRecommendations routes through executeSparqlQuery with sparql-results+json")
  void datasetRecommendationsUsesSparqlJsonContentType() {
    RdfRepository repo = mockRepo("recommendations-result");
    RdfInsightsService service = new RdfInsightsService(repo);

    String result = service.datasetRecommendations(A, 5);

    assertSame("recommendations-result", result);
    assertContentType(repo);
  }

  @Test
  @DisplayName("tagCoOccurrence routes through executeSparqlQuery with sparql-results+json")
  void tagCoOccurrenceUsesSparqlJsonContentType() {
    RdfRepository repo = mockRepo("cooccurrence-result");
    RdfInsightsService service = new RdfInsightsService(repo);

    String result = service.tagCoOccurrence(2, 10);

    assertSame("cooccurrence-result", result);
    assertContentType(repo);
  }

  @Test
  @DisplayName("glossaryReach routes through executeSparqlQuery with sparql-results+json")
  void glossaryReachUsesSparqlJsonContentType() {
    RdfRepository repo = mockRepo("reach-result");
    RdfInsightsService service = new RdfInsightsService(repo);

    String result = service.glossaryReach(3, 10);

    assertSame("reach-result", result);
    assertContentType(repo);
  }

  @Test
  @DisplayName("tagPopularity routes through executeSparqlQuery with sparql-results+json")
  void tagPopularityUsesSparqlJsonContentType() {
    RdfRepository repo = mockRepo("popularity-result");
    RdfInsightsService service = new RdfInsightsService(repo);

    String result = service.tagPopularity(10);

    assertSame("popularity-result", result);
    assertContentType(repo);
  }

  private static void assertContentType(RdfRepository repo) {
    ArgumentCaptor<String> contentType = ArgumentCaptor.forClass(String.class);
    verify(repo).executeSparqlQuery(anyString(), contentType.capture());
    assertEquals(SPARQL_JSON, contentType.getValue());
  }
}
