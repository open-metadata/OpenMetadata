/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.resources.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.ai.CreateAIApplication;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.AgentExecution;
import org.openmetadata.schema.entity.ai.ExecutionStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.ai.AgentExecutionResource.AgentExecutionList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
class AgentExecutionResourceTest extends OpenMetadataApplicationTest {

  private static final String collectionName = "agentExecutions";
  private static AIApplication testAgent;
  private static EntityReference testAgentRef;

  @BeforeAll
  public void setup(TestInfo test) throws Exception {
    // We need to create dependencies for AgentExecution
    // Create LLMService, LLMModel, and AIApplication using REST API directly

    // Create LLMService
    org.openmetadata.schema.api.services.CreateLLMService createService =
        new org.openmetadata.schema.api.services.CreateLLMService()
            .withName("test-llm-service-agent-exec")
            .withServiceType(
                org.openmetadata.schema.api.services.CreateLLMService.LlmServiceType.OpenAI)
            .withConnection(
                new org.openmetadata.schema.type.LLMConnection()
                    .withConfig(
                        new org.openmetadata.schema.services.connections.llm.OpenAIConnection()
                            .withApiKey("test-key")
                            .withBaseURL("https://api.openai.com/v1")));
    org.openmetadata.schema.entity.services.LLMService llmService =
        TestUtils.post(
            getResource("services/llmServices"),
            createService,
            org.openmetadata.schema.entity.services.LLMService.class,
            201,
            ADMIN_AUTH_HEADERS);

    // Create LLMModel
    org.openmetadata.schema.api.ai.CreateLLMModel createModel =
        new org.openmetadata.schema.api.ai.CreateLLMModel()
            .withName("test-model-agent-exec")
            .withBaseModel("gpt-4")
            .withService(llmService.getFullyQualifiedName());
    org.openmetadata.schema.entity.ai.LLMModel llmModel =
        TestUtils.post(
            getResource("llmModels"),
            createModel,
            org.openmetadata.schema.entity.ai.LLMModel.class,
            201,
            ADMIN_AUTH_HEADERS);

    // Create AIApplication
    org.openmetadata.schema.entity.ai.ModelConfiguration modelConfig =
        new org.openmetadata.schema.entity.ai.ModelConfiguration()
            .withModel(llmModel.getEntityReference())
            .withPurpose(org.openmetadata.schema.entity.ai.ModelPurpose.Primary);
    CreateAIApplication createAgent =
        new CreateAIApplication()
            .withName("test-agent-for-execution")
            .withApplicationType(org.openmetadata.schema.entity.ai.ApplicationType.Chatbot)
            .withModelConfigurations(new java.util.ArrayList<>(java.util.List.of(modelConfig)));
    testAgent =
        TestUtils.post(
            getResource("aiApplications"),
            createAgent,
            AIApplication.class,
            201,
            ADMIN_AUTH_HEADERS);
    testAgentRef = testAgent.getEntityReference();
  }

  @Test
  void post_agent_execution_200() throws IOException {
    assertNotNull(testAgent, "Test agent should have been created in setup");
    assertNotNull(testAgentRef, "Test agent reference should exist");

    AgentExecution execution = createAgentExecution();
    AgentExecution posted = postAgentExecution(execution, ADMIN_AUTH_HEADERS);
    assertNotNull(posted.getId());
    assertEquals(testAgentRef.getId(), posted.getAgentId());
    assertEquals(execution.getStatus(), posted.getStatus());
    assertEquals(execution.getInput(), posted.getInput());
    assertEquals(execution.getOutput(), posted.getOutput());
  }

  @Test
  void get_agent_executions_by_agent_200() throws IOException {
    AgentExecution execution1 = createAgentExecution();
    AgentExecution execution2 = createAgentExecution();

    postAgentExecution(execution1, ADMIN_AUTH_HEADERS);
    postAgentExecution(execution2, ADMIN_AUTH_HEADERS);

    ResultList<AgentExecution> executions =
        getAgentExecutions(testAgentRef.getId(), null, null, ADMIN_AUTH_HEADERS);

    assertNotNull(executions);
  }

  @Test
  void delete_agent_execution_by_timestamp_200() throws IOException {
    Long timestamp = System.currentTimeMillis();
    AgentExecution execution = createAgentExecution().withTimestamp(timestamp);

    postAgentExecution(execution, ADMIN_AUTH_HEADERS);

    deleteAgentExecutionData(testAgentRef.getId(), timestamp, ADMIN_AUTH_HEADERS);

    ResultList<AgentExecution> executions =
        getAgentExecutions(testAgentRef.getId(), timestamp, timestamp, ADMIN_AUTH_HEADERS);

    assertEquals(0, executions.getData().size());
  }

  private AgentExecution createAgentExecution() {
    return new AgentExecution()
        .withAgent(testAgentRef)
        .withAgentId(testAgentRef.getId())
        .withTimestamp(System.currentTimeMillis())
        .withStatus(ExecutionStatus.Success)
        .withInput("Test input")
        .withOutput("Test output");
  }

  private AgentExecution postAgentExecution(
      AgentExecution agentExecution, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource(collectionName);
    return TestUtils.post(target, agentExecution, AgentExecution.class, 200, authHeaders);
  }

  private ResultList<AgentExecution> getAgentExecutions(
      UUID agentId, Long startTs, Long endTs, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(collectionName);
    target = target.queryParam("agentId", agentId);
    if (startTs != null) {
      target = target.queryParam("startTs", startTs);
    }
    if (endTs != null) {
      target = target.queryParam("endTs", endTs);
    }
    return TestUtils.get(target, AgentExecutionList.class, authHeaders);
  }

  private void deleteAgentExecutionData(
      UUID agentId, Long timestamp, Map<String, String> authHeaders) throws IOException {
    String url = String.format("/%s/%s", agentId, timestamp);
    WebTarget target = getResource(collectionName).path(url);
    TestUtils.delete(target, authHeaders);
  }
}
