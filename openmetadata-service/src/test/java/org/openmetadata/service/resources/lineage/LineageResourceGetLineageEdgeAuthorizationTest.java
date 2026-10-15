/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.resources.lineage;

import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.LineageRepository;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;

/**
 * Unit coverage for the {@code VIEW_BASIC} authorization gate added to the
 * {@code getLineageEdge} (by-id) and {@code getLineageEdgeByName} (by-FQN) read endpoints in
 * {@link LineageResource}. The static {@link Entity} facade and the {@link Authorizer} are
 * stubbed; the real allow/deny filtering in the resource runs so that a missing gate would fail
 * these tests.
 */
class LineageResourceGetLineageEdgeAuthorizationTest {

  private MockedStatic<Entity> entityMock;
  private Authorizer authorizer;
  private SecurityContext securityContext;
  private LineageRepository lineageRepository;
  private LineageResource lineageResource;

  private static final String ENTITY_TYPE = "table";
  private UUID fromId;
  private UUID toId;
  private String fromFqn;
  private String toFqn;
  private EntityReference fromRef;
  private EntityReference toRef;

  @BeforeEach
  void setUp() {
    entityMock = mockStatic(Entity.class);
    authorizer = mock(Authorizer.class);
    securityContext = mock(SecurityContext.class);
    // LineageRepository has a static initializer that reads
    // Entity.getSearchRepository().getSearchClient(); stub it so the class can initialize when
    // Mockito instruments it below.
    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.getSearchClient()).thenReturn(mock(SearchClient.class));
    entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
    lineageRepository = mock(LineageRepository.class);
    entityMock.when(Entity::getLineageRepository).thenReturn(lineageRepository);

    fromId = UUID.randomUUID();
    toId = UUID.randomUUID();
    fromFqn = "db.schema.fromTable";
    toFqn = "db.schema.toTable";
    fromRef =
        new EntityReference()
            .withId(fromId)
            .withType(ENTITY_TYPE)
            .withName("fromTable")
            .withFullyQualifiedName(fromFqn);
    toRef =
        new EntityReference()
            .withId(toId)
            .withType(ENTITY_TYPE)
            .withName("toTable")
            .withFullyQualifiedName(toFqn);

    entityMock
        .when(() -> Entity.getEntityReferenceById(ENTITY_TYPE, fromId, Include.NON_DELETED))
        .thenReturn(fromRef);
    entityMock
        .when(() -> Entity.getEntityReferenceById(ENTITY_TYPE, toId, Include.NON_DELETED))
        .thenReturn(toRef);
    entityMock
        .when(() -> Entity.getEntityReferenceByName(ENTITY_TYPE, fromFqn, Include.NON_DELETED))
        .thenReturn(fromRef);
    entityMock
        .when(() -> Entity.getEntityReferenceByName(ENTITY_TYPE, toFqn, Include.NON_DELETED))
        .thenReturn(toRef);

    lineageResource = new LineageResource(authorizer);
  }

  @AfterEach
  void tearDown() {
    entityMock.close();
  }

  // ---------- helper ----------

  private CollectionDAO.EntityRelationshipObject record() {
    return CollectionDAO.EntityRelationshipObject.builder()
        .fromId(fromId.toString())
        .toId(toId.toString())
        .fromEntity(ENTITY_TYPE)
        .toEntity(ENTITY_TYPE)
        .json("{}")
        .build();
  }

  private Response okEdgeResponse() {
    Map<String, Object> responseMap = new HashMap<>();
    responseMap.put("edge", new LineageDetails().withDescription("edge"));
    return Response.status(OK).entity(responseMap).build();
  }

  /** Assert the captured OperationContext requested {@code VIEW_BASIC} (not EDIT_LINEAGE). */
  private static void assertViewBasic(OperationContext captured) {
    List<MetadataOperation> ops = captured.getOperations(null);
    assertTrue(ops.contains(MetadataOperation.VIEW_BASIC), "edge reads must authorize VIEW_BASIC");
    assertTrue(
        !ops.contains(MetadataOperation.EDIT_LINEAGE), "edge reads must NOT require EDIT_LINEAGE");
  }

  // ===================== T1: by-id (getLineageEdge) =====================

  @Test
  void t1a_denyOnFromEntity_throwsAndDaoNeverCalled() {
    when(lineageRepository.getLineageEdgeRecord(fromId, toId)).thenReturn(record());
    doThrow(new AuthorizationException("denied from"))
        .when(authorizer)
        .authorize(any(), any(), any());

    assertThrows(
        AuthorizationException.class,
        () -> lineageResource.getLineageEdge(null, securityContext, fromId, toId));

    verify(lineageRepository, never()).getLineageEdge(any(), any());
  }

  @Test
  void t1b_denyOnToEntity_throwsAndDaoNeverCalled() {
    when(lineageRepository.getLineageEdgeRecord(fromId, toId)).thenReturn(record());
    // first authorize (from) succeeds; second (to) throws
    doNothing()
        .doThrow(new AuthorizationException("denied to"))
        .when(authorizer)
        .authorize(any(), any(), any());

    assertThrows(
        AuthorizationException.class,
        () -> lineageResource.getLineageEdge(null, securityContext, fromId, toId));

    verify(lineageRepository, never()).getLineageEdge(any(), any());
  }

  @Test
  void t1c_allowBoth_returnsEdgeAndCallsDao() {
    when(lineageRepository.getLineageEdgeRecord(fromId, toId)).thenReturn(record());
    when(lineageRepository.getLineageEdge(fromId, toId)).thenReturn(okEdgeResponse());
    doNothing().when(authorizer).authorize(any(), any(), any());

    Response response = lineageResource.getLineageEdge(null, securityContext, fromId, toId);

    assertEquals(OK.getStatusCode(), response.getStatus());
    assertNotNull(response.getEntity());
    verify(lineageRepository).getLineageEdge(fromId, toId);
  }

  @Test
  void t1d_nonExistentEdge_throws404_andNeverAuthorizes() {
    when(lineageRepository.getLineageEdgeRecord(fromId, toId)).thenReturn(null);

    assertThrows(
        EntityNotFoundException.class,
        () -> lineageResource.getLineageEdge(null, securityContext, fromId, toId));

    verify(authorizer, never()).authorize(any(), any(), any());
    verify(lineageRepository, never()).getLineageEdge(any(), any());
  }

  @Test
  void t1e_authorizerReceivesViewBasic_notEditLineage() {
    when(lineageRepository.getLineageEdgeRecord(fromId, toId)).thenReturn(record());
    when(lineageRepository.getLineageEdge(fromId, toId)).thenReturn(okEdgeResponse());
    doNothing().when(authorizer).authorize(any(), any(), any());

    ArgumentCaptor<OperationContext> opCaptor = ArgumentCaptor.forClass(OperationContext.class);
    lineageResource.getLineageEdge(null, securityContext, fromId, toId);

    verify(authorizer, times(2)).authorize(any(), opCaptor.capture(), any());
    List<OperationContext> captured = opCaptor.getAllValues();
    assertEquals(2, captured.size());
    assertViewBasic(captured.get(0));
    assertViewBasic(captured.get(1));
    assertEquals(ENTITY_TYPE, captured.get(0).getResource());
    assertEquals(ENTITY_TYPE, captured.get(1).getResource());
  }

  // ===================== T2: by-FQN (getLineageEdgeByName) =====================

  @Test
  void t2a_denyOnFromEntity_throwsAndDaoNeverCalled() {
    doThrow(new AuthorizationException("denied from"))
        .when(authorizer)
        .authorize(any(), any(), any());

    assertThrows(
        AuthorizationException.class,
        () ->
            lineageResource.getLineageEdgeByName(
                null, securityContext, ENTITY_TYPE, fromFqn, ENTITY_TYPE, toFqn));

    verify(lineageRepository, never()).getLineageEdgeByFQN(any(), any(), any(), any());
  }

  @Test
  void t2b_denyOnToEntity_throwsAndDaoNeverCalled() {
    doNothing()
        .doThrow(new AuthorizationException("denied to"))
        .when(authorizer)
        .authorize(any(), any(), any());

    assertThrows(
        AuthorizationException.class,
        () ->
            lineageResource.getLineageEdgeByName(
                null, securityContext, ENTITY_TYPE, fromFqn, ENTITY_TYPE, toFqn));

    verify(lineageRepository, never()).getLineageEdgeByFQN(any(), any(), any(), any());
  }

  @Test
  void t2c_allowBoth_returnsEdgeAndCallsDao() {
    when(lineageRepository.getLineageEdgeByFQN(ENTITY_TYPE, fromFqn, ENTITY_TYPE, toFqn))
        .thenReturn(okEdgeResponse());
    doNothing().when(authorizer).authorize(any(), any(), any());

    Response response =
        lineageResource.getLineageEdgeByName(
            null, securityContext, ENTITY_TYPE, fromFqn, ENTITY_TYPE, toFqn);

    assertEquals(OK.getStatusCode(), response.getStatus());
    assertNotNull(response.getEntity());
    verify(lineageRepository).getLineageEdgeByFQN(ENTITY_TYPE, fromFqn, ENTITY_TYPE, toFqn);
  }

  @Test
  void t2d_authorizerReceivesViewBasic_notEditLineage() {
    when(lineageRepository.getLineageEdgeByFQN(ENTITY_TYPE, fromFqn, ENTITY_TYPE, toFqn))
        .thenReturn(okEdgeResponse());
    doNothing().when(authorizer).authorize(any(), any(), any());

    ArgumentCaptor<OperationContext> opCaptor = ArgumentCaptor.forClass(OperationContext.class);
    lineageResource.getLineageEdgeByName(
        null, securityContext, ENTITY_TYPE, fromFqn, ENTITY_TYPE, toFqn);

    verify(authorizer, times(2)).authorize(any(), opCaptor.capture(), any());
    List<OperationContext> captured = opCaptor.getAllValues();
    assertEquals(2, captured.size());
    assertViewBasic(captured.get(0));
    assertViewBasic(captured.get(1));
    assertEquals(ENTITY_TYPE, captured.get(0).getResource());
    assertEquals(ENTITY_TYPE, captured.get(1).getResource());
  }

  @Test
  void t2e_resolvesReferencesWithNonDeletedIncludeScope() {
    when(lineageRepository.getLineageEdgeByFQN(ENTITY_TYPE, fromFqn, ENTITY_TYPE, toFqn))
        .thenReturn(okEdgeResponse());
    doNothing().when(authorizer).authorize(any(), any(), any());

    lineageResource.getLineageEdgeByName(
        null, securityContext, ENTITY_TYPE, fromFqn, ENTITY_TYPE, toFqn);

    entityMock.verify(
        () -> Entity.getEntityReferenceByName(ENTITY_TYPE, fromFqn, Include.NON_DELETED));
    entityMock.verify(
        () -> Entity.getEntityReferenceByName(ENTITY_TYPE, toFqn, Include.NON_DELETED));
    entityMock.verify(
        () -> Entity.getEntityReferenceByName(ENTITY_TYPE, fromFqn, Include.ALL), never());
    entityMock.verify(
        () -> Entity.getEntityReferenceByName(ENTITY_TYPE, toFqn, Include.ALL), never());
  }
}
