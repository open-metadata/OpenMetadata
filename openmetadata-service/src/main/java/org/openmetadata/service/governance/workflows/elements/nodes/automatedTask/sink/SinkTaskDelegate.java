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

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink;

import static org.openmetadata.service.governance.workflows.Workflow.ENTITY_LIST_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.FAILURE_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.BooleanSupplier;
import java.util.function.Function;
import java.util.function.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowStopRequests;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler.InputNamespaces;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink.SubBatchPrefetcher.FetchedSubBatch;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.secrets.WorkflowSinkSecrets;
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;

/**
 * Flowable delegate that executes sink operations within a workflow.
 *
 * <p>This delegate supports two modes:
 *
 * <ul>
 *   <li><b>Single entity mode:</b> Processes one entity at a time (event-based workflows)
 *   <li><b>Batch mode:</b> Processes all entities in the batch at once (periodic batch workflows
 *       with batchMode=true in sink config)
 * </ul>
 *
 * <p>When batchMode is enabled in the sink config, the trigger automatically configures single
 * execution mode (cardinality=1), ensuring only one workflow instance processes the entire batch.
 */
@Slf4j
public class SinkTaskDelegate implements JavaDelegate {

  /** Sub-batches in a row that may write nothing before the remaining ones are skipped. */
  static final int MAX_CONSECUTIVE_FAILED_SUB_BATCHES = 3;

  /** Why the sub-batches left are not written once an administrator asked the run to stop. */
  static final String STOP_REQUESTED_REASON = "the workflow instance was terminated by an admin";

  /** Loads one entity of a batch from its entity link, on the prefetch thread; replaced in tests. */
  Function<String, EntityInterface> entityLoader = SinkTaskDelegate::loadEntity;

  /** Whether the WorkflowInstance of a business key was asked to stop; replaced in tests. */
  Predicate<String> isStopRequested = WorkflowStopRequests::isStopRequested;

  private Expression sinkTypeExpr;
  private Expression sinkConfigExpr;
  private Expression syncModeExpr;
  private Expression outputFormatExpr;
  private Expression hierarchyConfigExpr;
  private Expression entityFilterExpr;
  private Expression batchModeExpr;
  private Expression timeoutSecondsExpr;
  private Expression inputNamespaceMapExpr;
  private Expression failureHandledByBranchExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    SinkProvider sinkProvider = null;

    try {
      String sinkType = (String) sinkTypeExpr.getValue(execution);
      // The deployed sink config carries its secrets encrypted; the provider gets the plaintext.
      Object sinkConfig =
          WorkflowSinkSecrets.decrypt(
              JsonUtils.readOrConvertValue(sinkConfigExpr.getValue(execution), Object.class));
      String syncMode = (String) syncModeExpr.getValue(execution);
      String outputFormat = (String) outputFormatExpr.getValue(execution);
      Object hierarchyConfig =
          JsonUtils.readOrConvertValue(hierarchyConfigExpr.getValue(execution), Object.class);
      Object entityFilter =
          JsonUtils.readOrConvertValue(entityFilterExpr.getValue(execution), Object.class);
      boolean batchMode = Boolean.parseBoolean((String) batchModeExpr.getValue(execution));
      int timeoutSeconds =
          timeoutSecondsExpr != null
              ? Integer.parseInt((String) timeoutSecondsExpr.getValue(execution))
              : 300; // Default 5 minutes

      InputNamespaces inputNamespaces = InputNamespaces.from(inputNamespaceMapExpr, execution);

      // Check if we have an entity list for batch processing
      String entityListNamespace = inputNamespaces.namespaceFor(ENTITY_LIST_VARIABLE);
      List<String> entityList = null;
      if (entityListNamespace != null) {
        Object entityListObj =
            varHandler.getNamespacedVariable(entityListNamespace, ENTITY_LIST_VARIABLE);
        if (entityListObj instanceof List) {
          entityList = (List<String>) entityListObj;
        }
      }

      // Get the sink provider from registry
      sinkProvider =
          SinkProviderRegistry.getInstance()
              .create(sinkType, sinkConfig)
              .orElseThrow(
                  () ->
                      new IllegalArgumentException(
                          "No sink provider registered for type: " + sinkType));

      // Validate the configuration
      sinkProvider.validate(sinkConfig);

      // Build sink context
      SinkContext context =
          SinkContext.builder()
              .sinkConfig(sinkConfig)
              .syncMode(syncMode)
              .outputFormat(outputFormat)
              .hierarchyConfig(hierarchyConfig)
              .entityFilter(entityFilter)
              .batchMode(batchMode)
              .timeoutSeconds(timeoutSeconds)
              .workflowExecutionId(execution.getProcessInstanceId())
              .workflowName(getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()))
              .build();

      SinkRun run;

      // Determine execution mode: batch or single entity
      if (batchMode
          && entityList != null
          && !entityList.isEmpty()
          && sinkProvider.supportsBatch()) {
        // Batch mode: process all entities at once (single workflow instance)
        String businessKey = execution.getProcessInstanceBusinessKey();
        run =
            executeBatchMode(
                context, sinkProvider, entityList, () -> isStopRequested.test(businessKey));
      } else {
        // Single entity mode: process one entity
        run =
            new SinkRun(
                executeSingleEntityMode(context, sinkProvider, inputNamespaces, varHandler), false);
      }
      SinkResult result = run.result();

      // Set output variables
      varHandler.setNodeVariable(
          "syncResult", JsonUtils.pojoToJson(SinkResultSummary.from(result)));
      varHandler.setNodeVariable("syncedCount", result.getSyncedCount());
      varHandler.setNodeVariable("failedCount", result.getFailedCount());
      // A stopped run reports failure as well: an edge leaves on the result value it names, and
      // Flowable fails a node whose conditional edges match none.
      varHandler.setNodeVariable(RESULT_VARIABLE, result.isSuccess() ? "success" : "failure");
      varHandler.setFailure(!result.isSuccess());
      if (!result.isSuccess() && !run.stopRequested() && !isFailureHandledByBranch(execution)) {
        // Persisted so the trigger process, which owns the WorkflowInstance, can read it back
        // through the call activity's output mapping; the transient flag above does not outlive
        // this transaction. A failure the workflow routes to its own branch is not raised, nor is
        // a stop an administrator asked for: the WorkflowInstance records that one itself.
        varHandler.setGlobalVariable(FAILURE_VARIABLE, true);
      }

      LOG.info(
          "[{}] Sink operation completed: syncedCount={}, failedCount={}, success={}, batchMode={}",
          getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()),
          result.getSyncedCount(),
          result.getFailedCount(),
          result.isSuccess(),
          batchMode && entityList != null);

    } catch (Exception exc) {
      LOG.error(
          "[{}] Sink operation failed: ",
          getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()),
          exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      // The BpmnError ends the run at the Error end event, so no failure branch ever runs for it.
      // A periodic-batch trigger maps the exception to a variable its end state does not read; the
      // persisted failure flag reaches it, as it does for a sink that completes failed.
      varHandler.setGlobalVariable(FAILURE_VARIABLE, true);
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    } finally {
      if (sinkProvider != null) {
        try {
          sinkProvider.close();
        } catch (Exception e) {
          LOG.warn("Error closing sink provider", e);
        }
      }
    }
  }

  private boolean isFailureHandledByBranch(DelegateExecution execution) {
    // Processes deployed before this field existed do not carry it; they keep raising the flag.
    return failureHandledByBranchExpr != null
        && Boolean.parseBoolean((String) failureHandledByBranchExpr.getValue(execution));
  }

  /**
   * Execute sink in batch mode - process entities in sub-batches to prevent OOM.
   *
   * <p>Each sub-batch holds as many entities as {@link SinkProvider#nextBatchSize} asks for. The
   * next sub-batch is fetched by a small pool while the current one is written, so at most two
   * sub-batches are in memory at once. No new sub-batch is written after {@link
   * #MAX_CONSECUTIVE_FAILED_SUB_BATCHES} sub-batches in a row failed every entity; the entities
   * left, fetched or not, are reported as failed. The same happens, checked before each sub-batch,
   * once an administrator asked the workflow instance to stop. {@link SinkProvider#finishBatch}
   * runs last, whatever was skipped, so a provider can write what it held back.
   */
  private SinkRun executeBatchMode(
      SinkContext context,
      SinkProvider sinkProvider,
      List<String> entityLinks,
      BooleanSupplier isStopRequested) {

    LOG.info(
        "[{}] Executing batch sink for {} entities", context.getWorkflowName(), entityLinks.size());

    BatchProgress progress = new BatchProgress(context.getWorkflowName(), isStopRequested);
    SubBatchCursor cursor = new SubBatchCursor(entityLinks);
    try (SubBatchPrefetcher prefetcher =
        new SubBatchPrefetcher(context.getWorkflowName(), entityLoader)) {
      prefetchNext(prefetcher, cursor, sinkProvider);
      while (prefetcher.hasPending()) {
        FetchedSubBatch current = prefetcher.take();
        if (progress.shouldStop()) {
          progress.skip(current.entityLinks());
        } else {
          prefetchNext(prefetcher, cursor, sinkProvider);
          progress.record(writeSubBatch(context, sinkProvider, current));
        }
      }
    }
    if (cursor.hasNext()) {
      progress.skip(cursor.remaining());
    }
    progress.record(finishBatch(context, sinkProvider));
    return new SinkRun(progress.toResult(), progress.wasStopRequested());
  }

  private static SubBatchOutcome finishBatch(SinkContext context, SinkProvider sinkProvider) {
    SinkResult finished = sinkProvider.finishBatch(context);
    boolean writeFailed = !finished.isSuccess() && finished.getSyncedCount() == 0;
    return new SubBatchOutcome(finished, List.of(), writeFailed);
  }

  private static void prefetchNext(
      SubBatchPrefetcher prefetcher, SubBatchCursor cursor, SinkProvider sinkProvider) {
    if (cursor.hasNext()) {
      prefetcher.prefetch(cursor.next(sinkProvider.nextBatchSize()));
    }
  }

  private SubBatchOutcome writeSubBatch(
      SinkContext context, SinkProvider sinkProvider, FetchedSubBatch subBatch) {
    List<EntityInterface> entities = subBatch.entities();
    LOG.debug(
        "[{}] Processing sub-batch of {} entities", context.getWorkflowName(), entities.size());
    SinkResult written =
        entities.isEmpty()
            ? SinkResult.builder().success(true).build()
            : sinkProvider.writeBatch(context, entities);
    // A sub-batch whose every entity failed to load reached no provider, yet failed as a whole.
    boolean writeFailed =
        entities.isEmpty()
            ? !subBatch.fetchErrors().isEmpty()
            : madeNoProgress(written, entities.size());
    return new SubBatchOutcome(written, subBatch.fetchErrors(), writeFailed);
  }

  /**
   * Whether a sub-batch failed every entity it was given. A provider that holds entities back for
   * {@link SinkProvider#finishBatch} reports them neither synced nor failed, so a sub-batch with
   * any entity synced or held back made progress even when {@code success} is false.
   */
  private static boolean madeNoProgress(SinkResult written, int entityCount) {
    return !written.isSuccess()
        && written.getSyncedCount() == 0
        && written.getFailedCount() >= entityCount;
  }

  private static EntityInterface loadEntity(String entityLinkStr) {
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(entityLinkStr);
    String fields =
        String.join(",", ReindexingUtil.getSearchIndexFields(entityLink.getEntityType()));
    return Entity.getEntity(entityLink, fields, Include.ALL);
  }

  /** Hands out consecutive slices of the batch's entity links. */
  private static final class SubBatchCursor {
    private final List<String> entityLinks;
    private int position;

    SubBatchCursor(List<String> entityLinks) {
      this.entityLinks = entityLinks;
    }

    boolean hasNext() {
      return position < entityLinks.size();
    }

    List<String> next(int requestedSize) {
      int end = (int) Math.min((long) position + Math.max(1, requestedSize), entityLinks.size());
      List<String> slice = entityLinks.subList(position, end);
      position = end;
      return slice;
    }

    List<String> remaining() {
      return entityLinks.subList(position, entityLinks.size());
    }
  }

  /** Result of a sink run; {@code stopRequested} means an administrator stopped it part-way. */
  private record SinkRun(SinkResult result, boolean stopRequested) {}

  /**
   * Result of one sub-batch; {@code writeFailed} means none of its entities was synced: the provider
   * failed all of them, or none could be loaded.
   */
  private record SubBatchOutcome(
      SinkResult written, List<SinkResult.SinkError> fetchErrors, boolean writeFailed) {}

  /**
   * Running totals for a batch execution. Keeps counts, at most {@link
   * SinkResultSummary#MAX_ERRORS} errors and {@link SinkResultSummary#MAX_COMMIT_IDS} commit ids,
   * so memory stays flat however many entities the batch holds.
   */
  private static final class BatchProgress {
    private final String workflowName;
    private final BooleanSupplier isStopRequested;
    private final List<SinkResult.SinkError> errors = new ArrayList<>();
    private final List<String> commitIds = new ArrayList<>();
    private int syncedCount;
    private int failedCount;
    private int consecutiveFailedSubBatches;
    private boolean success = true;
    private String stopReason;

    BatchProgress(String workflowName, BooleanSupplier isStopRequested) {
      this.workflowName = workflowName;
      this.isStopRequested = isStopRequested;
    }

    void record(SubBatchOutcome outcome) {
      SinkResult written = outcome.written();
      syncedCount += written.getSyncedCount();
      failedCount += written.getFailedCount() + outcome.fetchErrors().size();
      success = success && written.isSuccess() && outcome.fetchErrors().isEmpty();
      addErrors(Optional.ofNullable(written.getErrors()).orElse(List.of()));
      addErrors(outcome.fetchErrors());
      SinkResultSummary.commitIdsOf(written).forEach(this::addCommitId);
      consecutiveFailedSubBatches = outcome.writeFailed() ? consecutiveFailedSubBatches + 1 : 0;
    }

    boolean shouldStop() {
      if (stopReason == null) {
        stopReason = currentStopReason();
        if (stopReason != null) {
          LOG.warn("[{}] Sink stops starting new sub-batches: {}", workflowName, stopReason);
        }
      }
      return stopReason != null;
    }

    private String currentStopReason() {
      return consecutiveFailedSubBatches >= MAX_CONSECUTIVE_FAILED_SUB_BATCHES
          ? "%d consecutive sub-batches failed".formatted(consecutiveFailedSubBatches)
          : stopRequestedReason();
    }

    private String stopRequestedReason() {
      return isStopRequested.getAsBoolean() ? STOP_REQUESTED_REASON : null;
    }

    boolean wasStopRequested() {
      return STOP_REQUESTED_REASON.equals(stopReason);
    }

    void skip(List<String> subBatch) {
      failedCount += subBatch.size();
      success = false;
      String message = "Not synced: %s".formatted(stopReason);
      subBatch.forEach(
          entityLink ->
              addErrors(
                  List.of(
                      SinkResult.SinkError.builder()
                          .entityFqn(entityLink)
                          .errorMessage(message)
                          .build())));
    }

    private void addErrors(List<SinkResult.SinkError> newErrors) {
      for (SinkResult.SinkError error : newErrors) {
        if (errors.size() < SinkResultSummary.MAX_ERRORS) {
          errors.add(
              SinkResult.SinkError.builder()
                  .entityFqn(error.getEntityFqn())
                  .errorMessage(error.getErrorMessage())
                  .errorCode(error.getErrorCode())
                  .build());
        }
      }
    }

    private void addCommitId(String commitId) {
      if (commitIds.size() < SinkResultSummary.MAX_COMMIT_IDS) {
        commitIds.add(commitId);
      }
    }

    SinkResult toResult() {
      return SinkResult.builder()
          .success(success)
          .syncedCount(syncedCount)
          .failedCount(failedCount)
          .errors(errors.isEmpty() ? null : errors)
          .metadata(Map.of(SinkResultSummary.COMMIT_IDS_KEY, List.copyOf(commitIds)))
          .build();
    }
  }

  /** Execute sink in single entity mode - process one entity at a time. */
  private SinkResult executeSingleEntityMode(
      SinkContext context,
      SinkProvider sinkProvider,
      InputNamespaces inputNamespaces,
      WorkflowVariableHandler varHandler) {

    // Get entity from workflow context
    String relatedEntityNamespace = inputNamespaces.namespaceFor(RELATED_ENTITY_VARIABLE);
    String relatedEntityValue =
        (String) varHandler.getNamespacedVariable(relatedEntityNamespace, RELATED_ENTITY_VARIABLE);

    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(relatedEntityValue);
    String fields =
        String.join(",", ReindexingUtil.getSearchIndexFields(entityLink.getEntityType()));
    EntityInterface entity = Entity.getEntity(entityLink, fields, Include.ALL);

    LOG.info(
        "[{}] Executing single entity sink for: {}",
        context.getWorkflowName(),
        entity.getFullyQualifiedName());

    // Execute single entity write
    return sinkProvider.write(context, entity);
  }
}
