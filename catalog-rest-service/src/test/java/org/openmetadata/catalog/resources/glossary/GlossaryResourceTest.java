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
import static org.openmetadata.catalog.util.TestUtils.assertListNull;
import static org.openmetadata.catalog.util.TestUtils.validateTagLabel;

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
import org.openmetadata.catalog.api.data.CreateGlossaryTerm;
import org.openmetadata.catalog.entity.data.Glossary;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.util.EntityUtil;
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
    supportsEmptyDescription = false;
  }

  public void setupGlossaries() throws IOException {
    GlossaryResourceTest glossaryResourceTest = new GlossaryResourceTest();
    CreateGlossary createGlossary = glossaryResourceTest.createRequest("g1", "", "", null);
    GLOSSARY1 = glossaryResourceTest.createAndCheckEntity(createGlossary, ADMIN_AUTH_HEADERS);
    GLOSSARY1_REF = GLOSSARY1.getEntityReference();

    createGlossary = glossaryResourceTest.createRequest("g2", "", "", null);
    GLOSSARY2 = glossaryResourceTest.createAndCheckEntity(createGlossary, ADMIN_AUTH_HEADERS);
    GLOSSARY2_REF = GLOSSARY2.getEntityReference();

    GlossaryTermResourceTest glossaryTermResourceTest = new GlossaryTermResourceTest();
    CreateGlossaryTerm createGlossaryTerm =
        glossaryTermResourceTest
            .createRequest("g1t1", "", "", null)
            .withRelatedTerms(null)
            .withGlossary(GLOSSARY1_REF)
            .withTags(List.of(PII_SENSITIVE_TAG_LABEL, PERSONAL_DATA_TAG_LABEL));
    GLOSSARY1_TERM1 = glossaryTermResourceTest.createAndCheckEntity(createGlossaryTerm, ADMIN_AUTH_HEADERS);
    GLOSSARY1_TERM1_REF = GLOSSARY1_TERM1.getEntityReference();
    GLOSSARY1_TERM1_LABEL = EntityUtil.getTagLabel(GLOSSARY1_TERM1);
    validateTagLabel(GLOSSARY1_TERM1_LABEL);

    createGlossaryTerm =
        glossaryTermResourceTest
            .createRequest("g2t1", "", "", null)
            .withRelatedTerms(List.of(GLOSSARY1_TERM1_REF))
            .withGlossary(GLOSSARY2_REF);
    GLOSSARY2_TERM1 = glossaryTermResourceTest.createAndCheckEntity(createGlossaryTerm, ADMIN_AUTH_HEADERS);
    GLOSSARY2_TERM1_REF = GLOSSARY2_TERM1.getEntityReference();
    GLOSSARY2_TERM1_LABEL = EntityUtil.getTagLabel(GLOSSARY2_TERM1);
    validateTagLabel(GLOSSARY2_TERM1_LABEL);
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
  public CreateGlossary createRequest(String name) {
    return new CreateGlossary().withName(name);
  }

  @Override
  public void validateCreatedEntity(
      Glossary createdEntity, CreateGlossary createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    TestUtils.validateTags(createRequest.getTags(), createdEntity.getTags());
  }

  @Override
  public void compareEntities(Glossary expected, Glossary patched, Map<String, String> authHeaders)
      throws HttpResponseException {
    // Entity specific validation
    TestUtils.validateTags(expected.getTags(), patched.getTags());
    TestUtils.assertEntityReferenceList(expected.getReviewers(), patched.getReviewers());
  }

  @Override
  public Glossary validateGetWithDifferentFields(Glossary entity, boolean byName) throws HttpResponseException {
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
    // Checks for other owner, tags, and followers is done in the base class
    return entity;
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
      assertEntityReferences(expectedRefs, actualRefs);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
