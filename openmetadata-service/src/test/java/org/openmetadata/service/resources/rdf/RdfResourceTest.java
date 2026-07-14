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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotAuthorizedException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.io.IOException;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.configuration.SparqlQuerySettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.jdbi3.CollectionDAO;
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
    assertThrows(
        BadRequestException.class,
        () ->
            rdfResource.exploreEntityGraph(
                securityContext, UUID.randomUUID(), "table } UNION { ?s ?p ?o", 2, null, null));
  }

  @Test
  void getFullLineageRejectsInvalidEntityType() {
    assertThrows(
        BadRequestException.class,
        () ->
            rdfResource.getFullLineage(
                securityContext, UUID.randomUUID(), "table } UNION { ?s ?p ?o", "both"));
  }

  @Test
  void exportEntityGraphRejectsUnsupportedFormat() {
    assertThrows(
        BadRequestException.class,
        () ->
            rdfResource.exportEntityGraph(
                securityContext, UUID.randomUUID(), "table", 2, null, null, "rdfxml"));
  }

  @Test
  void normalizeEntityGraphExportFormatAcceptsAliases() {
    assertEquals("TURTLE", RdfRepository.normalizeEntityGraphExportFormat("ttl"));
    assertEquals("TURTLE", RdfRepository.normalizeEntityGraphExportFormat("turtle"));
    assertEquals("JSON-LD", RdfRepository.normalizeEntityGraphExportFormat("jsonld"));
    assertEquals("JSON-LD", RdfRepository.normalizeEntityGraphExportFormat("json-ld"));
  }

  @Test
  void savedSparqlQueriesRequireAnAuthenticatedUser() {
    assertThrows(
        NotAuthorizedException.class, () -> rdfResource.listSavedSparqlQueries(securityContext));
  }

  @Test
  void settingsRowMapperReadsSparqlQuerySettings() {
    Settings settings =
        CollectionDAO.SettingsRowMapper.getSettings(
            SettingsType.SPARQL_QUERY_SETTINGS, "{\"queryTemplates\":[]}");

    assertTrue(settings.getConfigValue() instanceof SparqlQuerySettings);
  }

  @Test
  void getGlossaryTermGraphPassesGlossaryTermIdFilter() throws IOException {
    RdfRepository repository = Mockito.mock(RdfRepository.class);
    UUID glossaryId = UUID.randomUUID();
    UUID glossaryTermId = UUID.randomUUID();
    when(repository.isEnabled()).thenReturn(true);
    when(repository.getGlossaryTermGraph(glossaryId, glossaryTermId, null, 500, 0, true))
        .thenReturn("{\"nodes\":[],\"edges\":[]}");
    rdfResource = new RdfResource(authorizer, () -> repository);

    Response response =
        rdfResource.getGlossaryTermGraph(
            securityContext, glossaryId, glossaryTermId, null, 500, 0, true);

    assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    verify(repository).getGlossaryTermGraph(glossaryId, glossaryTermId, null, 500, 0, true);
  }
}
