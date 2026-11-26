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

package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.net.URI;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

class RdfGraphServiceTest {

  private static final UUID EXPLORE_ROOT = UUID.fromString("11111111-1111-1111-1111-111111111111");
  private static final String BASE_URI = "https://open-metadata.org/";
  private static final String TABLE_IRI = BASE_URI + "entity/table/" + EXPLORE_ROOT;
  private static final String TOPIC_IRI =
      BASE_URI + "entity/topic/22222222-2222-2222-2222-222222222222";
  private static final String SPARQL_JSON = "application/sparql-results+json";

  @Test
  void explorePreservesExactGraphJson() throws IOException {
    final RdfStorageInterface storage = mock(RdfStorageInterface.class);
    when(storage.executeSparqlQuery(anyString(), eq(SPARQL_JSON))).thenReturn(exploreBindings());
    final RdfRepository repository =
        new RdfRepository(
            new RdfConfiguration().withEnabled(true).withBaseUri(URI.create(BASE_URI)),
            storage,
            null);
    final var request = RdfGraphService.GraphRequest.from(EXPLORE_ROOT, "table", 1, null, null);
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities.when(() -> Entity.hasEntityRepository("table")).thenReturn(true);
      entities
          .when(() -> Entity.getEntities(anyList(), eq(""), eq(Include.ALL)))
          .thenAnswer(invocation -> exploreEntities(invocation.getArgument(0)));
      assertEquals(expectedExploreJson(), service(repository).explore(request));
    }
  }

  @Test
  void exploreGroupDoesNotDependOnTheServerLocale() throws IOException {
    final String searchIndexIri =
        BASE_URI + "entity/searchIndex/33333333-3333-3333-3333-333333333333";
    final RdfStorageInterface storage = mock(RdfStorageInterface.class);
    when(storage.executeSparqlQuery(anyString(), eq(SPARQL_JSON)))
        .thenReturn(exploreBindings().replace(TOPIC_IRI, searchIndexIri));
    final RdfRepository repository =
        new RdfRepository(
            new RdfConfiguration().withEnabled(true).withBaseUri(URI.create(BASE_URI)),
            storage,
            null);
    final var request = RdfGraphService.GraphRequest.from(EXPLORE_ROOT, "table", 1, null, null);
    final Locale original = Locale.getDefault();
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      Locale.setDefault(Locale.forLanguageTag("tr-TR"));
      entities.when(() -> Entity.hasEntityRepository("table")).thenReturn(true);
      entities
          .when(() -> Entity.getEntities(anyList(), eq(""), eq(Include.ALL)))
          .thenAnswer(invocation -> exploreEntities(invocation.getArgument(0)));
      final String graph = service(repository).explore(request);
      assertTrue(graph.contains("\"group\":\"searchindex\""), graph);
    } finally {
      Locale.setDefault(original);
    }
  }

  private static List<Table> exploreEntities(final List<EntityReference> refs) {
    return EXPLORE_ROOT.equals(refs.getFirst().getId())
        ? List.of(
            new Table()
                .withId(EXPLORE_ROOT)
                .withName("orders")
                .withDisplayName("Orders")
                .withDescription("Order records")
                .withTags(
                    List.of(
                        new TagLabel()
                            .withTagFQN("PII.Sensitive")
                            .withLabelType(TagLabel.LabelType.MANUAL))))
        : List.of();
  }

  private static String exploreBindings() {
    return """
        {"results":{"bindings":[{
          "subject":{"type":"uri","value":"%s"},
          "predicate":{"type":"uri","value":"https://open-metadata.org/ontology/downstream"},
          "object":{"type":"uri","value":"%s"}
        }]}}
        """
        .formatted(TABLE_IRI, TOPIC_IRI);
  }

  private static String expectedExploreJson() {
    final String fixture =
        """
        {
          "nodes":[
            {"id":"%s","entityId":"%s","type":"table","group":"table","label":"Orders",
             "name":"orders","description":"Order records",
             "tags":[{"tagFQN":"PII.Sensitive","name":"Manual.PII.Sensitive"}]},
            {"id":"%s","entityId":"22222222-2222-2222-2222-222222222222","type":"topic",
             "group":"topic","label":"topic: 22222222-2222-2222-2222-222222222222"}
          ],
          "edges":[{"from":"%s","to":"%s","label":"Downstream","relationType":"downstream","arrows":"to"}],
          "totalNodes":2,"totalEdges":1,"truncated":false,"source":"rdf",
          "filterOptions":{
            "entityTypes":[{"id":"table","label":"Table","count":1},{"id":"topic","label":"Topic","count":1}],
            "relationshipTypes":[{"id":"upstream","label":"Upstream","count":1}]
          }
        }
        """
            .formatted(TABLE_IRI, EXPLORE_ROOT, TOPIC_IRI, TABLE_IRI, TOPIC_IRI);
    // The absent FQN used to be serialized as an explicit null.
    return JsonUtils.pojoToJson(JsonUtils.readTree(fixture));
  }

  @Test
  void graphRequestSupportsRootOnlyTraversal() {
    final RdfGraphService.GraphRequest request =
        RdfGraphService.GraphRequest.from(UUID.randomUUID(), "table", 0, null, null);

    assertEquals(0, request.depth());
  }

  @Test
  void graphRequestNormalizesTypeDepthAndFilters() {
    RdfGraphService.GraphRequest request =
        RdfGraphService.GraphRequest.from(
            UUID.randomUUID(), " table ", 99, "table, dashboard,table", "owns, contains");

    assertEquals("table", request.entityType());
    assertEquals(5, request.depth());
    assertEquals(Set.of("table", "dashboard"), request.entityTypes());
    assertEquals(Set.of("owns", "contains"), request.relationshipTypes());
  }

  @Test
  void graphRequestRejectsMalformedEntityTypes() {
    UUID entityId = UUID.randomUUID();

    assertThrows(
        IllegalArgumentException.class,
        () ->
            RdfGraphService.GraphRequest.from(entityId, "table } UNION { ?s ?p ?o", 2, null, null));
  }

  @Test
  void serviceRejectsSyntacticallyValidUnknownEntityTypes() {
    RdfGraphService service = service(mock(RdfRepository.class));
    RdfGraphService.GraphRequest request =
        RdfGraphService.GraphRequest.from(UUID.randomUUID(), "dashboard", 2, null, null);

    assertThrows(IllegalArgumentException.class, () -> service.explore(request));
  }

  @Test
  void entityRepresentationUsesTypedFormatMetadata() throws IOException {
    RdfRepository repository = mock(RdfRepository.class);
    UUID entityId = UUID.randomUUID();
    when(repository.getEntityAsRdf("table", entityId, "turtle")).thenReturn("<urn:a> <urn:b> 1 .");

    RdfGraphService.Representation representation =
        service(repository).entity("table", entityId, "ttl");

    assertEquals("<urn:a> <urn:b> 1 .", representation.body());
    assertEquals("text/turtle", representation.mediaType());
  }

  @Test
  void lineageQueryUsesValidatedEntityComponents() {
    UUID entityId = UUID.randomUUID();

    String query =
        RdfGraphService.buildLineageQuery(
            entityId,
            "table",
            RdfGraphService.LineageDirection.BOTH,
            "https://metadata.example/api");

    assertTrue(query.contains("<https://metadata.example/api/entity/table/" + entityId + ">"));
    assertTrue(query.contains("(om:upstream|^om:downstream|prov:wasDerivedFrom|^om:UPSTREAM)+"));
    assertTrue(query.contains("(om:downstream|^om:upstream|^prov:wasDerivedFrom|om:UPSTREAM)+"));
  }

  @Test
  void graphExportCarriesRepositoryAndWireFormatsSeparately() throws IOException {
    RdfRepository repository = mock(RdfRepository.class);
    UUID entityId = UUID.randomUUID();
    RdfGraphService.GraphRequest graph =
        RdfGraphService.GraphRequest.from(entityId, "table", 2, null, null);
    when(repository.exportEntityGraph(entityId, "table", 2, Set.of(), Set.of(), "JSON-LD"))
        .thenReturn("{}");

    RdfGraphService.Representation representation =
        service(repository).export(new RdfGraphService.GraphExportRequest(graph, "json-ld"));

    assertEquals("{}", representation.body());
    assertEquals("application/ld+json", representation.mediaType());
    verify(repository).exportEntityGraph(entityId, "table", 2, Set.of(), Set.of(), "JSON-LD");
  }

  @Test
  void serializationAliasesUseTheRequestedDefault() {
    assertEquals(
        RdfSerializationFormat.JSON_LD,
        RdfSerializationFormat.parseOrDefault(null, RdfSerializationFormat.JSON_LD));
    assertEquals(RdfSerializationFormat.RDF_XML, RdfSerializationFormat.parse("xml"));
    assertEquals(RdfSerializationFormat.N_TRIPLES, RdfSerializationFormat.parse("nt"));
    assertThrows(IllegalArgumentException.class, () -> RdfSerializationFormat.parse("unsupported"));
  }

  @Test
  void fullLineageAnswersFromPropertyPathsWithoutInference() {
    final RdfRepository repository = mock(RdfRepository.class);
    final String lineage = "{\"head\":{},\"results\":{\"bindings\":[]}}";
    when(repository.getBaseUri()).thenReturn("https://open-metadata.org/");
    when(repository.executeAssertedSparqlQuery(anyString(), eq("application/sparql-results+json")))
        .thenReturn(lineage);

    final String body =
        service(repository)
            .fullLineage(
                new RdfGraphService.LineageRequest(
                    UUID.randomUUID(), "table", RdfGraphService.LineageDirection.BOTH));

    assertEquals(lineage, body);
  }

  private static RdfGraphService service(RdfRepository repository) {
    return new RdfGraphService(repository, "table"::equals);
  }
}
