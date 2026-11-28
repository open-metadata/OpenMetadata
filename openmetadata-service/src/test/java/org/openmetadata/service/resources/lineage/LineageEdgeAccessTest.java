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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.lineage.LineageEdgeAccess.LineageEnd;
import org.openmetadata.service.resources.lineage.LineageEdgeAccess.ResolvedEdge;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * How a named lineage end is found and authorized. The repository and the authorizer are the
 * boundary: what matters is which copy of the end the decision sees and when a missing end stops
 * the request.
 */
class LineageEdgeAccessTest {

  private static final String FROM_FQN = "svc.db.schema.from";
  private static final String TO_FQN = "svc.db.schema.to";

  private MockedStatic<Entity> entityMock;
  private EntityRepository<Table> tables;
  private Authorizer authorizer;
  private SecurityContext securityContext;

  @BeforeEach
  @SuppressWarnings("unchecked")
  void setUp() {
    tables = mock(EntityRepository.class);
    doReturn(new Fields(Set.of())).when(tables).getFields(anyString());
    entityMock = mockStatic(Entity.class);
    entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenAnswer(call -> tables);
    authorizer = mock(Authorizer.class);
    securityContext = mock(SecurityContext.class);
  }

  @AfterEach
  void tearDown() {
    entityMock.close();
  }

  @Test
  void callerThatIsNotAnAdmin_isAuthorizedAgainstTheCopyItLoaded() {
    Table from = storedTable(FROM_FQN, false);
    Table to = storedTable(TO_FQN, false);

    ResolvedEdge edge =
        access(false)
            .resolveAndAuthorizeEdge(
                securityContext, live(FROM_FQN), live(TO_FQN), MetadataOperation.VIEW_BASIC);

    List<ResourceContextInterface> contexts = authorizedContexts(2);
    assertSame(from, contexts.get(0).getResolvedEntity());
    assertSame(to, contexts.get(1).getResolvedEntity());
    assertEquals(from.getId(), edge.from().getId());
    assertEquals(Entity.TABLE, edge.from().getType());
    assertEquals(to.getId(), edge.to().getId());
    verify(tables, never()).getReferenceByName(anyString(), any());
    verify(tables, never())
        .getByName(any(), anyString(), any(), any(RelationIncludes.class), eq(true));
  }

  @Test
  void softDeletedEnd_isNotFoundForALiveRoute_beforeAnyCheck() {
    storedTable(FROM_FQN, false);
    storedTable(TO_FQN, true);
    LineageEdgeAccess access = access(false);

    assertThrows(
        EntityNotFoundException.class,
        () ->
            access.resolveAndAuthorizeEdge(
                securityContext, live(FROM_FQN), live(TO_FQN), MetadataOperation.EDIT_LINEAGE));
    verify(authorizer, never()).authorize(any(), any(), any());
  }

  @Test
  void softDeletedEnd_isAuthorizedForARouteThatIncludesIt() {
    Table deleted = storedTable(TO_FQN, true);

    EntityReference end =
        access(false)
            .resolveAndAuthorize(
                securityContext,
                new LineageEnd(Entity.TABLE, TO_FQN, Include.ALL),
                MetadataOperation.EDIT_LINEAGE);

    assertEquals(deleted.getId(), end.getId());
    assertSame(deleted, authorizedContexts(1).getFirst().getResolvedEntity());
  }

  @Test
  void admin_isResolvedAsAReference_andAuthorizedLazily() {
    EntityReference from = reference(FROM_FQN);
    EntityReference to = reference(TO_FQN);
    doReturn(from).when(tables).getReferenceByName(FROM_FQN, Include.NON_DELETED);
    doReturn(to).when(tables).getReferenceByName(TO_FQN, Include.NON_DELETED);

    ResolvedEdge edge =
        access(true)
            .resolveAndAuthorizeEdge(
                securityContext, live(FROM_FQN), live(TO_FQN), MetadataOperation.VIEW_BASIC);

    assertSame(from, edge.from());
    assertSame(to, edge.to());
    List<ResourceContextInterface> contexts = authorizedContexts(2);
    assertNull(contexts.get(0).getResolvedEntity());
    assertEquals(Entity.TABLE, contexts.get(0).getResource());
    verify(tables, never())
        .getByName(any(), anyString(), any(), any(RelationIncludes.class), anyBoolean());
  }

  @Test
  void missingTo_isNotFound_evenWhenFromWouldBeDenied() {
    storedTable(FROM_FQN, false);
    doThrow(new EntityNotFoundException("table instance for " + TO_FQN + " not found"))
        .when(tables)
        .getByName(isNull(), eq(TO_FQN), any(), any(RelationIncludes.class), eq(false));
    doThrow(new AuthorizationException("denied")).when(authorizer).authorize(any(), any(), any());
    LineageEdgeAccess access = access(false);

    assertThrows(
        EntityNotFoundException.class,
        () ->
            access.resolveAndAuthorizeEdge(
                securityContext, live(FROM_FQN), live(TO_FQN), MetadataOperation.EDIT_LINEAGE));
    verify(authorizer, never()).authorize(any(), any(), any());
  }

  @Test
  void denialOnEitherEnd_propagates() {
    storedTable(FROM_FQN, false);
    storedTable(TO_FQN, false);
    doThrow(new AuthorizationException("denied")).when(authorizer).authorize(any(), any(), any());
    LineageEdgeAccess access = access(false);

    assertThrows(
        AuthorizationException.class,
        () ->
            access.resolveAndAuthorizeEdge(
                securityContext, live(FROM_FQN), live(TO_FQN), MetadataOperation.VIEW_BASIC));
    assertThrows(
        AuthorizationException.class,
        () ->
            access.resolveAndAuthorize(
                securityContext, live(TO_FQN), MetadataOperation.EDIT_LINEAGE));
  }

  @Test
  void authorizerIsAskedForTheRoutesOperationOnTheEndsType() {
    storedTable(FROM_FQN, false);

    access(false)
        .resolveAndAuthorize(securityContext, live(FROM_FQN), MetadataOperation.EDIT_LINEAGE);

    ArgumentCaptor<OperationContext> operations = ArgumentCaptor.forClass(OperationContext.class);
    verify(authorizer).authorize(eq(securityContext), operations.capture(), any());
    assertEquals(Entity.TABLE, operations.getValue().getResource());
    assertEquals(
        List.of(MetadataOperation.EDIT_LINEAGE), operations.getValue().getOperations(null));
  }

  private LineageEdgeAccess access(boolean admin) {
    return new LineageEdgeAccess(authorizer, ignored -> admin, Entity::getEntityRepository);
  }

  private static LineageEnd live(String fqn) {
    return new LineageEnd(Entity.TABLE, fqn, Include.NON_DELETED);
  }

  /** Stubs the one read made for a caller that is not an admin: from the database, not the cache. */
  private Table storedTable(String fqn, boolean deleted) {
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName(fqn.substring(fqn.lastIndexOf('.') + 1))
            .withFullyQualifiedName(fqn)
            .withDeleted(deleted);
    doReturn(table)
        .when(tables)
        .getByName(
            isNull(),
            eq(fqn),
            any(),
            argThat(LineageEdgeAccessTest::loadsDeletedRelations),
            eq(false));
    return table;
  }

  /** The lazy authorization context loads relations with Include.ALL; the copy must match it. */
  private static boolean loadsDeletedRelations(RelationIncludes includes) {
    return includes != null && includes.getDefaultInclude() == Include.ALL;
  }

  private static EntityReference reference(String fqn) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(Entity.TABLE)
        .withFullyQualifiedName(fqn)
        .withName(fqn.substring(fqn.lastIndexOf('.') + 1));
  }

  private List<ResourceContextInterface> authorizedContexts(int expected) {
    ArgumentCaptor<ResourceContextInterface> contexts =
        ArgumentCaptor.forClass(ResourceContextInterface.class);
    verify(authorizer, times(expected)).authorize(eq(securityContext), any(), contexts.capture());
    return contexts.getAllValues();
  }
}
