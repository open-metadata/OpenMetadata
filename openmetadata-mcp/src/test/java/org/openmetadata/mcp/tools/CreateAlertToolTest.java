/*
 *  Copyright 2025 Collate
 *  Licensed under the Collate Community License, Version 1.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.FilteringRules;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.events.subscription.EventsSubscriptionRegistry;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.events.subscription.EventSubscriptionResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

class CreateAlertToolTest {

  private Map<String, Object> baseParams() {
    return Map.of(
        "alertName", "demo_alert",
        "resourceType", "ingestionPipeline",
        "resourceFqn", "kestra_demo",
        "eventType", "pipelineFailed",
        "webhookUrl", "http://localhost:9999/hook");
  }

  @Test
  void execute_returnsError_whenAlertNameMissing() throws Exception {
    Map<String, Object> p = new java.util.HashMap<>(baseParams());
    p.remove("alertName");
    Map<String, Object> r =
        new CreateAlertTool()
            .execute(
                mock(Authorizer.class), mock(Limits.class), mock(CatalogSecurityContext.class), p);
    assertEquals("alertName is required", r.get("error"));
  }

  @Test
  void execute_returnsError_whenResourceTypeNotSupported() throws Exception {
    Map<String, Object> p = new java.util.HashMap<>(baseParams());
    p.put("resourceType", "table");
    Map<String, Object> r =
        new CreateAlertTool()
            .execute(
                mock(Authorizer.class), mock(Limits.class), mock(CatalogSecurityContext.class), p);
    assertTrue(r.get("error").toString().contains("ingestionPipeline"));
  }

  @Test
  void execute_returnsError_whenWebhookUrlInvalid() throws Exception {
    Map<String, Object> p = new java.util.HashMap<>(baseParams());
    p.put("webhookUrl", "not-a-url");
    Map<String, Object> r =
        new CreateAlertTool()
            .execute(
                mock(Authorizer.class), mock(Limits.class), mock(CatalogSecurityContext.class), p);
    assertTrue(r.get("error").toString().contains("webhookUrl"));
  }

  @Test
  void execute_returnsError_whenEventTypeNotSupported() throws Exception {
    Map<String, Object> p = new java.util.HashMap<>(baseParams());
    p.put("eventType", "nonsense");
    Map<String, Object> r =
        new CreateAlertTool()
            .execute(
                mock(Authorizer.class), mock(Limits.class), mock(CatalogSecurityContext.class), p);
    assertTrue(r.get("error").toString().contains("pipelineFailed"));
  }

  @Test
  void execute_firstOverload_throwsUnsupportedOperation() {
    assertThrows(
        UnsupportedOperationException.class,
        () ->
            new CreateAlertTool()
                .execute(mock(Authorizer.class), mock(CatalogSecurityContext.class), Map.of()));
  }

  @Test
  void buildRequest_putsFqnInFiltersAndStateInActions() {
    CreateEventSubscription request =
        CreateAlertTool.buildRequest(
            "demo_alert",
            "demo description",
            "service.namespace.flow",
            "pipelineFailed",
            "https://hooks.example.com/x");

    assertEquals(
        CreateEventSubscription.AlertType.OBSERVABILITY,
        request.getAlertType(),
        "Observability alert is required so the ingestionPipeline state action is supported.");

    assertNotNull(request.getInput(), "buildRequest must attach an AlertFilteringInput");

    List<ArgumentsInput> filters = request.getInput().getFilters();
    assertEquals(1, filters.size(), "only filterByFqn belongs in filters");
    ArgumentsInput fqnFilter = findByName(filters, "filterByFqn");
    assertEquals(ArgumentsInput.Effect.INCLUDE, fqnFilter.getEffect());
    assertEquals(List.of("service.namespace.flow"), fqnFilter.getArguments().get(0).getInput());

    List<ArgumentsInput> actions = request.getInput().getActions();
    assertEquals(1, actions.size(), "GetIngestionPipelineStatusUpdates is an action, not a filter");
    ArgumentsInput stateAction = findByName(actions, "GetIngestionPipelineStatusUpdates");
    assertEquals(ArgumentsInput.Effect.INCLUDE, stateAction.getEffect());
    assertEquals(List.of("failed"), stateAction.getArguments().get(0).getInput());
  }

  @Test
  void buildRequest_inputPassesServerSideValidation() throws Exception {
    EventsSubscriptionRegistry.initialize(
        listOrEmpty(EventSubscriptionResource.getNotificationsFilterDescriptors()),
        listOrEmpty(EventSubscriptionResource.getObservabilityFilterDescriptors()));

    CreateEventSubscription request =
        CreateAlertTool.buildRequest(
            "demo_alert",
            "demo description",
            "service.namespace.flow",
            "pipelineFailed",
            "https://hooks.example.com/x");

    FilteringRules rules =
        AlertUtil.validateAndBuildFilteringConditions(
            request.getResources(), request.getAlertType(), request.getInput());

    assertEquals(1, rules.getRules().size());
    assertEquals("filterByFqn", rules.getRules().get(0).getName());
    assertEquals(1, rules.getActions().size());
    assertEquals("GetIngestionPipelineStatusUpdates", rules.getActions().get(0).getName());
  }

  private static ArgumentsInput findByName(List<ArgumentsInput> inputs, String name) {
    return inputs.stream()
        .filter(f -> name.equals(f.getName()))
        .findFirst()
        .orElseThrow(() -> new AssertionError("entry '" + name + "' not found"));
  }
}
