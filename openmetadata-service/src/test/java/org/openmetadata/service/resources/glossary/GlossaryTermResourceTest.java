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

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.schema.type.ColumnDataType.BIGINT;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.GLOSSARY;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityIsNotEmpty;
import static org.openmetadata.service.exception.CatalogExceptionMessage.glossaryTermMismatch;
import static org.openmetadata.service.resources.databases.TableResourceTest.getColumn;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.EntityUtil.getId;
import static org.openmetadata.service.util.EntityUtil.toTagLabels;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.service.util.TestUtils.assertListNotEmpty;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.validateEntityReference;

import java.io.IOException;
import java.net.URI;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import javax.ws.rs.core.Response;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.TermReference;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.GlossaryTerm.Status;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;
import org.openmetadata.service.util.TestUtils.UpdateType;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class GlossaryTermResourceTest extends EntityResourceTest<GlossaryTerm, CreateGlossaryTerm> {
  private final GlossaryResourceTest glossaryResourceTest = new GlossaryResourceTest();

  public GlossaryTermResourceTest() {
    super(
        Entity.GLOSSARY_TERM,
        GlossaryTerm.class,
        GlossaryTermResource.GlossaryTermList.class,
        "glossaryTerms",
        GlossaryTermResource.FIELDS);
    supportsEmptyDescription = false;
  }

  @Order(0)
  @Test
  void get_listGlossaryTermsWithDifferentFilters() throws IOException {
    // Create the following glossary
    // glossary1
    // - term1
    //   - term11
    //   - term12
    Glossary glossary1 = createGlossary("glossary1");

    GlossaryTerm term1 = createTerm(glossary1, null, "term1");
    GlossaryTerm term11 = createTerm(glossary1, term1, "term11");
    GlossaryTerm term12 = createTerm(glossary1, term1, "term12");
    term1.setChildren(List.of(term11.getEntityReference(), term12.getEntityReference()));

    // Create the following glossary
    // glossary2
    // - term2
    //   - term21
    //   - term22
    Glossary glossary2 = createGlossary("glossary2");

    GlossaryTerm term2 = createTerm(glossary2, null, "term2");
    GlossaryTerm term21 = createTerm(glossary2, term2, "term21");
    GlossaryTerm term22 = createTerm(glossary2, term2, "term22");
    term2.setChildren(List.of(term21.getEntityReference(), term22.getEntityReference()));

    // List terms without any filters
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("fields", "children,relatedTerms,reviewers,tags");
    ResultList<GlossaryTerm> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    List<GlossaryTerm> expectedTerms =
        Arrays.asList(GLOSSARY1_TERM1, GLOSSARY2_TERM1, term1, term11, term12, term2, term21, term22);
    assertContains(expectedTerms, list.getData());

    // List terms under glossary1
    queryParams = new HashMap<>();
    queryParams.put("fields", "children,relatedTerms,reviewers,tags");
    queryParams.put("glossary", glossary1.getId().toString());
    list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertContains(Arrays.asList(term1, term11, term12), list.getData());

    // List terms under glossary1 parent term1
    queryParams = new HashMap<>();
    queryParams.put("fields", "children,relatedTerms,reviewers,tags");
    queryParams.put("glossary", glossary1.getId().toString());
    queryParams.put("parent", term1.getId().toString());
    list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertContains(Arrays.asList(term11, term12), list.getData());

    // List terms under glossary2
    queryParams = new HashMap<>();
    queryParams.put("fields", "children,relatedTerms,reviewers,tags");
    queryParams.put("glossary", glossary2.getId().toString());
    list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertContains(Arrays.asList(term2, term21, term22), list.getData());

    // List terms under glossary 2 but give glossary term1 in glossary 1 as parent
    queryParams.put("fields", "children,relatedTerms,reviewers,tags");
    queryParams.put("parent", term1.getId().toString());
    Map<String, String> map = Collections.unmodifiableMap(queryParams);
    assertResponse(
        () -> listEntities(map, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        glossaryTermMismatch(term1.getId().toString(), glossary2.getId().toString()));
  }

  @Test
  void test_inheritGlossaryReviewer(TestInfo test) throws IOException {
    //
    // When reviewers are not set for a glossary term, carry it forward from the glossary
    //
    Glossary glossary = createGlossary(test);

    // Create terms t1 and a term t12 under t1 in the glossary without reviewers
    GlossaryTerm t1 = createTerm(glossary, null, "t1", null);
    assertEquals(glossary.getReviewers(), t1.getReviewers()); // Reviewers are inherited

    GlossaryTerm t12 = createTerm(glossary, t1, "t12", null);
    assertEquals(glossary.getReviewers(), t12.getReviewers()); // Reviewers are inherited
  }

  @Test
  void test_commonPrefixTagLabelCount(TestInfo test) throws IOException {
    //
    // Create glossary terms that start with common prefix and make sure usage count is correct
    //
    Glossary glossary = createGlossary(test);

    // Create nested terms a -> aa -> aaa;
    GlossaryTerm a = createTerm(glossary, null, "a", null);
    GlossaryTerm aa = createTerm(glossary, null, "aa", null);
    GlossaryTerm aaa = createTerm(glossary, null, "aaa", null);

    // Apply each of the tag to a table
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable createTable = tableResourceTest.createRequest(getEntityName(test)).withTags(toTagLabels(a, aa, aaa));
    tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Ensure prefix based tagLabel doesn't double count due too common prefix
    for (GlossaryTerm term : List.of(a, aa, aaa)) {
      term = getEntity(term.getId(), "usageCount", ADMIN_AUTH_HEADERS);
      assertEquals(1, term.getUsageCount());
    }
  }

  @Test
  void patch_addDeleteReviewers(TestInfo test) throws IOException {
    CreateGlossaryTerm create = createRequest(getEntityName(test), "", "", null).withReviewers(null).withSynonyms(null);
    GlossaryTerm term = createEntity(create, ADMIN_AUTH_HEADERS);

    // Add reviewer USER1, synonym1, reference1 in PATCH request
    String origJson = JsonUtils.pojoToJson(term);
    TermReference reference1 = new TermReference().withName("reference1").withEndpoint(URI.create("http://reference1"));
    term.withReviewers(List.of(USER1_REF)).withSynonyms(List.of("synonym1")).withReferences(List.of(reference1));
    ChangeDescription change = getChangeDescription(term.getVersion());
    fieldAdded(change, "reviewers", List.of(USER1_REF));
    fieldAdded(change, "synonyms", List.of("synonym1"));
    fieldAdded(change, "references", List.of(reference1));
    term = patchEntityAndCheck(term, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Add reviewer USER2, synonym2, reference2 in PATCH request
    origJson = JsonUtils.pojoToJson(term);
    TermReference reference2 = new TermReference().withName("reference2").withEndpoint(URI.create("http://reference2"));
    term.withReviewers(List.of(USER1_REF, USER2_REF))
        .withSynonyms(List.of("synonym1", "synonym2"))
        .withReferences(List.of(reference1, reference2));
    change = getChangeDescription(term.getVersion());
    fieldAdded(change, "reviewers", List.of(USER2_REF));
    fieldAdded(change, "synonyms", List.of("synonym2"));
    fieldAdded(change, "references", List.of(reference2));
    term = patchEntityAndCheck(term, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Remove a reviewer USER1, synonym1, reference1 in PATCH request
    origJson = JsonUtils.pojoToJson(term);
    term.withReviewers(List.of(USER2_REF)).withSynonyms(List.of("synonym2")).withReferences(List.of(reference2));
    change = getChangeDescription(term.getVersion());
    fieldDeleted(change, "reviewers", List.of(USER1_REF));
    fieldDeleted(change, "synonyms", List.of("synonym1"));
    fieldDeleted(change, "references", List.of(reference1));
    term = patchEntityAndCheck(term, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Change GlossaryTerm status from DRAFT to Approved
    origJson = JsonUtils.pojoToJson(term);
    term.withStatus(Status.APPROVED);
    change = getChangeDescription(term.getVersion());
    fieldUpdated(change, "status", Status.DRAFT, Status.APPROVED);
    patchEntityAndCheck(term, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void patch_addDeleteTags(TestInfo test) throws IOException {
    // Create glossary term1 in glossary g1
    CreateGlossaryTerm create = createRequest(getEntityName(test), "", "", null).withReviewers(null).withSynonyms(null);
    GlossaryTerm term1 = createEntity(create, ADMIN_AUTH_HEADERS);
    EntityReference termRef1 = term1.getEntityReference();

    // Create glossary term11 under term1 in glossary g1
    create = createRequest("t1", "", "", null).withReviewers(null).withSynonyms(null).withParent(termRef1);
    GlossaryTerm term11 = createEntity(create, ADMIN_AUTH_HEADERS);

    // Apply tags to term11
    String json = JsonUtils.pojoToJson(term11);
    ChangeDescription change = new ChangeDescription();
    fieldAdded(change, FIELD_TAGS, List.of(PERSONAL_DATA_TAG_LABEL));
    term11.setTags(List.of(PERSONAL_DATA_TAG_LABEL));
    patchEntityAndCheck(term11, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertEquals(term11.getTags().get(0).getTagFQN(), PERSONAL_DATA_TAG_LABEL.getTagFQN());

    // Apply tags to term1
    json = JsonUtils.pojoToJson(term1);
    term1.setTags(List.of(PERSONAL_DATA_TAG_LABEL));
    patchEntityAndCheck(term1, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // After adding tags to parent, make sure the parent and child still has tags
    term11 = getEntity(term11.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(term11.getTags().get(0).getTagFQN(), PERSONAL_DATA_TAG_LABEL.getTagFQN());

    term1 = getEntity(term1.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(term1.getTags().get(0).getTagFQN(), PERSONAL_DATA_TAG_LABEL.getTagFQN());
  }

  @Test
  void delete_recursive(TestInfo test) throws IOException {
    Glossary g1 = createGlossary(test);
    EntityReference g1Ref = g1.getEntityReference();

    // Create glossary term t1 in glossary g1
    CreateGlossaryTerm create = createRequest("t1", "", "", null).withGlossary(g1Ref);
    GlossaryTerm t1 = createEntity(create, ADMIN_AUTH_HEADERS);
    EntityReference tRef1 = t1.getEntityReference();
    TagLabel t1Label = EntityUtil.toTagLabel(t1);

    // Create glossary term t11 under t1
    create = createRequest("t11with'quote", "", "", null).withReviewers(null).withGlossary(g1Ref).withParent(tRef1);
    GlossaryTerm t11 = createEntity(create, ADMIN_AUTH_HEADERS);
    EntityReference tRef11 = t11.getEntityReference();
    TagLabel t11Label = EntityUtil.toTagLabel(t11);

    // Create glossary term t111 under t11
    create = createRequest("t111", "", "", null).withReviewers(null).withGlossary(g1Ref).withParent(tRef11);
    GlossaryTerm t111 = createEntity(create, ADMIN_AUTH_HEADERS);
    TagLabel t111Label = EntityUtil.toTagLabel(t111);

    // Assign glossary terms to a table
    // t1 assigned to table. t11 assigned column1 and t111 assigned to column2
    TableResourceTest tableResourceTest = new TableResourceTest();
    List<Column> columns = Arrays.asList(getColumn(C1, BIGINT, t11Label), getColumn("c2", BIGINT, t111Label));
    CreateTable createTable =
        tableResourceTest.createRequest("glossaryTermDelTest").withTags(List.of(t1Label)).withColumns(columns);
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    //
    // Glossary that has terms and glossary terms that have children CAN'T BE DELETED without recursive flag
    //

    // g1 glossary is not empty and can't be deleted
    assertResponse(
        () -> glossaryResourceTest.deleteEntity(g1.getId(), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        entityIsNotEmpty(GLOSSARY));

    // t1 is not empty and can't be deleted
    assertResponse(() -> deleteEntity(t1.getId(), ADMIN_AUTH_HEADERS), BAD_REQUEST, entityIsNotEmpty(GLOSSARY_TERM));

    // t11 is not empty and can't be deleted
    assertResponse(() -> deleteEntity(t11.getId(), ADMIN_AUTH_HEADERS), BAD_REQUEST, entityIsNotEmpty(GLOSSARY_TERM));

    //
    // Glossary that has terms and glossary terms that have children CAN BE DELETED recursive flag
    //

    // Delete both t11 and the child t11
    deleteAndCheckEntity(t11, true, true, ADMIN_AUTH_HEADERS);
    assertEntityDeleted(t11.getId(), true);
    assertEntityDeleted(t111.getId(), true);

    // Check to see the tags assigned are deleted
    table = tableResourceTest.getEntity(table.getId(), "tags, columns", ADMIN_AUTH_HEADERS);
    assertTrue(table.getColumns().get(0).getTags().isEmpty()); // tag t11 removed
    assertTrue(table.getColumns().get(1).getTags().isEmpty()); // tag t111 removed
    assertFalse(table.getTags().isEmpty()); // tag t1 still exists

    // Delete the entire glossary
    glossaryResourceTest.deleteAndCheckEntity(g1, true, true, ADMIN_AUTH_HEADERS);
    glossaryResourceTest.assertEntityDeleted(g1.getId(), true);
    assertEntityDeleted(t1.getId(), true);

    // Check to see the tags assigned are deleted
    table = tableResourceTest.getEntity(table.getId(), "tags, columns", ADMIN_AUTH_HEADERS);
    assertTrue(table.getColumns().get(0).getTags().isEmpty()); // tag t11 is removed
    assertTrue(table.getColumns().get(1).getTags().isEmpty()); // tag t111 is removed
    assertTrue(table.getTags().isEmpty()); // tag t1 is removed
  }

  public GlossaryTerm createTerm(Glossary glossary, GlossaryTerm parent, String termName) throws IOException {
    return createTerm(glossary, parent, termName, glossary.getReviewers());
  }

  public GlossaryTerm createTerm(
      Glossary glossary, GlossaryTerm parent, String termName, List<EntityReference> reviewers) throws IOException {
    EntityReference glossaryRef = glossary.getEntityReference();
    // sending required fields only for entity reference
    EntityReference parentRef = reduceEntityReference(parent);
    CreateGlossaryTerm createGlossaryTerm =
        createRequest(termName, "", "", null).withGlossary(glossaryRef).withParent(parentRef).withReviewers(reviewers);
    return createAndCheckEntity(createGlossaryTerm, ADMIN_AUTH_HEADERS);
  }

  public void assertContains(List<GlossaryTerm> expectedTerms, List<GlossaryTerm> actualTerms)
      throws HttpResponseException {
    assertEquals(expectedTerms.size(), actualTerms.size());
    for (GlossaryTerm expected : expectedTerms) {
      GlossaryTerm actual =
          actualTerms.stream().filter(a -> EntityUtil.glossaryTermMatch.test(a, expected)).findAny().orElse(null);
      assertNotNull(actual, "Expected glossaryTerm " + expected.getFullyQualifiedName() + " not found");
      assertEquals(expected.getFullyQualifiedName(), actual.getFullyQualifiedName());
      assertEquals(expected.getSynonyms(), actual.getSynonyms());
      assertEquals(expected.getParent(), actual.getParent());
      TestUtils.assertEntityReferences(expected.getChildren(), actual.getChildren());
      TestUtils.assertEntityReferences(expected.getReviewers(), actual.getReviewers());
      TestUtils.validateTags(expected.getTags(), actual.getTags());
    }
    TestUtils.validateAlphabeticalOrdering(actualTerms, EntityUtil.compareGlossaryTerm);
  }

  @Override
  public CreateGlossaryTerm createRequest(String name) {
    return new CreateGlossaryTerm()
        .withName(name)
        .withSynonyms(List.of("syn1", "syn2", "syn3"))
        .withGlossary(GLOSSARY1_REF)
        .withRelatedTerms(Arrays.asList(GLOSSARY1_TERM1_REF, GLOSSARY2_TERM1_REF))
        .withReviewers(List.of(USER1_REF));
  }

  @Override
  public void validateCreatedEntity(GlossaryTerm entity, CreateGlossaryTerm request, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertReference(request.getParent(), entity.getParent());
    assertReference(request.getGlossary(), entity.getGlossary());

    // Validate fully qualified name
    String fqn =
        entity.getParent() == null
            ? FullyQualifiedName.build(entity.getGlossary().getName(), entity.getName())
            : FullyQualifiedName.add(entity.getParent().getFullyQualifiedName(), entity.getName());
    assertEquals(fqn, entity.getFullyQualifiedName());

    // Validate glossary that holds this term is present
    validateEntityReference(entity.getGlossary());
    assertTrue(EntityUtil.entityReferenceMatch.test(request.getGlossary(), entity.getGlossary()));

    if (request.getParent() != null) {
      validateEntityReference(entity.getParent());
      assertTrue(EntityUtil.entityReferenceMatch.test(request.getParent(), entity.getParent()));
    }

    TestUtils.assertEntityReferences(request.getRelatedTerms(), entity.getRelatedTerms());
    TestUtils.assertEntityReferences(request.getReviewers(), entity.getReviewers());

    // Entity specific validation
    TestUtils.validateTags(request.getTags(), entity.getTags());
  }

  @Override
  public void compareEntities(GlossaryTerm expected, GlossaryTerm patched, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertReference(expected.getGlossary(), patched.getGlossary());
    assertReference(expected.getParent(), patched.getParent());
    assertEquals(expected.getFullyQualifiedName(), patched.getFullyQualifiedName());

    // Entity specific validation
    TestUtils.validateTags(expected.getTags(), patched.getTags());
  }

  @Override
  public GlossaryTerm validateGetWithDifferentFields(GlossaryTerm term, boolean byName) throws HttpResponseException {
    String fields = "";
    term =
        byName
            ? getEntityByName(term.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(term.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNull(term.getChildren(), term.getRelatedTerms(), term.getReviewers(), term.getTags());

    fields = "children,relatedTerms,reviewers,tags";
    term =
        byName
            ? getEntityByName(term.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(term.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(term.getRelatedTerms(), term.getReviewers(), term.getTags());
    assertListNotEmpty(term.getRelatedTerms(), term.getReviewers());
    // Checks for other owner, tags, and followers is done in the base class
    return term;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    switch (fieldName) {
      case "reviewers":
        @SuppressWarnings("unchecked")
        List<EntityReference> expectedRefs = (List<EntityReference>) expected;
        List<EntityReference> actualRefs = JsonUtils.readObjects(actual.toString(), EntityReference.class);
        assertEntityReferences(expectedRefs, actualRefs);
        break;
      case "parent":
      case "glossary":
        EntityReference expectedRef = (EntityReference) expected;
        EntityReference actualRef = JsonUtils.readValue(actual.toString(), EntityReference.class);
        assertEquals(expectedRef.getId(), actualRef.getId());
        break;
      case "synonyms":
        @SuppressWarnings("unchecked")
        List<String> expectedStrings = (List<String>) expected;
        List<String> actualStrings = JsonUtils.readObjects(actual.toString(), String.class);
        assertStrings(expectedStrings, actualStrings);
        break;
      case "references":
        @SuppressWarnings("unchecked")
        List<TermReference> expectedTermRefs = (List<TermReference>) expected;
        List<TermReference> actualTermRefs = JsonUtils.readObjects(actual.toString(), TermReference.class);
        assertTermReferences(expectedTermRefs, actualTermRefs);
        break;
      case "status":
        Status expectedStatus = (Status) expected;
        Status actualStatus = Status.fromValue(actual.toString());
        assertEquals(expectedStatus, actualStatus);
        break;
      default:
        assertCommonFieldChange(fieldName, expected, actual);
        break;
    }
  }

  @Override
  public GlossaryTerm createAndCheckEntity(CreateGlossaryTerm create, Map<String, String> authHeaders)
      throws IOException {
    int termCount = getGlossary(create.getGlossary().getName()).getTermCount();
    GlossaryTerm term = super.createAndCheckEntity(create, authHeaders);
    assertEquals(termCount + 1, getGlossary(create.getGlossary().getName()).getTermCount());
    return term;
  }

  @Override
  public GlossaryTerm updateAndCheckEntity(
      CreateGlossaryTerm request,
      Response.Status status,
      Map<String, String> authHeaders,
      UpdateType updateType,
      ChangeDescription changeDescription)
      throws IOException {
    int termCount = getGlossary(request.getGlossary().getName()).getTermCount();
    GlossaryTerm term = super.updateAndCheckEntity(request, status, authHeaders, updateType, changeDescription);
    if (status == Response.Status.CREATED) {
      assertEquals(termCount + 1, getGlossary(request.getGlossary().getName()).getTermCount());
    }
    return term;
  }

  public void renameGlossaryTermAndCheck(GlossaryTerm term, String newName) throws IOException {
    String oldName = term.getName();
    String json = JsonUtils.pojoToJson(term);
    ChangeDescription change = getChangeDescription(term.getVersion());
    fieldUpdated(change, "name", oldName, newName);
    term.setName(newName);
    term.setFullyQualifiedName(FullyQualifiedName.build(term.getGlossary().getFullyQualifiedName(), newName));
    patchEntityAndCheck(term, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // GET the glossary term and check all the children are renamed
    GlossaryTerm getTerm = getEntity(term.getId(), ADMIN_AUTH_HEADERS);
    for (EntityReference ref : getTerm.getChildren()) {
      assertTrue(ref.getFullyQualifiedName().startsWith(getTerm.getFullyQualifiedName()));
    }

    // List children glossary terms with this term as the parent and ensure rename
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("parent", term.getId().toString());
    List<GlossaryTerm> children = listEntities(queryParams, ADMIN_AUTH_HEADERS).getData();
    for (GlossaryTerm child : listOrEmpty(children)) {
      assertTrue(child.getFullyQualifiedName().startsWith(getTerm.getFullyQualifiedName()));
    }
  }

  public GlossaryTerm moveGlossaryTerm(EntityReference newGlossary, EntityReference newParent, GlossaryTerm term)
      throws IOException {
    EntityReference oldGlossary = term.getGlossary();
    EntityReference oldParent = term.getParent();
    String json = JsonUtils.pojoToJson(term);
    ChangeDescription change = getChangeDescription(term.getVersion());

    // Changes description for glossary term parent change
    UpdateType update = MINOR_UPDATE;
    if (newParent == null && oldParent != null) {
      fieldDeleted(change, "parent", oldParent);
    } else if (oldParent == null && newParent != null) {
      fieldAdded(change, "parent", newParent);
    } else if (Objects.equals(getId(newParent), getId(oldParent))) {
      update = NO_CHANGE;
    } else {
      fieldUpdated(change, "parent", oldParent, newParent);
    }

    // Changes description for glossary change for glossary term
    if (!newGlossary.getId().equals(oldGlossary.getId())) {
      update = MINOR_UPDATE;
      fieldUpdated(change, "glossary", oldGlossary, newGlossary);
    }
    String parentFQN = newParent == null ? newGlossary.getFullyQualifiedName() : newParent.getFullyQualifiedName();
    term.setFullyQualifiedName(FullyQualifiedName.add(parentFQN, term.getName()));
    term.setParent(newParent);
    term.setGlossary(newGlossary);
    term = patchEntityAndCheck(term, json, ADMIN_AUTH_HEADERS, update, change);
    assertChildrenFqnChanged(term);
    return term;
  }

  public void assertChildrenFqnChanged(GlossaryTerm term) throws HttpResponseException {
    // GET the glossary term and check all the children are renamed
    GlossaryTerm newTerm = getEntity(term.getId(), ADMIN_AUTH_HEADERS);
    for (EntityReference ref : newTerm.getChildren()) {
      assertTrue(ref.getFullyQualifiedName().startsWith(newTerm.getFullyQualifiedName()));
    }

    // List children glossary terms with this term as the parent and ensure rename
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("parent", term.getId().toString());
    List<GlossaryTerm> children = listEntities(queryParams, ADMIN_AUTH_HEADERS).getData();
    for (GlossaryTerm child : listOrEmpty(children)) {
      assertTrue(child.getFullyQualifiedName().startsWith(newTerm.getFullyQualifiedName()));
    }
  }

  public Glossary createGlossary(TestInfo test) throws IOException {
    return createGlossary(glossaryResourceTest.getEntityName(test));
  }

  public Glossary createGlossary(String name) throws IOException {
    CreateGlossary create = glossaryResourceTest.createRequest(name);
    return glossaryResourceTest.createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  public Glossary getGlossary(String name) throws IOException {
    return glossaryResourceTest.getEntityByName(name, glossaryResourceTest.getAllowedFields(), ADMIN_AUTH_HEADERS);
  }
}
