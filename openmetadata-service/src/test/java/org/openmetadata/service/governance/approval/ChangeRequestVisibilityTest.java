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

package org.openmetadata.service.governance.approval;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.SecurityContext;
import java.security.Principal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.GovernanceDAOs.ChangeRequestDAO;
import org.openmetadata.service.jdbi3.GovernanceDAOs.ChangeRevisionDAO;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * Unit tests for the change request list visibility rules, focused on the status-filtering and
 * over-fetch behavior that keeps open requests from being hidden by closed ones.
 */
class ChangeRequestVisibilityTest {
  private static final String ADMIN = "admin";
  private static final String ALICE = "alice";
  private static final String BOB = "bob";
  private static final UUID ENTITY_ID = UUID.randomUUID();
  private static final int LIMIT = 50;
  private static final List<String> OPEN_STATUSES = List.of("Pending", "Approved");

  private MockedStatic<Entity> entity;
  private MockedStatic<SubjectContext> subjectContextStatic;
  private ChangeRequestDAO requests;
  private ChangeRevisionDAO revisions;
  private Authorizer authorizer;
  private SecurityContext securityContext;
  private SubjectContext adminSubject;
  private SubjectContext plainSubject;

  @BeforeEach
  void setUp() {
    CollectionDAO dao = mock(CollectionDAO.class);
    requests = mock(ChangeRequestDAO.class);
    revisions = mock(ChangeRevisionDAO.class);
    when(dao.changeRequestDAO()).thenReturn(requests);
    when(dao.changeRevisionDAO()).thenReturn(revisions);
    when(revisions.findByIds(any())).thenReturn(List.of());

    EntityRepository<Glossary> glossaryRepository = mock(EntityRepository.class);
    when(glossaryRepository.getFields(anyString())).thenReturn(Fields.EMPTY_FIELDS);
    when(glossaryRepository.get(any(), any(), any(), any(RelationIncludes.class), anyBoolean()))
        .thenReturn(new Glossary().withId(ENTITY_ID));
    TaskRepository taskRepository = mock(TaskRepository.class);

    entity = mockStatic(Entity.class);
    entity.when(Entity::getCollectionDAO).thenReturn(dao);
    entity
        .when(() -> Entity.getEntityRepository(eq(Entity.GLOSSARY)))
        .thenAnswer(i -> glossaryRepository);
    entity.when(() -> Entity.getEntityRepository(eq(Entity.TASK))).thenAnswer(i -> taskRepository);
    entity.when(() -> Entity.getEntities(any(), anyString(), any())).thenReturn(List.of());

    adminSubject = mock(SubjectContext.class);
    when(adminSubject.isAdmin()).thenReturn(true);
    plainSubject = mock(SubjectContext.class);
    when(plainSubject.isAdmin()).thenReturn(false);
    when(plainSubject.isOwner(any())).thenReturn(false);
    when(plainSubject.isReviewer(any())).thenReturn(false);
    subjectContextStatic = mockStatic(SubjectContext.class);

    authorizer = mock(Authorizer.class);
    Principal principal = mock(Principal.class);
    when(principal.getName()).thenReturn(ALICE);
    securityContext = mock(SecurityContext.class);
    when(securityContext.getUserPrincipal()).thenReturn(principal);
  }

  @AfterEach
  void tearDown() {
    subjectContextStatic.close();
    entity.close();
  }

  private void asAdmin() {
    subjectContextStatic
        .when(() -> SubjectContext.getSubjectContext(ADMIN))
        .thenReturn(adminSubject);
    when(securityContext.getUserPrincipal().getName()).thenReturn(ADMIN);
  }

  private void asAlice() {
    subjectContextStatic
        .when(() -> SubjectContext.getSubjectContext(ALICE))
        .thenReturn(plainSubject);
    when(securityContext.getUserPrincipal().getName()).thenReturn(ALICE);
  }

  private ChangeRequest request(String requester, ChangeRequestStatus status, long updatedAt) {
    return new ChangeRequest()
        .withId(UUID.randomUUID())
        .withEntityType(Entity.GLOSSARY)
        .withEntityId(ENTITY_ID)
        .withEntityFullyQualifiedName("g." + ENTITY_ID)
        .withRequestedBy(requester)
        .withStatus(status)
        .withActiveRevisionId(UUID.randomUUID())
        .withActiveRevisionNumber(1)
        .withTaskId(UUID.randomUUID())
        .withCreatedAt(updatedAt)
        .withUpdatedAt(updatedAt);
  }

  private List<ChangeRequest> bobPending(int count, long baseUpdatedAt) {
    return IntStream.range(0, count)
        .mapToObj(i -> request(BOB, ChangeRequestStatus.PENDING, baseUpdatedAt + i))
        .toList();
  }

  @Test
  void statusFilterUsesTheStatusFilteredDaoQuery() {
    asAdmin();
    List<ChangeRequest> pending = bobPending(2, 1000L);
    when(requests.listByEntityAndStatuses(eq(ENTITY_ID), eq(OPEN_STATUSES), eq(LIMIT)))
        .thenReturn(pending);

    List<ChangeRequest> result =
        ChangeRequestVisibility.list(
            authorizer, securityContext, ENTITY_ID, null, OPEN_STATUSES, LIMIT);

    assertEquals(ids(pending), ids(result));
    verify(requests).listByEntityAndStatuses(eq(ENTITY_ID), eq(OPEN_STATUSES), eq(LIMIT));
    verify(requests, never()).listByEntity(any(), anyInt());
    verify(requests, never()).listByEntitiesAndStatuses(any(), any());
  }

  @Test
  void statusFilterKeepsOpenRequestsThatClosedHistoryWouldHaveHidden() {
    asAdmin();
    // 51 closed requests (bumped updatedAt) plus 4 pending older than all of them, as in the bug
    // report: without the status filter the newest 50 are all closed and the 4 pending are hidden.
    // The status-filtered SQL query returns only the 4 open ones.
    List<ChangeRequest> pending =
        IntStream.range(0, 4)
            .mapToObj(i -> request(BOB, ChangeRequestStatus.PENDING, 100L + i))
            .toList();
    when(requests.listByEntityAndStatuses(eq(ENTITY_ID), eq(OPEN_STATUSES), eq(LIMIT)))
        .thenReturn(pending);

    List<ChangeRequest> result =
        ChangeRequestVisibility.list(
            authorizer, securityContext, ENTITY_ID, null, OPEN_STATUSES, LIMIT);

    assertEquals(ids(pending), ids(result), "the 4 open requests must all surface");
    verify(requests).listByEntityAndStatuses(eq(ENTITY_ID), eq(OPEN_STATUSES), eq(LIMIT));
    verify(requests, never()).listByEntity(any(), anyInt());
    verify(requests, never()).listByEntitiesAndStatuses(any(), any());
  }

  @Test
  void overFetchKeepsTheCallersOwnRequestWhenOthersFillThePage() {
    asAlice();
    // 50 of bob's open requests fill the limited page; alice's own open request is older than all
    // of them, so without over-fetch it falls outside the page and is hidden.
    List<ChangeRequest> bobs = bobPending(LIMIT, 10_000L);
    ChangeRequest alices = request(ALICE, ChangeRequestStatus.PENDING, 1L);
    when(requests.listByEntityAndStatuses(eq(ENTITY_ID), eq(List.of("Pending")), eq(LIMIT)))
        .thenReturn(bobs);
    List<ChangeRequest> all = new ArrayList<>(bobs);
    all.add(alices);
    when(requests.listByEntitiesAndStatuses(
            eq(List.of(ENTITY_ID.toString())), eq(List.of("Pending"))))
        .thenReturn(all);

    List<ChangeRequest> result =
        ChangeRequestVisibility.list(
            authorizer, securityContext, ENTITY_ID, null, List.of("Pending"), LIMIT);

    assertEquals(List.of(alices.getId()), ids(result), "alice's own request must not be lost");
    verify(requests).listByEntityAndStatuses(eq(ENTITY_ID), eq(List.of("Pending")), eq(LIMIT));
    verify(requests)
        .listByEntitiesAndStatuses(eq(List.of(ENTITY_ID.toString())), eq(List.of("Pending")));
  }

  @Test
  void overFetchSortsByUpdatedAtDescAndTrimsToLimit() {
    asAlice();
    // The caller's own open requests span more than a page; the newest LIMIT of them survive.
    List<ChangeRequest> alices =
        IntStream.range(0, LIMIT + 5)
            .mapToObj(i -> request(ALICE, ChangeRequestStatus.PENDING, 1000L - i))
            .toList();
    when(requests.listByEntityAndStatuses(eq(ENTITY_ID), eq(List.of("Pending")), eq(LIMIT)))
        .thenReturn(alices.subList(0, LIMIT));
    when(requests.listByEntitiesAndStatuses(
            eq(List.of(ENTITY_ID.toString())), eq(List.of("Pending"))))
        .thenReturn(alices);

    List<ChangeRequest> result =
        ChangeRequestVisibility.list(
            authorizer, securityContext, ENTITY_ID, null, List.of("Pending"), LIMIT);

    assertEquals(LIMIT, result.size());
    // Newest first: the page is the LIMIT most recently updated of the caller's own requests.
    List<ChangeRequest> expected =
        alices.stream()
            .sorted((a, b) -> Long.compare(b.getUpdatedAt(), a.getUpdatedAt()))
            .limit(LIMIT)
            .toList();
    assertEquals(ids(expected), ids(result));
  }

  @Test
  void noStatusFilterFallsBackToTheLegacyDaoQuery() {
    asAdmin();
    List<ChangeRequest> all =
        List.of(
            request(BOB, ChangeRequestStatus.APPLIED, 1L),
            request(BOB, ChangeRequestStatus.PENDING, 2L));
    when(requests.listByEntity(eq(ENTITY_ID), eq(LIMIT))).thenReturn(all);

    List<ChangeRequest> result =
        ChangeRequestVisibility.list(
            authorizer, securityContext, ENTITY_ID, null, List.of(), LIMIT);

    assertEquals(ids(all), ids(result));
    verify(requests).listByEntity(eq(ENTITY_ID), eq(LIMIT));
    verify(requests, never()).listByEntityAndStatuses(any(), any(), anyInt());
    verify(requests, never()).listByEntitiesAndStatuses(any(), any());
  }

  @Test
  void requestedByUsesTheRequesterQuery() {
    asAlice();
    List<ChangeRequest> mine = List.of(request(ALICE, ChangeRequestStatus.PENDING, 1L));
    when(requests.listByRequester(eq(ALICE), eq(LIMIT))).thenReturn(mine);

    List<ChangeRequest> result =
        ChangeRequestVisibility.list(
            authorizer, securityContext, null, ALICE, OPEN_STATUSES, LIMIT);

    assertEquals(ids(mine), ids(result));
    verify(requests).listByRequester(eq(ALICE), eq(LIMIT));
    verify(requests, never()).listByEntity(any(), anyInt());
    verify(requests, never()).listByEntityAndStatuses(any(), any(), anyInt());
  }

  @Test
  void listRequiresAnEntityOrRequesterFilter() {
    asAdmin();
    assertThrows(
        BadRequestException.class,
        () ->
            ChangeRequestVisibility.list(
                authorizer, securityContext, null, null, OPEN_STATUSES, LIMIT));
  }

  @Test
  void emptyEntityReturnsNothing() {
    asAdmin();
    when(requests.listByEntityAndStatuses(eq(ENTITY_ID), eq(OPEN_STATUSES), eq(LIMIT)))
        .thenReturn(List.of());

    List<ChangeRequest> result =
        ChangeRequestVisibility.list(
            authorizer, securityContext, ENTITY_ID, null, OPEN_STATUSES, LIMIT);

    assertTrue(result.isEmpty());
    verify(requests, never()).listByEntitiesAndStatuses(any(), any());
  }

  private static List<UUID> ids(List<ChangeRequest> list) {
    return list.stream().map(ChangeRequest::getId).toList();
  }
}
