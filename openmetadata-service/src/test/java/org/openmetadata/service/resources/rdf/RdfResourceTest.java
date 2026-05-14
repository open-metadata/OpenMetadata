/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.resources.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.lang.reflect.Field;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.security.Authorizer;

class RdfResourceTest {

  private Authorizer authorizer;
  private SecurityContext securityContext;
  private RdfResource rdfResource;

  @BeforeEach
  void setUp() {
    authorizer = Mockito.mock(Authorizer.class);
    securityContext = Mockito.mock(SecurityContext.class);
    doNothing().when(authorizer).authorizeAdmin(securityContext);
    rdfResource = new RdfResource(authorizer);
  }

  private void setRdfRepository(RdfRepository repository) throws Exception {
    Field field = RdfResource.class.getDeclaredField("rdfRepository");
    field.setAccessible(true);
    field.set(rdfResource, repository);
  }

  @Test
  void exploreEntityGraphRejectsInvalidEntityType() {
    Response response =
        rdfResource.exploreEntityGraph(
            securityContext, UUID.randomUUID(), "table } UNION { ?s ?p ?o", 2, null, null);

    assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), response.getStatus());
    assertTrue(String.valueOf(response.getEntity()).contains("Invalid entity type"));
  }

  @Test
  void getFullLineageRejectsInvalidEntityType() {
    Response response =
        rdfResource.getFullLineage(
            securityContext, UUID.randomUUID(), "table } UNION { ?s ?p ?o", "both");

    assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), response.getStatus());
    assertTrue(String.valueOf(response.getEntity()).contains("Invalid entity type"));
  }

  @Test
  void exportEntityGraphRejectsUnsupportedFormat() {
    Response response =
        rdfResource.exportEntityGraph(
            securityContext, UUID.randomUUID(), "table", 2, null, null, "rdfxml");

    assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), response.getStatus());
  }

  @Test
  void exploreEntityGraphClampsDepthToMaximum() throws Exception {
    RdfRepository repository = Mockito.mock(RdfRepository.class);
    UUID entityId = UUID.randomUUID();
    when(repository.isEnabled()).thenReturn(true);
    when(repository.getEntityGraph(entityId, "table", 5, Set.of(), Set.of())).thenReturn("{}");
    setRdfRepository(repository);

    Response response;
    try (MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.hasEntityRepository("table")).thenReturn(true);
      response = rdfResource.exploreEntityGraph(securityContext, entityId, "table", 99, null, null);
    }

    assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    verify(repository).getEntityGraph(eq(entityId), eq("table"), eq(5), eq(Set.of()), eq(Set.of()));
  }

  @Test
  void exportEntityGraphClampsDepthToMaximum() throws Exception {
    RdfRepository repository = Mockito.mock(RdfRepository.class);
    UUID entityId = UUID.randomUUID();
    when(repository.isEnabled()).thenReturn(true);
    when(repository.exportEntityGraph(entityId, "table", 5, Set.of(), Set.of(), "TURTLE"))
        .thenReturn("@prefix ex: <https://example.org/> .");
    setRdfRepository(repository);

    Response response;
    try (MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.hasEntityRepository("table")).thenReturn(true);
      response =
          rdfResource.exportEntityGraph(
              securityContext, entityId, "table", 99, null, null, "turtle");
    }

    assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    verify(repository)
        .exportEntityGraph(
            eq(entityId), eq("table"), eq(5), eq(Set.of()), eq(Set.of()), eq("TURTLE"));
  }

  @Test
  void normalizeEntityGraphExportFormatAcceptsAliases() {
    assertEquals("TURTLE", RdfRepository.normalizeEntityGraphExportFormat("ttl"));
    assertEquals("TURTLE", RdfRepository.normalizeEntityGraphExportFormat("turtle"));
    assertEquals("JSON-LD", RdfRepository.normalizeEntityGraphExportFormat("jsonld"));
    assertEquals("JSON-LD", RdfRepository.normalizeEntityGraphExportFormat("json-ld"));
  }
}
