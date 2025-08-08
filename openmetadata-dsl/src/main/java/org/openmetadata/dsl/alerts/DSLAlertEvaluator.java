package org.openmetadata.dsl.alerts;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.dsl.core.DSLAction;
import org.openmetadata.dsl.core.DSLCondition;
import org.openmetadata.dsl.core.DSLExecutionContext;
import org.openmetadata.dsl.engines.SmartAlertsEngine;
import org.openmetadata.schema.type.ChangeEvent;

@Slf4j
public class DSLAlertEvaluator {
  private final SmartAlertsEngine smartAlertsEngine;
  @Getter private final AlertExecutionMetrics metrics;

  public DSLAlertEvaluator(SmartAlertsEngine smartAlertsEngine) {
    this.smartAlertsEngine = smartAlertsEngine;
    this.metrics = new AlertExecutionMetrics();
  }

  public AlertEvaluationResult evaluateAlert(DSLAlert alert, ChangeEvent changeEvent) {
    long startTime = System.currentTimeMillis();

    try {
      // Create execution context with the change event
      DSLExecutionContext context = createExecutionContext(changeEvent, alert);

      // Evaluate the condition
      boolean conditionMet = evaluateCondition(alert.getCondition(), context);

      AlertEvaluationResult result =
          AlertEvaluationResult.builder()
              .alertId(alert.getId())
              .conditionMet(conditionMet)
              .executionTime(System.currentTimeMillis() - startTime)
              .context(context)
              .build();

      if (conditionMet) {
        // Execute actions asynchronously
        List<ActionExecutionResult> actionResults = executeActions(alert.getActions(), context);
        result.setActionResults(actionResults);

        metrics.recordAlertTriggered(alert.getId());
        log.info("Alert '{}' triggered for event: {}", alert.getName(), changeEvent.getId());
      }

      metrics.recordEvaluation(alert.getId(), result.getExecutionTime(), conditionMet);
      return result;

    } catch (Exception e) {
      log.error("Error evaluating alert '{}': {}", alert.getName(), e.getMessage(), e);
      metrics.recordError(alert.getId(), e);
      return AlertEvaluationResult.builder()
          .alertId(alert.getId())
          .conditionMet(false)
          .executionTime(System.currentTimeMillis() - startTime)
          .error(e.getMessage())
          .build();
    }
  }

  private boolean evaluateCondition(DSLCondition condition, DSLExecutionContext context) {
    return smartAlertsEngine.withContext(context).evaluate(condition);
  }

  private List<ActionExecutionResult> executeActions(
      List<DSLAction> actions, DSLExecutionContext context) {
    List<ActionExecutionResult> results = new ArrayList<>();
    List<CompletableFuture<ActionExecutionResult>> futures = new ArrayList<>();

    for (DSLAction action : actions) {
      CompletableFuture<ActionExecutionResult> future =
          CompletableFuture.supplyAsync(() -> executeAction(action, context))
              .exceptionally(
                  throwable -> {
                    log.error("Action execution failed: {}", throwable.getMessage(), throwable);
                    return ActionExecutionResult.builder()
                        .action(action)
                        .success(false)
                        .error(throwable.getMessage())
                        .executionTime(0L)
                        .build();
                  });
      futures.add(future);
    }

    // Wait for all actions to complete
    CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

    for (CompletableFuture<ActionExecutionResult> future : futures) {
      try {
        results.add(future.get());
      } catch (Exception e) {
        log.error("Failed to get action result: {}", e.getMessage(), e);
      }
    }

    return results;
  }

  private ActionExecutionResult executeAction(DSLAction action, DSLExecutionContext context) {
    long startTime = System.currentTimeMillis();

    try {
      smartAlertsEngine.withContext(context).execute(action);
      Object result = null;

      return ActionExecutionResult.builder()
          .action(action)
          .success(true)
          .result(result)
          .executionTime(System.currentTimeMillis() - startTime)
          .build();

    } catch (Exception e) {
      return ActionExecutionResult.builder()
          .action(action)
          .success(false)
          .error(e.getMessage())
          .executionTime(System.currentTimeMillis() - startTime)
          .build();
    }
  }

  private DSLExecutionContext createExecutionContext(ChangeEvent changeEvent, DSLAlert alert) {
    Map<String, Object> variables = new HashMap<>();
    variables.put("changeEvent", changeEvent);
    variables.put("entityType", changeEvent.getEntityType());
    variables.put("eventType", changeEvent.getEventType());
    variables.put("timestamp", changeEvent.getTimestamp());
    variables.put("userName", changeEvent.getUserName());
    variables.put("alert", alert);

    // Add entity-specific context
    if (changeEvent.getEntity() != null) {
      variables.put("entity", changeEvent.getEntity());
    }

    return DSLExecutionContext.builder().variables(variables).build();
  }

  // Batch evaluation for multiple alerts
  public List<AlertEvaluationResult> evaluateAlerts(
      List<DSLAlert> alerts, ChangeEvent changeEvent) {
    List<AlertEvaluationResult> results = new ArrayList<>();

    for (DSLAlert alert : alerts) {
      if (alert.isEnabled()) {
        results.add(evaluateAlert(alert, changeEvent));
      }
    }

    return results;
  }

  // Check if alert should be throttled
  public boolean shouldThrottle(DSLAlert alert, ChangeEvent changeEvent) {
    if (alert.getThrottling() == null || !alert.getThrottling().isEnabled()) {
      return false;
    }

    return metrics.shouldThrottle(
        alert.getId(), alert.getThrottling().getDuration(), alert.getThrottling().getMaxAlerts());
  }
}
