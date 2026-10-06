package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.ENTITY_LIST_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.FAILURE_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.function.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.openmetadata.service.governance.workflows.BatchExecutionPlan;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler.InputNamespaces;

/**
 * The entities a node handles in a workflow that runs once per batch, see {@link
 * BatchExecutionPlan}. The batch is the list of entity links the node reads from {@code
 * entityList}, in the namespace its input namespace map names and {@code global} by default. A
 * condition writes back the entities that take its continuing branch, and an action the entities
 * it applied to, so every node after them handles exactly those.
 *
 * <p>An entity a node fails on leaves the batch, as it would leave a per-entity run at the error end
 * event, and the rest of the batch goes on. The failure is recorded the way the sink records one:
 * a bounded summary in {@code global_exception} and {@code global_failure} set, which marks the
 * WorkflowInstance failed. An action that fails on every entity of the batch raises the node's
 * runtime error, as it does for one entity.
 */
@Slf4j
final class BatchEntities {
  /** Failed entities named in the recorded summary; the rest are counted. */
  static final int MAX_REPORTED_FAILURES = 20;

  private static final int MAX_FAILURE_MESSAGE_LENGTH = 300;

  private BatchEntities() {}

  /**
   * The batch's entity links when the node handles the whole batch; empty when it handles {@code
   * relatedEntity} alone, as a node deployed per entity or before batch fields existed does.
   */
  static Optional<List<String>> read(
      Expression batchExecutionExpr,
      DelegateExecution execution,
      WorkflowVariableHandler varHandler,
      InputNamespaces namespaces) {
    Optional<List<String>> entityLinks = Optional.empty();
    if (isBatchExecution(batchExecutionExpr, execution)) {
      Object value =
          varHandler.getNamespacedVariable(namespaceOf(namespaces), ENTITY_LIST_VARIABLE);
      // Flowable returns process variables as untyped Object; the periodic trigger stores the
      // batch as a List of entity-link strings.
      if (value instanceof List<?> list && !list.isEmpty()) {
        entityLinks = Optional.of(list.stream().map(String::valueOf).toList());
      }
    }
    return entityLinks;
  }

  /** The outcome a batch condition continues on; null when its continuing edge has no condition. */
  static String continuingOutcome(Expression continuingOutcomeExpr, DelegateExecution execution) {
    return continuingOutcomeExpr != null
        ? (String) continuingOutcomeExpr.getValue(execution)
        : null;
  }

  /**
   * Evaluates a boolean condition for every entity of the batch. The entities whose value equals
   * the continuing outcome stay in the batch; with no continuing outcome every entity evaluated
   * stays. The result takes the continuing outcome when at least one entity matched it and the
   * other value otherwise, so the batch leaves on the continuing branch only when it is not empty.
   * A continuing outcome other than {@code true} reads as {@code false}, as the edge expression
   * coerces it.
   */
  static ConditionOutcome evaluate(
      String nodeName,
      List<String> entityLinks,
      String continuingOutcome,
      Predicate<String> condition) {
    boolean continuingValue = continuingOutcome == null || Boolean.parseBoolean(continuingOutcome);
    Failures failures = new Failures(nodeName, entityLinks.size());
    List<String> evaluated = new ArrayList<>();
    List<String> matched = new ArrayList<>();
    for (String entityLink : entityLinks) {
      try {
        boolean value = condition.test(entityLink);
        evaluated.add(entityLink);
        if (value == continuingValue) {
          matched.add(entityLink);
        }
      } catch (RuntimeException exception) {
        failures.add(entityLink, exception);
      }
    }
    boolean result = matched.isEmpty() ? !continuingValue : continuingValue;
    List<String> continuing = continuingOutcome != null ? matched : evaluated;
    return new ConditionOutcome(result, continuing, failures);
  }

  /** Applies an action to every entity of the batch, each on its own. */
  static ActionOutcome apply(String nodeName, List<String> entityLinks, Consumer<String> action) {
    Failures failures = new Failures(nodeName, entityLinks.size());
    List<String> applied = new ArrayList<>();
    for (String entityLink : entityLinks) {
      try {
        action.accept(entityLink);
        applied.add(entityLink);
      } catch (RuntimeException exception) {
        failures.add(entityLink, exception);
      }
    }
    return new ActionOutcome(applied, failures);
  }

  /** Writes the batch the next nodes handle, when it differs from the one the node read. */
  static void writeIfChanged(
      WorkflowVariableHandler varHandler,
      InputNamespaces namespaces,
      List<String> read,
      List<String> remaining) {
    if (remaining.size() != read.size()) {
      varHandler.setNamespacedVariable(
          namespaceOf(namespaces), ENTITY_LIST_VARIABLE, new ArrayList<>(remaining));
    }
  }

  private static boolean isBatchExecution(
      Expression batchExecutionExpr, DelegateExecution execution) {
    return batchExecutionExpr != null
        && Boolean.parseBoolean((String) batchExecutionExpr.getValue(execution));
  }

  private static String namespaceOf(InputNamespaces namespaces) {
    return namespaces.namespaceForOrDefault(ENTITY_LIST_VARIABLE, GLOBAL_NAMESPACE);
  }

  /** What a batch condition decided: its result, and the entities that stay in the batch. */
  record ConditionOutcome(boolean result, List<String> continuing, Failures failures) {
    void record(WorkflowVariableHandler varHandler, InputNamespaces namespaces, List<String> read) {
      failures.record(varHandler);
      writeIfChanged(varHandler, namespaces, read, continuing);
    }
  }

  /** What a batch action did: the entities it applied to, which stay in the batch. */
  record ActionOutcome(List<String> applied, Failures failures) {
    /** Records the failures and the remaining batch; raises the runtime error if none applied. */
    void record(WorkflowVariableHandler varHandler, InputNamespaces namespaces, List<String> read) {
      failures.record(varHandler);
      if (applied.isEmpty()) {
        throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, failures.summary());
      }
      writeIfChanged(varHandler, namespaces, read, applied);
    }
  }

  /** Counts the entities a node failed on, naming the first {@link #MAX_REPORTED_FAILURES}. */
  static final class Failures {
    private final String nodeName;
    private final int batchSize;
    private final List<String> reported = new ArrayList<>();
    private int count;
    private RuntimeException firstException;

    Failures(String nodeName, int batchSize) {
      this.nodeName = nodeName;
      this.batchSize = batchSize;
    }

    void add(String entityLink, RuntimeException exception) {
      count++;
      if (firstException == null) {
        firstException = exception;
      }
      if (reported.size() < MAX_REPORTED_FAILURES) {
        String message = StringUtils.abbreviate(exception.getMessage(), MAX_FAILURE_MESSAGE_LENGTH);
        reported.add("%s: %s".formatted(entityLink, message));
        LOG.warn("[{}] Failed for {}: {}", nodeName, entityLink, message);
      }
    }

    String summary() {
      String unnamed =
          count > reported.size() ? " (+%d more)".formatted(count - reported.size()) : "";
      return "Node '%s' failed for %d of %d entities of the batch: %s%s"
          .formatted(nodeName, count, batchSize, String.join("; ", reported), unnamed);
    }

    void record(WorkflowVariableHandler varHandler) {
      if (count > 0) {
        LOG.warn("[{}] {}", nodeName, summary());
        varHandler.setGlobalVariable(
            EXCEPTION_VARIABLE,
            "%s%n%s".formatted(summary(), ExceptionUtils.getStackTrace(firstException)));
        // Persisted so the trigger process, which owns the WorkflowInstance, reads it back
        // through the call activity's output mapping.
        varHandler.setGlobalVariable(FAILURE_VARIABLE, true);
      }
    }
  }
}
