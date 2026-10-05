package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;

/** Checklist metadata is preserved across creation, reads and ordinary canvas updates. */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class LifecycleWorkflowConfigurationIT {
  private static final String WORKFLOWS = "/v1/governance/workflowDefinitions";
  private static final String LIFECYCLE = "/config/lifecycle";

  @Test
  void preservesChecklistMetadataAcrossApiUpdates(TestNamespace ns) {
    final ObjectNode request = request(ns);
    final JsonNode created = execute(HttpMethod.POST, WORKFLOWS, request);
    final String path = WORKFLOWS + "/" + created.get("id").asText();
    try {
      final JsonNode read = execute(HttpMethod.GET, path, null);
      assertChecks(read);
      final JsonNode updated =
          execute(
              HttpMethod.PATCH,
              path,
              JsonUtils.readTree(
                  "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"Canvas edit\"}]"));
      assertChecks(updated);
      assertEquals("Canvas edit", updated.get("description").asText());
      assertTrue(updated.get("version").asDouble() > created.get("version").asDouble());
    } finally {
      execute(HttpMethod.DELETE, path + "?hardDelete=true&recursive=true", null);
    }
  }

  @Test
  void rejectsUnknownChecklistRequirement(TestNamespace ns) {
    final ObjectNode request = request(ns);
    ((ObjectNode) request.at(LIFECYCLE + "/gates/0/checks/0")).put("requirement", "silently-pass");
    final OpenMetadataException rejected =
        assertThrows(
            OpenMetadataException.class, () -> execute(HttpMethod.POST, WORKFLOWS, request));
    assertTrue(List.of(400, 422).contains(rejected.getStatusCode()));
  }

  private static void assertChecks(JsonNode workflow) {
    final JsonNode check = workflow.at(LIFECYCLE + "/gates/0/checks/0");
    assertEquals("extension.limit", check.get("field").asText());
    assertEquals("recommended", check.get("requirement").asText());
    assertEquals("number", check.get("valueType").asText());
    assertEquals("Zero is a valid limit", check.get("guidance").asText());
    assertEquals("0", check.get("example").asText());
    assertEquals("{\"==\":[{\"var\":\"critical\"},true]}", check.get("appliesWhen").asText());
  }

  private static ObjectNode request(TestNamespace ns) {
    final ObjectNode request =
        (ObjectNode)
            JsonUtils.readTree(
                """
        {
          "name": "placeholder", "description": "Checklist persistence",
          "trigger": {"type":"eventBasedEntity","config":{},"output":[]},
          "nodes":[], "edges":[],
          "config":{"storeStageStatus":true,"lifecycle":{
            "version":1,"entityType":"dataProduct","gates":[{
              "stage":"Draft","checks":[{
                "field":"extension.limit","requirement":"recommended","valueType":"number",
                "guidance":"Zero is a valid limit","example":"0",
                "appliesWhen":"{\\\"==\\\":[{\\\"var\\\":\\\"critical\\\"},true]}"
              }]
            }]
          }}
        }
        """);
    request.put("name", ns.prefix("lifecycleMetadata"));
    return request;
  }

  private static JsonNode execute(HttpMethod method, String path, Object body) {
    return JsonUtils.readTree(
        SdkClients.adminClient().getHttpClient().executeForString(method, path, body));
  }
}
