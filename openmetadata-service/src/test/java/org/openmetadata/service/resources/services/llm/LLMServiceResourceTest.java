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

package org.openmetadata.service.resources.services.llm;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.services.CreateLLMService;
import org.openmetadata.schema.api.services.CreateLLMService.LlmServiceType;
import org.openmetadata.schema.entity.services.LLMService;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.entity.services.connections.TestConnectionResultStatus;
import org.openmetadata.schema.services.connections.llm.OpenAIConnection;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.LLMConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.ServiceResourceTest;
import org.openmetadata.service.resources.services.llm.LLMServiceResource.LLMServiceList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class LLMServiceResourceTest extends ServiceResourceTest<LLMService, CreateLLMService> {
  public LLMServiceResourceTest() {
    super(
        Entity.LLM_SERVICE,
        LLMService.class,
        LLMServiceList.class,
        "services/llmServices",
        LLMServiceResource.FIELDS);
    this.supportsPatch = false;
    supportsSearchIndex = true;
  }

  public void setupLLMServices(TestInfo test) throws HttpResponseException {
    LLMServiceResourceTest llmResourceTest = new LLMServiceResourceTest();
    CreateLLMService createLLMService =
        llmResourceTest
            .createRequest(test, 1)
            .withName("openai")
            .withServiceType(LlmServiceType.OpenAI)
            .withConnection(TestUtils.OPENAI_CONNECTION);

    LLMService llmService =
        new LLMServiceResourceTest().createEntity(createLLMService, ADMIN_AUTH_HEADERS);
    OPENAI_REFERENCE = llmService.getEntityReference();
  }

  @Test
  void post_withoutRequiredFields_400_badRequest(TestInfo test) {
    assertResponse(
        () -> createEntity(createRequest(test).withServiceType(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param serviceType must not be null]");
  }

  @Test
  void post_validService_as_admin_200_ok(TestInfo test) throws IOException {
    Map<String, String> authHeaders = ADMIN_AUTH_HEADERS;
    createAndCheckEntity(createRequest(test, 1).withDescription(null), authHeaders);
    createAndCheckEntity(createRequest(test, 2).withDescription("description"), authHeaders);
    OpenAIConnection openAIConnection =
        new OpenAIConnection().withApiKey("test-key").withBaseURL("https://api.openai.com/v1");
    createAndCheckEntity(
        createRequest(test, 3).withConnection(new LLMConnection().withConfig(openAIConnection)),
        authHeaders);

    createAndCheckEntity(createRequest(test).withConnection(null), ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_updateService_as_admin_2xx(TestInfo test) throws IOException {
    LLMConnection llmConnection =
        new LLMConnection()
            .withConfig(
                new OpenAIConnection()
                    .withApiKey("test-key-1")
                    .withBaseURL("https://api.openai.com/v1"));
    LLMService service =
        createAndCheckEntity(
            createRequest(test).withDescription(null).withConnection(llmConnection),
            ADMIN_AUTH_HEADERS);

    LLMConnection llmConnection1 =
        new LLMConnection()
            .withConfig(
                new OpenAIConnection()
                    .withApiKey("test-key-2")
                    .withBaseURL("https://api.openai.com/v1"));

    CreateLLMService update =
        createRequest(test)
            .withDescription("description1")
            .withConnection(llmConnection1)
            .withName(service.getName());

    ChangeDescription change = getChangeDescription(service, MINOR_UPDATE);
    fieldAdded(change, "description", "description1");
    fieldUpdated(change, "connection", llmConnection, llmConnection1);
    updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_testConnectionResult_200(TestInfo test) throws IOException {
    LLMService service = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    assertNull(service.getTestConnectionResult());
    LLMService updatedService =
        putTestConnectionResult(service.getId(), TEST_CONNECTION_RESULT, ADMIN_AUTH_HEADERS);
    assertNotNull(updatedService.getTestConnectionResult());
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL,
        updatedService.getTestConnectionResult().getStatus());
    assertEquals(updatedService.getConnection(), service.getConnection());
    LLMService stored = getEntity(service.getId(), ADMIN_AUTH_HEADERS);
    assertNotNull(stored.getTestConnectionResult());
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL, stored.getTestConnectionResult().getStatus());
    assertEquals(stored.getConnection(), service.getConnection());
  }

  public LLMService putTestConnectionResult(
      UUID serviceId, TestConnectionResult testConnectionResult, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(serviceId).path("/testConnectionResult");
    return TestUtils.put(target, testConnectionResult, LLMService.class, OK, authHeaders);
  }

  @Override
  public CreateLLMService createRequest(String name) {
    return new CreateLLMService()
        .withName(name)
        .withServiceType(LlmServiceType.OpenAI)
        .withConnection(
            new LLMConnection()
                .withConfig(
                    new OpenAIConnection()
                        .withApiKey("test-api-key")
                        .withBaseURL("https://api.openai.com/v1")));
  }

  @Override
  public void validateCreatedEntity(
      LLMService service, CreateLLMService createRequest, Map<String, String> authHeaders) {
    assertEquals(createRequest.getName(), service.getName());
    LLMConnection expectedConnection = createRequest.getConnection();
    LLMConnection actualConnection = service.getConnection();
    validateConnection(expectedConnection, actualConnection, service.getServiceType());
  }

  @Override
  public void compareEntities(
      LLMService expected, LLMService updated, Map<String, String> authHeaders) {}

  @Override
  public LLMService validateGetWithDifferentFields(LLMService service, boolean byName)
      throws HttpResponseException {
    String fields = "";
    service =
        byName
            ? getEntityByName(service.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    TestUtils.assertListNull(service.getOwners());

    fields = "owners,tags,followers";
    service =
        byName
            ? getEntityByName(service.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    return service;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals("connection")) {
      assertTrue(((String) actual).contains("-encrypted-value"));
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  private void validateConnection(
      LLMConnection expectedConnection,
      LLMConnection actualConnection,
      LlmServiceType llmServiceType) {
    if (expectedConnection != null && actualConnection != null) {
      if (llmServiceType == LlmServiceType.OpenAI) {
        OpenAIConnection expectedOpenAI = (OpenAIConnection) expectedConnection.getConfig();
        OpenAIConnection actualOpenAI;
        if (actualConnection.getConfig() instanceof OpenAIConnection) {
          actualOpenAI = (OpenAIConnection) actualConnection.getConfig();
        } else {
          actualOpenAI =
              JsonUtils.convertValue(actualConnection.getConfig(), OpenAIConnection.class);
        }
        assertEquals(expectedOpenAI.getBaseURL(), actualOpenAI.getBaseURL());
      }
    }
  }
}
