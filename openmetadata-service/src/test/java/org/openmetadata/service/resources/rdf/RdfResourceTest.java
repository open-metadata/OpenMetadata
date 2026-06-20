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

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
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
  void normalizeEntityGraphExportFormatAcceptsAliases() {
    assertEquals("TURTLE", RdfRepository.normalizeEntityGraphExportFormat("ttl"));
    assertEquals("TURTLE", RdfRepository.normalizeEntityGraphExportFormat("turtle"));
    assertEquals("JSON-LD", RdfRepository.normalizeEntityGraphExportFormat("jsonld"));
    assertEquals("JSON-LD", RdfRepository.normalizeEntityGraphExportFormat("json-ld"));
  }

  @Test
  void clampGraphDepthClampsToConfiguredBounds() {
    assertEquals(1, RdfResource.clampGraphDepth(0));
    assertEquals(1, RdfResource.clampGraphDepth(1));
    assertEquals(3, RdfResource.clampGraphDepth(3));
    assertEquals(5, RdfResource.clampGraphDepth(5));
    assertEquals(5, RdfResource.clampGraphDepth(99));
  }
}
