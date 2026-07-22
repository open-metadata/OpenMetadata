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

package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyChangeApplicationResult;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationResult;
import org.openmetadata.schema.type.OntologyChangeOperationResultStatus;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.service.jdbi3.OntologyChangeSetRepository;
import org.openmetadata.service.ontology.OntologyChangeApplicationService.ChangeTransaction;
import org.openmetadata.service.ontology.OntologyChangeApplicationService.Dependencies;
import org.openmetadata.service.ontology.OntologyChangeApplicationService.EntityCacheInvalidator;
import org.openmetadata.service.ontology.OntologyChangeOperationExecutor.OperationOutcome;
import org.openmetadata.service.util.RestUtil.PutResponse;

class OntologyChangeApplicationServiceTest {
  private static final String USER = "steward";
  private static final long NOW = 1_750_000_000_000L;
  private final UUID changeSetId = UUID.randomUUID();
  private final UriInfo uriInfo = mock(UriInfo.class);
  private final OntologyChangeSetRepository repository = mock(OntologyChangeSetRepository.class);
  private final OntologyChangePreflight preflight = mock(OntologyChangePreflight.class);
  private final OntologyChangeOperationExecutor executor =
      mock(OntologyChangeOperationExecutor.class);
  private final OntologyChangeEventPublisher eventPublisher =
      mock(OntologyChangeEventPublisher.class);
  private final RecordingTransaction transaction = new RecordingTransaction();
  private final EntityCacheInvalidator cacheInvalidator = mock(EntityCacheInvalidator.class);
  private final Clock clock = Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC);
  private final OntologyChangeOperation operation = operation();
  private OntologyChangeSet changeSet;
  private OntologyChangeApplicationService service;

  @BeforeEach
  void setUp() {
    changeSet = changeSet(null);
    when(repository.get(isNull(), eq(changeSetId), any(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(changeSet);
    when(repository.transition(any(), eq(USER), eq(changeSetId), any(), any()))
        .thenAnswer(
            invocation -> {
              final OntologyChangeSetState state = invocation.getArgument(3);
              final OntologyChangeApplicationResult result = invocation.getArgument(4);
              changeSet.setState(state);
              changeSet.setApplicationResult(result);
              return response(changeSet);
            });
    doAnswer(
            invocation -> {
              assertFalse(transaction.isActive());
              return null;
            })
        .when(cacheInvalidator)
        .invalidate(any());
    final Dependencies dependencies =
        new Dependencies(preflight, executor, eventPublisher, transaction, cacheInvalidator);
    service = new OntologyChangeApplicationService(repository, dependencies, clock);
  }

  @Test
  void commitsMutationsAndAppliedStateInOneTransaction() {
    final EntityReference entity = entity(operation);
    when(executor.execute(uriInfo, USER, operation)).thenReturn(new OperationOutcome(entity, 0.2));
    when(repository.transition(any(), eq(USER), eq(changeSetId), any(), any()))
        .thenAnswer(
            invocation -> {
              assertTrue(transaction.isActive());
              changeSet.setState(invocation.getArgument(3));
              changeSet.setApplicationResult(invocation.getArgument(4));
              return response(changeSet);
            });

    final OntologyChangeSet applied = service.apply(uriInfo, changeSetId, USER).getEntity();

    assertEquals(OntologyChangeSetState.APPLIED, applied.getState());
    assertEquals(1, applied.getApplicationResult().getOperationsApplied());
    assertEquals(0.2, applied.getApplicationResult().getResults().getFirst().getEntityVersion());
    assertEquals(1, transaction.getExecutionCount());
    verify(repository, times(1)).transition(any(), eq(USER), eq(changeSetId), any(), any());
    verify(eventPublisher).publish(EventType.ONTOLOGY_CHANGE_SET_APPLIED, changeSet, USER);
    verify(cacheInvalidator).invalidate(entity);
  }

  @Test
  void rollsBackAppliedOperationsAndSkipsRemainingWork() {
    final OntologyChangeOperation failing = operation();
    final OntologyChangeOperation later = operation();
    final EntityReference appliedEntity = entity(operation);
    changeSet.setOperations(List.of(operation, failing, later));
    changeSet.setUndoCursor(3);
    when(executor.execute(uriInfo, USER, operation))
        .thenReturn(new OperationOutcome(appliedEntity, 0.2));
    when(executor.execute(uriInfo, USER, failing))
        .thenThrow(new BadRequestException("term still has children"));

    final OntologyChangeSet failed = service.apply(uriInfo, changeSetId, USER).getEntity();

    assertEquals(OntologyChangeSetState.APPLY_FAILED, failed.getState());
    assertEquals(0, failed.getApplicationResult().getOperationsApplied());
    assertEquals(1, failed.getApplicationResult().getOperationsFailed());
    assertEquals(
        List.of(
            OntologyChangeOperationResultStatus.ROLLED_BACK,
            OntologyChangeOperationResultStatus.FAILED,
            OntologyChangeOperationResultStatus.SKIPPED),
        failed.getApplicationResult().getResults().stream()
            .map(OntologyChangeOperationResult::getStatus)
            .toList());
    assertFalse(transaction.isActive());
    verify(executor, never()).execute(uriInfo, USER, later);
    verify(eventPublisher, never()).publish(any(), any(), any());
    verify(cacheInvalidator).invalidate(appliedEntity);
  }

  @Test
  void persistsFailureBeforeRethrowingUnexpectedMutationError() {
    when(executor.execute(uriInfo, USER, operation))
        .thenThrow(new IllegalStateException("database connection lost"));

    assertThrows(IllegalStateException.class, () -> service.apply(uriInfo, changeSetId, USER));

    final ArgumentCaptor<OntologyChangeSetState> state =
        ArgumentCaptor.forClass(OntologyChangeSetState.class);
    verify(repository).transition(any(), eq(USER), eq(changeSetId), state.capture(), any());
    assertEquals(OntologyChangeSetState.APPLY_FAILED, state.getValue());
    assertFalse(transaction.isActive());
    verify(cacheInvalidator, never()).invalidate(any());
  }

  @Test
  void retriesEveryOperationAfterAnAtomicFailure() {
    final OntologyChangeOperationResult previous =
        new OntologyChangeOperationResult()
            .withOperationId(operation.getId())
            .withStatus(OntologyChangeOperationResultStatus.ROLLED_BACK);
    changeSet.setState(OntologyChangeSetState.APPLY_FAILED);
    changeSet.setApplicationResult(
        new OntologyChangeApplicationResult().withResults(List.of(previous)));
    when(executor.execute(uriInfo, USER, operation))
        .thenReturn(new OperationOutcome(entity(operation), 0.2));

    final OntologyChangeSet retried = service.apply(uriInfo, changeSetId, USER).getEntity();

    assertEquals(OntologyChangeSetState.APPLIED, retried.getState());
    verify(executor).execute(uriInfo, USER, operation);
  }

  private OntologyChangeSet changeSet(final OntologyChangeApplicationResult result) {
    return new OntologyChangeSet()
        .withId(changeSetId)
        .withState(OntologyChangeSetState.DRAFT)
        .withGlossaries(List.of(new EntityReference().withId(UUID.randomUUID())))
        .withOperations(List.of(operation))
        .withUndoCursor(1)
        .withApplicationResult(result);
  }

  private static OntologyChangeOperation operation() {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.DELETE_TERM)
        .withTargetId(UUID.randomUUID())
        .withBaseVersion(0.1);
  }

  private static EntityReference entity(final OntologyChangeOperation operation) {
    return new EntityReference().withId(operation.getTargetId()).withType("glossaryTerm");
  }

  private static PutResponse<OntologyChangeSet> response(final OntologyChangeSet changeSet) {
    return new PutResponse<>(Response.Status.OK, changeSet, EventType.ENTITY_UPDATED);
  }

  private static final class RecordingTransaction implements ChangeTransaction {
    private boolean active;
    private int executionCount;

    @Override
    public PutResponse<OntologyChangeSet> execute(
        final Supplier<PutResponse<OntologyChangeSet>> work) {
      PutResponse<OntologyChangeSet> result;
      active = true;
      executionCount++;
      try {
        result = work.get();
      } finally {
        active = false;
      }
      return result;
    }

    private boolean isActive() {
      return active;
    }

    private int getExecutionCount() {
      return executionCount;
    }
  }
}
