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

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MAJOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.core.Response.Status;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.ai.CreateLLMModel;
import org.openmetadata.schema.api.services.CreateLLMService;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.schema.entity.services.LLMService;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.ai.LLMModelResource.LLMModelList;
import org.openmetadata.service.resources.services.llm.LLMServiceResourceTest;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class LLMModelResourceTest extends EntityResourceTest<LLMModel, CreateLLMModel> {

  public LLMModelResourceTest() {
    super(
        Entity.LLM_MODEL, LLMModel.class, LLMModelList.class, "llmModels", LLMModelResource.FIELDS);
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, java.net.URISyntaxException {
    super.setup(test);
  }

  @Test
  void post_validLLMModels_as_admin_200_OK(TestInfo test) throws IOException {
    CreateLLMModel create = createRequest(test);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create.withName(getEntityName(test, 1)).withDescription("description");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_LLMModelWithoutRequiredService_400(TestInfo test) {
    CreateLLMModel create = createRequest(test).withService(null);
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param service must not be null]");
  }

  @Test
  void put_LLMModelUpdateWithNoChange_200(TestInfo test) throws IOException {
    CreateLLMModel request = createRequest(test).withOwners(List.of(USER1_REF));
    LLMModel model = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(model, NO_CHANGE);
    updateAndCheckEntity(request, Status.OK, ADMIN_AUTH_HEADERS, NO_CHANGE, change);
  }

  @Test
  void put_LLMModelUpdateBaseModel_200(TestInfo test) throws IOException {
    CreateLLMModel request = createRequest(test).withBaseModel("gpt-3.5-turbo");
    LLMModel model = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(model, MAJOR_UPDATE);
    fieldUpdated(change, "baseModel", "gpt-3.5-turbo", "gpt-4");
    updateAndCheckEntity(
        request.withBaseModel("gpt-4"), Status.OK, ADMIN_AUTH_HEADERS, MAJOR_UPDATE, change);
  }

  @Test
  void put_LLMModelUpdateModelVersion_200(TestInfo test) throws IOException {
    CreateLLMModel request = createRequest(test).withModelVersion("1.0");
    LLMModel model = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(model, MINOR_UPDATE);
    fieldUpdated(change, "modelVersion", "1.0", "1.1");
    updateAndCheckEntity(
        request.withModelVersion("1.1"), Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_LLMModelUpdateModelProvider_200(TestInfo test) throws IOException {
    CreateLLMModel request = createRequest(test).withModelProvider("OpenAI");
    LLMModel model = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(model, MAJOR_UPDATE);
    fieldUpdated(change, "modelProvider", "OpenAI", "Anthropic");
    updateAndCheckEntity(
        request.withModelProvider("Anthropic"),
        Status.OK,
        ADMIN_AUTH_HEADERS,
        MAJOR_UPDATE,
        change);
  }

  @Test
  void test_inheritDomain(TestInfo test) throws IOException {
    LLMServiceResourceTest serviceTest = new LLMServiceResourceTest();
    CreateLLMService createService =
        serviceTest.createRequest(test).withDomains(List.of(DOMAIN.getFullyQualifiedName()));
    LLMService service = serviceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    CreateLLMModel create = createRequest("model").withService(service.getFullyQualifiedName());
    assertSingleDomainInheritance(create, DOMAIN.getEntityReference());
  }

  @Override
  public LLMModel validateGetWithDifferentFields(LLMModel model, boolean byName)
      throws HttpResponseException {
    String fields = "";
    model =
        byName
            ? getEntityByName(model.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(model.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNull(model.getOwners(), model.getFollowers(), model.getTags());

    fields = "owners,followers,tags";
    model =
        byName
            ? getEntityByName(model.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(model.getId(), fields, ADMIN_AUTH_HEADERS);
    return model;
  }

  @Override
  public CreateLLMModel createRequest(String name) {
    return new CreateLLMModel()
        .withName(name)
        .withBaseModel("gpt-3.5-turbo")
        .withModelProvider("OpenAI")
        .withService(OPENAI_REFERENCE.getFullyQualifiedName());
  }

  @Override
  public void compareEntities(LLMModel expected, LLMModel updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(expected.getBaseModel(), updated.getBaseModel());
    assertEquals(expected.getModelVersion(), updated.getModelVersion());
    assertEquals(expected.getModelProvider(), updated.getModelProvider());
    TestUtils.validateTags(expected.getTags(), updated.getTags());
    TestUtils.validateEntityReferences(updated.getFollowers());
  }

  @Override
  public void validateCreatedEntity(
      LLMModel createdEntity, CreateLLMModel createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(createRequest.getBaseModel(), createdEntity.getBaseModel());
    assertEquals(createRequest.getModelVersion(), createdEntity.getModelVersion());
    assertEquals(createRequest.getModelProvider(), createdEntity.getModelProvider());
    TestUtils.validateTags(createRequest.getTags(), createdEntity.getTags());
    TestUtils.validateEntityReferences(createdEntity.getFollowers());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
