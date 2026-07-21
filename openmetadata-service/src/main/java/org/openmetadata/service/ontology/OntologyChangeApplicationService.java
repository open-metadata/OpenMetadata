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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.UriInfo;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyChangeApplicationResult;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationResult;
import org.openmetadata.schema.type.OntologyChangeOperationResultStatus;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.sdk.exception.WebServiceException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.OntologyAxiomRepository;
import org.openmetadata.service.jdbi3.OntologyChangeSetRepository;
import org.openmetadata.service.ontology.OntologyChangeOperationExecutor.OperationOutcome;
import org.openmetadata.service.util.RestUtil.PutResponse;

public final class OntologyChangeApplicationService {
  private static final Set<OntologyChangeSetState> APPLICABLE_STATES =
      Set.of(
          OntologyChangeSetState.DRAFT,
          OntologyChangeSetState.SUBMITTED,
          OntologyChangeSetState.APPLY_FAILED);
  private static final String APPLICATION_FIELDS =
      "operations,undoCursor,state,applicationResult,glossaries";
  private static final String ROLLBACK_MESSAGE =
      "Rolled back because a later ontology operation failed";
  private static final String SKIP_MESSAGE = "Skipped after an earlier ontology operation failed";

  private final OntologyChangeSetRepository changeSetRepository;
  private final OntologyChangePreflight preflight;
  private final OntologyChangeOperationExecutor executor;
  private final OntologyChangeEventPublisher eventPublisher;
  private final ChangeTransaction transaction;
  private final Clock clock;

  public OntologyChangeApplicationService(
      final OntologyChangeSetRepository changeSetRepository,
      final GlossaryTermRepository termRepository,
      final OntologyAxiomRepository axiomRepository,
      final Clock clock) {
    this(
        changeSetRepository, productionDependencies(termRepository, axiomRepository, clock), clock);
  }

  OntologyChangeApplicationService(
      final OntologyChangeSetRepository changeSetRepository,
      final Dependencies dependencies,
      final Clock clock) {
    this.changeSetRepository = changeSetRepository;
    this.preflight = dependencies.preflight();
    this.executor = dependencies.executor();
    this.eventPublisher = dependencies.eventPublisher();
    this.transaction = dependencies.transaction();
    this.clock = clock;
  }

  public PutResponse<OntologyChangeSet> apply(
      final UriInfo uriInfo, final UUID changeSetId, final String user) {
    final OntologyChangeSet changeSet = requireApplicable(changeSetId);
    final List<OntologyChangeOperation> operations = activeOperations(changeSet);
    preflight.validate(changeSet, operations);
    final ApplicationExecution execution =
        new ApplicationExecution(uriInfo, changeSetId, user, new ArrayList<>());
    PutResponse<OntologyChangeSet> response;
    try {
      response = transaction.execute(() -> applyAtomically(execution, operations));
    } catch (OperationApplicationException failure) {
      response = recordFailure(execution, operations, failure);
    }
    publishApplied(response.getEntity(), user);
    return response;
  }

  private PutResponse<OntologyChangeSet> applyAtomically(
      final ApplicationExecution execution, final List<OntologyChangeOperation> operations) {
    execution.results().clear();
    executeOperations(execution, operations);
    final OntologyChangeApplicationResult result =
        applicationResult(execution.user(), execution.results());
    return transition(execution, OntologyChangeSetState.APPLIED, result);
  }

  private void executeOperations(
      final ApplicationExecution execution, final List<OntologyChangeOperation> operations) {
    for (final OntologyChangeOperation operation : operations) {
      executeOperation(execution, operation);
    }
  }

  private void executeOperation(
      final ApplicationExecution execution, final OntologyChangeOperation operation) {
    try {
      final OperationOutcome outcome =
          executor.execute(execution.uriInfo(), execution.user(), operation);
      execution.results().add(appliedResult(operation, outcome));
    } catch (RuntimeException exception) {
      execution.results().add(failedResult(operation, exception));
      throw new OperationApplicationException(exception);
    }
  }

  private PutResponse<OntologyChangeSet> recordFailure(
      final ApplicationExecution execution,
      final List<OntologyChangeOperation> operations,
      final OperationApplicationException failure) {
    final List<OntologyChangeOperationResult> results =
        rollbackResults(operations, execution.results());
    final PutResponse<OntologyChangeSet> response =
        transition(
            execution,
            OntologyChangeSetState.APPLY_FAILED,
            applicationResult(execution.user(), results));
    if (!isExpected(failure.getCause())) {
      throw failure.getCause();
    }
    return response;
  }

  private PutResponse<OntologyChangeSet> transition(
      final ApplicationExecution execution,
      final OntologyChangeSetState state,
      final OntologyChangeApplicationResult result) {
    return changeSetRepository.transition(
        execution.uriInfo(), execution.user(), execution.changeSetId(), state, result);
  }

  private static List<OntologyChangeOperationResult> rollbackResults(
      final List<OntologyChangeOperation> operations,
      final List<OntologyChangeOperationResult> attemptedResults) {
    final int failedIndex = attemptedResults.size() - 1;
    final List<OntologyChangeOperationResult> results = new ArrayList<>(operations.size());
    for (int index = 0; index < operations.size(); index++) {
      results.add(rollbackResult(operations.get(index), attemptedResults, index, failedIndex));
    }
    return List.copyOf(results);
  }

  private static OntologyChangeOperationResult rollbackResult(
      final OntologyChangeOperation operation,
      final List<OntologyChangeOperationResult> attemptedResults,
      final int index,
      final int failedIndex) {
    final OntologyChangeOperationResult result =
        switch (Integer.compare(index, failedIndex)) {
          case -1 -> result(
              operation,
              OntologyChangeOperationResultStatus.ROLLED_BACK,
              null,
              null,
              ROLLBACK_MESSAGE);
          case 0 -> attemptedResults.get(index);
          default -> result(
              operation, OntologyChangeOperationResultStatus.SKIPPED, null, null, SKIP_MESSAGE);
        };
    return result;
  }

  private static boolean isExpected(final RuntimeException exception) {
    return exception instanceof WebServiceException
        || exception instanceof WebApplicationException
        || exception instanceof IllegalArgumentException;
  }

  private void publishApplied(final OntologyChangeSet changeSet, final String user) {
    if (changeSet.getState() == OntologyChangeSetState.APPLIED) {
      eventPublisher.publish(EventType.ONTOLOGY_CHANGE_SET_APPLIED, changeSet, user);
    }
  }

  private OntologyChangeSet requireApplicable(final UUID changeSetId) {
    final OntologyChangeSet changeSet =
        changeSetRepository.get(
            null,
            changeSetId,
            changeSetRepository.getFields(APPLICATION_FIELDS),
            Include.NON_DELETED,
            false);
    if (!APPLICABLE_STATES.contains(changeSet.getState())) {
      throw new BadRequestException(
          "Ontology change set '"
              + changeSetId
              + "' cannot be applied in state "
              + changeSet.getState());
    }
    return changeSet;
  }

  private static List<OntologyChangeOperation> activeOperations(final OntologyChangeSet changeSet) {
    final List<OntologyChangeOperation> operations = listOrEmpty(changeSet.getOperations());
    return List.copyOf(operations.subList(0, changeSet.getUndoCursor()));
  }

  private OntologyChangeApplicationResult applicationResult(
      final String user, final List<OntologyChangeOperationResult> results) {
    return new OntologyChangeApplicationResult()
        .withAppliedAt(clock.millis())
        .withAppliedBy(user)
        .withOperationsProcessed(results.size())
        .withOperationsApplied(count(results, OntologyChangeOperationResultStatus.APPLIED))
        .withOperationsFailed(count(results, OntologyChangeOperationResultStatus.FAILED))
        .withResults(List.copyOf(results));
  }

  private static int count(
      final List<OntologyChangeOperationResult> results,
      final OntologyChangeOperationResultStatus status) {
    return Math.toIntExact(results.stream().filter(result -> result.getStatus() == status).count());
  }

  private static OntologyChangeOperationResult appliedResult(
      final OntologyChangeOperation operation, final OperationOutcome outcome) {
    return result(
        operation,
        OntologyChangeOperationResultStatus.APPLIED,
        outcome.entity(),
        outcome.entityVersion(),
        null);
  }

  private static OntologyChangeOperationResult failedResult(
      final OntologyChangeOperation operation, final RuntimeException exception) {
    return result(
        operation, OntologyChangeOperationResultStatus.FAILED, null, null, exception.getMessage());
  }

  private static OntologyChangeOperationResult result(
      final OntologyChangeOperation operation,
      final OntologyChangeOperationResultStatus status,
      final EntityReference entity,
      final Double entityVersion,
      final String message) {
    return new OntologyChangeOperationResult()
        .withOperationId(operation.getId())
        .withStatus(status)
        .withEntity(entity)
        .withEntityVersion(entityVersion)
        .withMessage(message);
  }

  private static Dependencies productionDependencies(
      final GlossaryTermRepository termRepository,
      final OntologyAxiomRepository axiomRepository,
      final Clock clock) {
    return new Dependencies(
        productionPreflight(),
        new OntologyChangeOperationExecutor(termRepository, axiomRepository, clock),
        new OntologyChangeEventPublisher(),
        work -> termRepository.executeInTransaction(work));
  }

  private static OntologyChangePreflight productionPreflight() {
    return new OntologyChangePreflight(
        (entityType, id) -> Entity.getEntity(entityType, id, "", Include.ALL));
  }

  record Dependencies(
      OntologyChangePreflight preflight,
      OntologyChangeOperationExecutor executor,
      OntologyChangeEventPublisher eventPublisher,
      ChangeTransaction transaction) {}

  @FunctionalInterface
  interface ChangeTransaction {
    PutResponse<OntologyChangeSet> execute(Supplier<PutResponse<OntologyChangeSet>> work);
  }

  private record ApplicationExecution(
      UriInfo uriInfo,
      UUID changeSetId,
      String user,
      List<OntologyChangeOperationResult> results) {}

  private static final class OperationApplicationException extends RuntimeException {
    private OperationApplicationException(final RuntimeException cause) {
      super(cause);
    }

    @Override
    public synchronized RuntimeException getCause() {
      return (RuntimeException) super.getCause();
    }
  }
}
