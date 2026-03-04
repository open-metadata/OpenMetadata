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
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.service.util.TestUtils.assertListNull;

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
import org.openmetadata.schema.api.ai.CreatePromptTemplate;
import org.openmetadata.schema.api.ai.CreatePromptTemplate.TemplateType;
import org.openmetadata.schema.entity.ai.PromptTemplate;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.ai.PromptTemplateResource.PromptTemplateList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class PromptTemplateResourceTest
    extends EntityResourceTest<PromptTemplate, CreatePromptTemplate> {

  public PromptTemplateResourceTest() {
    super(
        Entity.PROMPT_TEMPLATE,
        PromptTemplate.class,
        PromptTemplateList.class,
        "promptTemplates",
        PromptTemplateResource.FIELDS);
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, java.net.URISyntaxException {
    super.setup(test);
  }

  @Test
  void post_validPromptTemplates_as_admin_200_OK(TestInfo test) throws IOException {
    CreatePromptTemplate create = createRequest(test);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create.withName(getEntityName(test, 1)).withDescription("description");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_PromptTemplateUpdateWithNoChange_200(TestInfo test) throws IOException {
    CreatePromptTemplate request = createRequest(test).withOwners(List.of(USER1_REF));
    PromptTemplate template = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(template, NO_CHANGE);
    updateAndCheckEntity(request, Status.OK, ADMIN_AUTH_HEADERS, NO_CHANGE, change);
  }

  @Test
  void put_PromptTemplateUpdateContent_200(TestInfo test) throws IOException {
    CreatePromptTemplate request = createRequest(test).withTemplateContent("Hello {name}");
    PromptTemplate template = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(template, MINOR_UPDATE);
    fieldUpdated(change, "templateContent", "Hello {name}", "Hi {name}, welcome!");
    updateAndCheckEntity(
        request.withTemplateContent("Hi {name}, welcome!"),
        Status.OK,
        ADMIN_AUTH_HEADERS,
        MINOR_UPDATE,
        change);
  }

  @Test
  void put_PromptTemplateUpdateSystemPrompt_200(TestInfo test) throws IOException {
    CreatePromptTemplate request = createRequest(test).withSystemPrompt("You are helpful");
    PromptTemplate template = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(template, MINOR_UPDATE);
    fieldUpdated(change, "systemPrompt", "You are helpful", "You are an expert");
    updateAndCheckEntity(
        request.withSystemPrompt("You are an expert"),
        Status.OK,
        ADMIN_AUTH_HEADERS,
        MINOR_UPDATE,
        change);
  }

  @Test
  void put_PromptTemplateUpdateVersion_200(TestInfo test) throws IOException {
    CreatePromptTemplate request = createRequest(test).withTemplateVersion("1.0");
    PromptTemplate template = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(template, MINOR_UPDATE);
    fieldUpdated(change, "templateVersion", "1.0", "1.1");
    updateAndCheckEntity(
        request.withTemplateVersion("1.1"), Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Override
  public PromptTemplate validateGetWithDifferentFields(PromptTemplate template, boolean byName)
      throws HttpResponseException {
    String fields = "";
    template =
        byName
            ? getEntityByName(template.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(template.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNull(template.getOwners(), template.getFollowers());

    fields = "owners,followers,tags,extension,domains";
    template =
        byName
            ? getEntityByName(template.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(template.getId(), fields, ADMIN_AUTH_HEADERS);
    return template;
  }

  @Override
  public CreatePromptTemplate createRequest(String name) {
    return new CreatePromptTemplate()
        .withName(name)
        .withTemplateContent("Hello {name}")
        .withSystemPrompt("You are a helpful assistant")
        .withTemplateType(TemplateType.CHAT_COMPLETION);
  }

  @Override
  public void compareEntities(
      PromptTemplate expected, PromptTemplate updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(expected.getTemplateContent(), updated.getTemplateContent());
    assertEquals(expected.getSystemPrompt(), updated.getSystemPrompt());
    assertEquals(expected.getTemplateType().toString(), updated.getTemplateType().toString());
    assertEquals(expected.getTemplateVersion(), updated.getTemplateVersion());
    TestUtils.validateTags(expected.getTags(), updated.getTags());
    TestUtils.validateEntityReferences(updated.getFollowers());
  }

  @Override
  public void validateCreatedEntity(
      PromptTemplate createdEntity,
      CreatePromptTemplate createRequest,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(createRequest.getTemplateContent(), createdEntity.getTemplateContent());
    assertEquals(createRequest.getSystemPrompt(), createdEntity.getSystemPrompt());
    assertEquals(
        createRequest.getTemplateType().toString(), createdEntity.getTemplateType().toString());
    assertEquals(createRequest.getTemplateVersion(), createdEntity.getTemplateVersion());
    TestUtils.validateTags(createRequest.getTags(), createdEntity.getTags());
    TestUtils.validateEntityReferences(createdEntity.getFollowers());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals("templateType")) {
      assertEquals(expected.toString(), actual.toString(), "Field name " + fieldName);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
