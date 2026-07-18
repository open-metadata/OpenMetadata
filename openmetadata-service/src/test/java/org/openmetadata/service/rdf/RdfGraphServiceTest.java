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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RdfGraphServiceTest {

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
    assertTrue(query.contains("(prov:wasDerivedFrom|^om:UPSTREAM)+"));
    assertTrue(query.contains("(om:UPSTREAM|^prov:wasDerivedFrom)+"));
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
  }

  private static RdfGraphService service(RdfRepository repository) {
    return new RdfGraphService(repository, "table"::equals);
  }
}
