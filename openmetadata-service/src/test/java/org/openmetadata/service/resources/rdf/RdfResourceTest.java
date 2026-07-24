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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotAuthorizedException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.io.IOException;
import java.net.URI;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.api.configuration.rdf.InferenceMaterializationResult;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;
import org.openmetadata.schema.api.configuration.rdf.InferenceRuleList;
import org.openmetadata.schema.api.configuration.rdf.InferenceRuleStatus;
import org.openmetadata.schema.api.data.RdfEntityDiff;
import org.openmetadata.schema.api.rdf.RdfProjectionState;
import org.openmetadata.schema.api.rdf.RdfStatus;
import org.openmetadata.schema.configuration.SparqlQuerySettings;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.rdf.RdfEntityDiffService;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.inference.InferenceRuleService;
import org.openmetadata.service.security.Authorizer;

class RdfResourceTest {

  private Authorizer authorizer;
  private SecurityContext securityContext;
  private RdfResource rdfResource;

  @BeforeEach
  void setUp() {
    registerTableRepository();
    authorizer = Mockito.mock(Authorizer.class);
    securityContext = Mockito.mock(SecurityContext.class);
    doNothing().when(authorizer).authorizeAdmin(securityContext);
    rdfResource = new RdfResource(authorizer);
  }

  private static void registerTableRepository() {
    if (!Entity.hasEntityRepository(Entity.TABLE)) {
      Entity.registerEntity(Table.class, Entity.TABLE, Mockito.mock(TableRepository.class));
    }
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
  void rdfStatusRequiresAuthenticationButNotAdministratorPrivileges() {
    Principal principal = () -> "steward";
    when(securityContext.getUserPrincipal()).thenReturn(principal);
    rdfResource = new RdfResource(authorizer, () -> null);

    Response response = rdfResource.getRdfStatus(securityContext);
    RdfStatus status = (RdfStatus) response.getEntity();

    assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    assertEquals(URI.create("https://open-metadata.org/"), status.getBaseUri());
    assertEquals(false, status.getEnabled());
    assertEquals(RdfProjectionState.DISABLED, status.getProjectionState());
    assertEquals(false, status.getAskCollateEnabled());
    assertEquals("NONE", status.getInference().getDefaultLevel());
    verify(authorizer, never()).authorizeAdmin(securityContext);
  }

  @Test
  void entityRdfUsesEntityViewAuthorizationInsteadOfAdministratorPrivileges() throws IOException {
    RdfRepository repository = Mockito.mock(RdfRepository.class);
    UUID entityId = UUID.randomUUID();
    when(repository.isEnabled()).thenReturn(true);
    when(repository.getEntityAsJsonLd("table", entityId)).thenReturn("{}");
    rdfResource = new RdfResource(authorizer, () -> repository);

    Response response = rdfResource.getEntityAsRdf(securityContext, "table", entityId, "jsonld");

    assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    verify(authorizer).authorize(eq(securityContext), any(), any());
    verify(authorizer, never()).authorizeAdmin(securityContext);
  }

  @Test
  void entityRdfDiffUsesDatabaseHistoryWithoutRequiringRdfStorage() {
    RdfEntityDiffService diffService = Mockito.mock(RdfEntityDiffService.class);
    UUID entityId = UUID.randomUUID();
    RdfEntityDiff expected = new RdfEntityDiff().withEntityId(entityId);
    when(diffService.diff("table", entityId, 0.1, 0.2)).thenReturn(expected);
    rdfResource = new RdfResource(authorizer, () -> null, diffService);

    Response response = rdfResource.getEntityRdfDiff(securityContext, "table", entityId, 0.1, 0.2);

    assertEquals(expected, response.getEntity());
    verify(authorizer).authorize(eq(securityContext), any(), any());
    verify(authorizer, never()).authorizeAdmin(securityContext);
    verify(diffService).diff("table", entityId, 0.1, 0.2);
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

  @Test
  void inferenceRuleEndpointsUseTheSharedTypedService() {
    final InferenceRuleService service = Mockito.mock(InferenceRuleService.class);
    final InferenceRule rule = new InferenceRule().withName("custom-rule");
    final InferenceRuleStatus status = new InferenceRuleStatus().withRule(rule);
    final InferenceMaterializationResult materialization =
        new InferenceMaterializationResult().withSuccessfulRules(1);
    when(service.list()).thenReturn(List.of(status));
    when(service.upsert("custom-rule", rule)).thenReturn(status);
    when(service.materialize(true, "custom-rule")).thenReturn(materialization);
    rdfResource = new RdfResource(authorizer, () -> null, null, service);

    final InferenceRuleList listed =
        (InferenceRuleList) rdfResource.listInferenceRules(securityContext).getEntity();
    final Response saved = rdfResource.upsertInferenceRule(securityContext, "custom-rule", rule);
    final Response materialized =
        rdfResource.materializeInferenceRules(securityContext, true, "custom-rule");
    final Response deleted = rdfResource.deleteInferenceRule(securityContext, "custom-rule");

    assertEquals(List.of(status), listed.getRules());
    assertEquals(status, saved.getEntity());
    assertEquals(materialization, materialized.getEntity());
    assertEquals(Response.Status.NO_CONTENT.getStatusCode(), deleted.getStatus());
    verify(service).delete("custom-rule");
    verify(authorizer, Mockito.times(4)).authorizeAdmin(securityContext);
  }
}
