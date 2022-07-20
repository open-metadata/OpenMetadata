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

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.Entity.FIELD_TAGS;
import static org.openmetadata.catalog.Entity.GLOSSARY;
import static org.openmetadata.catalog.Entity.GLOSSARY_TERM;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityIsNotEmpty;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.glossaryTermMismatch;
import static org.openmetadata.catalog.resources.databases.TableResourceTest.getColumn;
import static org.openmetadata.catalog.type.ColumnDataType.BIGINT;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.assertEntityReferenceList;
import static org.openmetadata.catalog.util.TestUtils.assertListNotEmpty;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertListNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.validateEntityReference;

import java.io.IOException;
import java.net.URI;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateGlossary;
import org.openmetadata.catalog.api.data.CreateGlossaryTerm;
import org.openmetadata.catalog.api.data.CreateTable;
import org.openmetadata.catalog.api.data.TermReference;
import org.openmetadata.catalog.entity.data.Glossary;
import org.openmetadata.catalog.entity.data.GlossaryTerm;
import org.openmetadata.catalog.entity.data.GlossaryTerm.Status;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.databases.TableResourceTest;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.FullyQualifiedName;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.TestUtils;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class GlossaryTermResourceTest extends EntityResourceTest<GlossaryTerm, CreateGlossaryTerm> {
  public GlossaryTermResourceTest() {
    super(
        Entity.GLOSSARY_TERM,
        GlossaryTerm.class,
        GlossaryTermResource.GlossaryTermList.class,
        "glossaryTerms",
        GlossaryTermResource.FIELDS);
    supportsAuthorizedMetadataOperations = false; // TODO why?
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
    GlossaryResourceTest glossaryResourceTest = new GlossaryResourceTest();
    CreateGlossary createGlossary = glossaryResourceTest.createRequest("glossary1", "", "", null);
    Glossary glossary1 = glossaryResourceTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    GlossaryTerm term1 = createTerm(glossary1, null, "term1");
    GlossaryTerm term11 = createTerm(glossary1, term1, "term11");
    GlossaryTerm term12 = createTerm(glossary1, term1, "term12");
    term1.setChildren(List.of(term11.getEntityReference(), term12.getEntityReference()));

    // Create the following glossary
    // glossary2
    // - term2
    //   - term21
    //   - term22
    createGlossary = glossaryResourceTest.createRequest("glossary2", "", "", null);
    Glossary glossary2 = glossaryResourceTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

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
  void patch_addDeleteReviewers(TestInfo test) throws IOException {
    CreateGlossaryTerm create = createRequest(getEntityName(test), "", "", null).withReviewers(null).withSynonyms(null);
    GlossaryTerm term = createEntity(create, ADMIN_AUTH_HEADERS);

    // Add reviewer USER1, synonym1, reference1 in PATCH request
    String origJson = JsonUtils.pojoToJson(term);
    TermReference reference1 = new TermReference().withName("reference1").withEndpoint(URI.create("http://reference1"));
    term.withReviewers(List.of(USER_OWNER1)).withSynonyms(List.of("synonym1")).withReferences(List.of(reference1));
    ChangeDescription change = getChangeDescription(term.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("reviewers").withNewValue(List.of(USER_OWNER1)));
    change.getFieldsAdded().add(new FieldChange().withName("synonyms").withNewValue(List.of("synonym1")));
    change.getFieldsAdded().add(new FieldChange().withName("references").withNewValue(List.of(reference1)));
    term = patchEntityAndCheck(term, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Add reviewer USER2, synonym2, reference2 in PATCH request
    origJson = JsonUtils.pojoToJson(term);
    TermReference reference2 = new TermReference().withName("reference2").withEndpoint(URI.create("http://reference2"));
    term.withReviewers(List.of(USER_OWNER1, USER_OWNER2))
        .withSynonyms(List.of("synonym1", "synonym2"))
        .withReferences(List.of(reference1, reference2));
    change = getChangeDescription(term.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("reviewers").withNewValue(List.of(USER_OWNER2)));
    change.getFieldsAdded().add(new FieldChange().withName("synonyms").withNewValue(List.of("synonym2")));
    change.getFieldsAdded().add(new FieldChange().withName("references").withNewValue(List.of(reference2)));
    term = patchEntityAndCheck(term, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Remove a reviewer USER1, synonym1, reference1 in PATCH request
    origJson = JsonUtils.pojoToJson(term);
    term.withReviewers(List.of(USER_OWNER2)).withSynonyms(List.of("synonym2")).withReferences(List.of(reference2));
    change = getChangeDescription(term.getVersion());
    change.getFieldsDeleted().add(new FieldChange().withName("reviewers").withOldValue(List.of(USER_OWNER1)));
    change.getFieldsDeleted().add(new FieldChange().withName("synonyms").withOldValue(List.of("synonym1")));
    change.getFieldsDeleted().add(new FieldChange().withName("references").withOldValue(List.of(reference1)));
    term = patchEntityAndCheck(term, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Change GlossaryTerm status from DRAFT to Approved
    origJson = JsonUtils.pojoToJson(term);
    term.withStatus(Status.APPROVED);
    change = getChangeDescription(term.getVersion());
    change
        .getFieldsUpdated()
        .add(new FieldChange().withName("status").withOldValue(Status.DRAFT).withNewValue(Status.APPROVED));
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
    change.getFieldsAdded().add(new FieldChange().withName(FIELD_TAGS).withNewValue(List.of(PERSONAL_DATA_TAG_LABEL)));
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
    GlossaryResourceTest glossaryResourceTest = new GlossaryResourceTest();
    CreateGlossary createGlossary = glossaryResourceTest.createRequest(getEntityName(test), "", "", null);
    Glossary g1 = glossaryResourceTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);
    EntityReference g1Ref = g1.getEntityReference();

    // Create glossary term t1 in glossary g1
    CreateGlossaryTerm create = createRequest("t1", "", "", null).withGlossary(g1Ref);
    GlossaryTerm t1 = createEntity(create, ADMIN_AUTH_HEADERS);
    EntityReference tRef1 = t1.getEntityReference();
    TagLabel t1Label = EntityUtil.getTagLabel(t1);

    // Create glossary term t11 under t1
    create = createRequest("t11", "", "", null).withReviewers(null).withGlossary(g1Ref).withParent(tRef1);
    GlossaryTerm t11 = createEntity(create, ADMIN_AUTH_HEADERS);
    EntityReference tRef11 = t11.getEntityReference();
    TagLabel t11Label = EntityUtil.getTagLabel(t11);

    // Create glossary term t111 under t11
    create = createRequest("t111", "", "", null).withReviewers(null).withGlossary(g1Ref).withParent(tRef11);
    GlossaryTerm t111 = createEntity(create, ADMIN_AUTH_HEADERS);
    TagLabel t111Label = EntityUtil.getTagLabel(t111);

    // Assign glossary terms to a table
    // t1 assigned to table. t11 assigned column1 and t111 assigned to column2
    TableResourceTest tableResourceTest = new TableResourceTest();
    List<Column> columns = Arrays.asList(getColumn("c1", BIGINT, t11Label), getColumn("c2", BIGINT, t111Label));
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
    EntityReference glossaryRef = glossary.getEntityReference();
    EntityReference parentRef = parent != null ? parent.getEntityReference() : null;
    CreateGlossaryTerm createGlossaryTerm =
        createRequest(termName, "", "", null).withGlossary(glossaryRef).withParent(parentRef);
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
      assertEntityReferenceList(expected.getChildren(), actual.getChildren());
      assertEntityReferenceList(expected.getReviewers(), actual.getReviewers());
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
        .withReviewers(List.of(USER_OWNER1));
  }

  @Override
  public void validateCreatedEntity(GlossaryTerm entity, CreateGlossaryTerm request, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertReference(request.getParent(), entity.getParent());
    assertReference(request.getGlossary(), entity.getGlossary());

    // Validate fully qualified name
    String fqn =
        entity.getParent() == null
            ? entity.getGlossary().getFullyQualifiedName()
            : entity.getParent().getFullyQualifiedName();
    fqn = FullyQualifiedName.add(fqn, entity.getName());
    assertEquals(fqn, entity.getFullyQualifiedName());

    // Validate glossary that holds this term is present
    validateEntityReference(entity.getGlossary());
    assertTrue(EntityUtil.entityReferenceMatch.test(request.getGlossary(), entity.getGlossary()));

    if (request.getParent() != null) {
      validateEntityReference(entity.getParent());
      assertTrue(EntityUtil.entityReferenceMatch.test(request.getParent(), entity.getParent()));
    }

    assertEntityReferenceList(request.getRelatedTerms(), entity.getRelatedTerms());
    assertEntityReferenceList(request.getReviewers(), entity.getReviewers());

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
        {
          @SuppressWarnings("unchecked")
          List<EntityReference> expectedRefs = (List<EntityReference>) expected;
          List<EntityReference> actualRefs = JsonUtils.readObjects(actual.toString(), EntityReference.class);
          assertEntityReferences(expectedRefs, actualRefs);
          break;
        }
      case "synonyms":
        {
          @SuppressWarnings("unchecked")
          List<String> expectedRefs = (List<String>) expected;
          List<String> actualRefs = JsonUtils.readObjects(actual.toString(), String.class);
          assertStrings(expectedRefs, actualRefs);
          break;
        }
      case "references":
        {
          @SuppressWarnings("unchecked")
          List<TermReference> expectedRefs = (List<TermReference>) expected;
          List<TermReference> actualRefs = JsonUtils.readObjects(actual.toString(), TermReference.class);
          assertTermReferences(expectedRefs, actualRefs);
          break;
        }
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
}
