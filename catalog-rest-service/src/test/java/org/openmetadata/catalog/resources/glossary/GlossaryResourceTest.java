/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.resources.glossary;

import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertListNull;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Map;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateGlossary;
import org.openmetadata.catalog.entity.data.Glossary;
import org.openmetadata.catalog.jdbi3.GlossaryRepository.GlossaryEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.TestUtils.UpdateType;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class GlossaryResourceTest extends EntityResourceTest<Glossary, CreateGlossary> {
  public GlossaryResourceTest() {
    super(Entity.GLOSSARY, Glossary.class, GlossaryResource.GlossaryList.class, "glossaries", GlossaryResource.FIELDS);
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);
  }

  @Test
  void patch_addDeleteReviewers(TestInfo test) throws IOException {
    CreateGlossary create = createRequest(getEntityName(test), "", "", null);
    Glossary glossary = createEntity(create, ADMIN_AUTH_HEADERS);

    // Add reviewer USER1 in PATCH request
    String origJson = JsonUtils.pojoToJson(glossary);
    glossary.withReviewers(List.of(USER_OWNER1));
    ChangeDescription change = getChangeDescription(glossary.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("reviewers").withNewValue(List.of(USER_OWNER1)));
    glossary = patchEntityAndCheck(glossary, origJson, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);

    // Add another reviewer USER2 in PATCH request
    origJson = JsonUtils.pojoToJson(glossary);
    glossary.withReviewers(List.of(USER_OWNER1, USER_OWNER2));
    change = getChangeDescription(glossary.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("reviewers").withNewValue(List.of(USER_OWNER2)));
    glossary = patchEntityAndCheck(glossary, origJson, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);

    // Remove a reviewer USER1 in PATCH request
    origJson = JsonUtils.pojoToJson(glossary);
    glossary.withReviewers(List.of(USER_OWNER2));
    change = getChangeDescription(glossary.getVersion());
    change.getFieldsDeleted().add(new FieldChange().withName("reviewers").withOldValue(List.of(USER_OWNER1)));
    patchEntityAndCheck(glossary, origJson, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);
  }

  @Override
  public CreateGlossary createRequest(String name, String description, String displayName, EntityReference owner) {
    return new CreateGlossary()
        .withName(name)
        .withDescription(description)
        .withDisplayName(displayName)
        .withOwner(owner);
  }

  @Override
  public void validateCreatedEntity(
      Glossary createdEntity, CreateGlossary createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(createdEntity),
        createRequest.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        createRequest.getOwner());

    // Entity specific validation
    TestUtils.validateTags(createRequest.getTags(), createdEntity.getTags());
  }

  @Override
  public void compareEntities(Glossary expected, Glossary patched, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(patched),
        expected.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        expected.getOwner());

    // Entity specific validation
    TestUtils.validateTags(expected.getTags(), patched.getTags());
    TestUtils.assertEntityReferenceList(expected.getReviewers(), patched.getReviewers());
  }

  @Override
  public GlossaryEntityInterface getEntityInterface(Glossary entity) {
    return new GlossaryEntityInterface(entity);
  }

  @Override
  public void validateGetWithDifferentFields(Glossary entity, boolean byName) throws HttpResponseException {
    String fields = "";
    entity =
        byName
            ? getEntityByName(entity.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNull(entity.getOwner(), entity.getTags());

    fields = "owner,tags";
    entity =
        byName
            ? getEntityByName(entity.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(entity.getOwner(), entity.getTags());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals("reviewers")) {
      @SuppressWarnings("unchecked")
      List<EntityReference> expectedRefs = (List<EntityReference>) expected;
      List<EntityReference> actualRefs = JsonUtils.readObjects(actual.toString(), EntityReference.class);
      assertEntityReferencesFieldChange(expectedRefs, actualRefs);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
