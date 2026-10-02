package org.openmetadata.it.util;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.awaitility.Awaitility;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.governance.workflows.WorkflowInstance.WorkflowStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/** Waits on governance workflow runs triggered for an entity. */
public final class WorkflowInstances {
  private static final String WORKFLOW_INSTANCES_PATH = "/v1/governance/workflowInstances";
  // Workflows start from the change event stream, which runs minutes behind under a full parallel
  // run, the same allowance the approval workflow ITs give it
  private static final Duration TIMEOUT = Duration.ofMinutes(5);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(2);
  private static final Duration LOOKBACK = Duration.ofHours(1);

  private WorkflowInstances() {}

  /**
   * Waits until the workflow has run for the entity and no run is still in progress, so a test can
   * change the entity without the workflow overwriting the change afterwards.
   */
  public static void awaitSettled(String entityType, String entityFqn, String workflowName) {
    Awaitility.await(workflowName + " to settle for " + entityFqn)
        .atMost(TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .until(() -> hasSettled(runStatuses(entityType, entityFqn, workflowName)));
  }

  private static boolean hasSettled(List<WorkflowStatus> statuses) {
    return !statuses.isEmpty() && !statuses.contains(WorkflowStatus.RUNNING);
  }

  private static List<WorkflowStatus> runStatuses(
      String entityType, String entityFqn, String workflowName) {
    long now = System.currentTimeMillis();
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("entityLink", String.format("<#E::%s::%s>", entityType, entityFqn))
            .queryParam("workflowDefinitionName", workflowName)
            .queryParam("startTs", String.valueOf(now - LOOKBACK.toMillis()))
            .queryParam("endTs", String.valueOf(now + LOOKBACK.toMillis()))
            .queryParam("limit", "50")
            .build();
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, WORKFLOW_INSTANCES_PATH, null, options);
    List<WorkflowStatus> statuses = new ArrayList<>();
    for (JsonNode run : JsonUtils.readTree(response).path("data")) {
      statuses.add(JsonUtils.treeToValue(run, WorkflowInstance.class).getStatus());
    }
    return statuses;
  }
}
