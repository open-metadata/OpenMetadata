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

package org.openmetadata.service.resources.glossary;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.schema.type.ProviderType.SYSTEM;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.validateTagLabel;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.ws.rs.core.Response.Status;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.TestUtils;
import org.openmetadata.service.util.TestUtils.UpdateType;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class GlossaryResourceTest extends EntityResourceTest<Glossary, CreateGlossary> {
  public GlossaryResourceTest() {
    // TODO add system glossary
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
            .withTags(List.of(PII_SENSITIVE_TAG_LABEL, PERSONAL_DATA_TAG_LABEL))
            .withReviewers(GLOSSARY1.getReviewers());
    GLOSSARY1_TERM1 = glossaryTermResourceTest.createAndCheckEntity(createGlossaryTerm, ADMIN_AUTH_HEADERS);
    GLOSSARY1_TERM1_REF = GLOSSARY1_TERM1.getEntityReference();
    GLOSSARY1_TERM1_LABEL = EntityUtil.getTagLabel(GLOSSARY1_TERM1);
    validateTagLabel(GLOSSARY1_TERM1_LABEL);

    createGlossaryTerm =
        glossaryTermResourceTest
            .createRequest("g2t1", "", "", null)
            .withRelatedTerms(List.of(GLOSSARY1_TERM1_REF))
            .withGlossary(GLOSSARY2_REF)
            .withReviewers(GLOSSARY1.getReviewers());
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
    glossary.withReviewers(List.of(USER1_REF));
    ChangeDescription change = getChangeDescription(glossary.getVersion());
    fieldAdded(change, "reviewers", List.of(USER1_REF));
    glossary = patchEntityAndCheck(glossary, origJson, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);

    // Add another reviewer USER2 in PATCH request
    origJson = JsonUtils.pojoToJson(glossary);
    glossary.withReviewers(List.of(USER1_REF, USER2_REF));
    change = getChangeDescription(glossary.getVersion());
    fieldAdded(change, "reviewers", List.of(USER2_REF));
    glossary = patchEntityAndCheck(glossary, origJson, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);

    // Remove a reviewer USER1 in PATCH request
    origJson = JsonUtils.pojoToJson(glossary);
    glossary.withReviewers(List.of(USER2_REF));
    change = getChangeDescription(glossary.getVersion());
    fieldDeleted(change, "reviewers", List.of(USER1_REF));
    patchEntityAndCheck(glossary, origJson, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);
  }

  @Test
  void patch_renameSystemGlossary_400() throws IOException {
    // Renaming of system glossary and terms are not allowed
    CreateGlossary create = createRequest("renameGlossaryNotAllowed").withProvider(ProviderType.SYSTEM);
    Glossary glossary = createEntity(create, ADMIN_AUTH_HEADERS);

    GlossaryTermResourceTest glossaryTermResourceTest = new GlossaryTermResourceTest();
    GlossaryTerm t1 = createGlossaryTerm(glossaryTermResourceTest, glossary, null, "t1", SYSTEM);

    assertResponse(
        () -> glossaryTermResourceTest.renameGlossaryTermAndCheck(t1, "newT1"),
        Status.BAD_REQUEST,
        CatalogExceptionMessage.systemEntityRenameNotAllowed("t1", Entity.GLOSSARY_TERM));

    assertResponse(
        () -> renameGlossaryAndCheck(glossary, "new.renameGlossaryNotAllowed"),
        Status.BAD_REQUEST,
        CatalogExceptionMessage.systemEntityRenameNotAllowed("renameGlossaryNotAllowed", Entity.GLOSSARY));
  }

  @Test
  void patch_renameGlossary(TestInfo test) throws IOException {
    // Create glossary with terms t1, t2
    // Create children terms t11, t12 under t1
    // Create children terms t21, t22 under t2
    CreateGlossary create = createRequest("renameGlossary");
    Glossary glossary = createEntity(create, ADMIN_AUTH_HEADERS);

    GlossaryTermResourceTest glossaryTermResourceTest = new GlossaryTermResourceTest();
    GlossaryTerm t1 = createGlossaryTerm(glossaryTermResourceTest, glossary, null, "t1");
    GlossaryTerm t11 = createGlossaryTerm(glossaryTermResourceTest, glossary, t1, "t11");
    GlossaryTerm t12 = createGlossaryTerm(glossaryTermResourceTest, glossary, t1, "t12");
    GlossaryTerm t2 = createGlossaryTerm(glossaryTermResourceTest, glossary, null, "t2");
    GlossaryTerm t21 = createGlossaryTerm(glossaryTermResourceTest, glossary, t2, "t21");
    GlossaryTerm t22 = createGlossaryTerm(glossaryTermResourceTest, glossary, t2, "t22");

    // Create a table with all the terms as tag labels
    TableResourceTest tableResourceTest = new TableResourceTest();
    List<TagLabel> tagLabels = toTagLabels(t1, t11, t12, t2, t21, t22);
    Column column = new Column().withName("c1").withDataType(ColumnDataType.INT).withTags(tagLabels);
    CreateTable createTable =
        tableResourceTest.createRequest(getEntityName(test)).withTags(tagLabels).withColumns(CommonUtil.listOf(column));
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    //
    // Change the glossary term t2 to newt2 and ensure the children t21 and t22 FQNs are changed
    // Also ensure the table tag label names are also changed
    //
    glossaryTermResourceTest.renameGlossaryTermAndCheck(t2, "newt2");
    table = tableResourceTest.getEntity(table.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    assertTagPrefixAbsent(table.getTags(), "renameGlossary.t2");
    assertTagPrefixAbsent(table.getColumns().get(0).getTags(), "renameGlossary.t2");

    //
    // Change the glossary renameGlossary to newRenameGlossary and ensure the children FQNs are changed
    // Also ensure the table tag label names are also changed
    //
    renameGlossaryAndCheck(glossary, "newRenameGlossary");
    table = tableResourceTest.getEntity(table.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    assertTagPrefixAbsent(table.getTags(), "renameGlossary");
    assertTagPrefixAbsent(table.getColumns().get(0).getTags(), "renameGlossary");
  }

  @Override
  public CreateGlossary createRequest(String name) {
    return new CreateGlossary().withName(name).withDescription("d");
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
    TestUtils.assertEntityReferences(expected.getReviewers(), patched.getReviewers());
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

  private GlossaryTerm createGlossaryTerm(
      GlossaryTermResourceTest resource, Glossary glossary, GlossaryTerm parent, String name)
      throws HttpResponseException {
    return createGlossaryTerm(resource, glossary, parent, name, ProviderType.USER);
  }

  private GlossaryTerm createGlossaryTerm(
      GlossaryTermResourceTest resource, Glossary glossary, GlossaryTerm parent, String name, ProviderType provider)
      throws HttpResponseException {
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(name)
            .withDescription("d")
            .withGlossary(glossary.getEntityReference())
            .withParent(parent == null ? null : parent.getEntityReference())
            .withProvider(provider);
    return resource.createEntity(create, ADMIN_AUTH_HEADERS);
  }

  public static List<TagLabel> toTagLabels(GlossaryTerm... terms) {
    List<TagLabel> list = new ArrayList<>();
    for (GlossaryTerm term : terms) {
      list.add(new TagLabel().withTagFQN(term.getFullyQualifiedName()).withSource(TagSource.GLOSSARY));
    }
    return list;
  }

  public void renameGlossaryAndCheck(Glossary glossary, String newName) throws IOException {
    String oldName = glossary.getName();
    String json = JsonUtils.pojoToJson(glossary);
    ChangeDescription change = getChangeDescription(glossary.getVersion());
    fieldUpdated(change, "name", oldName, newName);
    glossary.setName(newName);
    patchEntityAndCheck(glossary, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    Glossary ret = getEntity(glossary.getId(), ADMIN_AUTH_HEADERS);

    // Now check all the children are renamed
    // List children glossary terms with this term as the parent and ensure rename
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("glossary", ret.getId().toString());
    List<GlossaryTerm> children =
        new GlossaryTermResourceTest().listEntities(queryParams, ADMIN_AUTH_HEADERS).getData();
    for (GlossaryTerm child : listOrEmpty(children)) {
      assertTrue(child.getFullyQualifiedName().startsWith(ret.getFullyQualifiedName()));
    }
  }

  private void assertTagPrefixAbsent(List<TagLabel> labels, String prefix) {
    for (TagLabel tag : labels) {
      assertFalse(tag.getTagFQN().startsWith(prefix), tag.getTagFQN());
    }
  }
}
