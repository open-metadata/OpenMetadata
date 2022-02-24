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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.glossaryTermMismatch;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.assertEntityReferenceList;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertListNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.validateEntityReference;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateGlossary;
import org.openmetadata.catalog.api.data.CreateGlossaryTerm;
import org.openmetadata.catalog.entity.data.Glossary;
import org.openmetadata.catalog.entity.data.GlossaryTerm;
import org.openmetadata.catalog.jdbi3.GlossaryRepository.GlossaryEntityInterface;
import org.openmetadata.catalog.jdbi3.GlossaryTermRepository.GlossaryTermEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.TestUtils;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class GlossaryTermResourceTest extends EntityResourceTest<GlossaryTerm, CreateGlossaryTerm> {
  public static Glossary GLOSSARY1;
  public static EntityReference GLOSSARY_REF1;
  public static Glossary GLOSSARY2;
  public static EntityReference GLOSSARY_REF2;

  public static GlossaryTerm GLOSSARY_TERM1;
  public static EntityReference GLOSSARY_TERM_REF1;
  public static GlossaryTerm GLOSSARY_TERM2;
  public static EntityReference GLOSSARY_TERM_REF2;

  public GlossaryTermResourceTest() {
    super(
        Entity.GLOSSARY_TERM,
        GlossaryTerm.class,
        GlossaryTermResource.GlossaryTermList.class,
        "glossaryTerms",
        GlossaryTermResource.FIELDS,
        false,
        false,
        true,
        false,
        false);
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);
    GlossaryResourceTest glossaryResourceTest = new GlossaryResourceTest();
    CreateGlossary createGlossary = glossaryResourceTest.createRequest(test, 1);
    GLOSSARY1 = glossaryResourceTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);
    GLOSSARY_REF1 = new GlossaryEntityInterface(GLOSSARY1).getEntityReference();

    createGlossary = glossaryResourceTest.createRequest(test, 2);
    GLOSSARY2 = glossaryResourceTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);
    GLOSSARY_REF2 = new GlossaryEntityInterface(GLOSSARY2).getEntityReference();

    CreateGlossaryTerm createGlossaryTerm = createRequest(test, 1).withRelatedTerms(null);
    GLOSSARY_TERM1 = createEntity(createGlossaryTerm, ADMIN_AUTH_HEADERS);
    GLOSSARY_TERM_REF1 = new GlossaryTermEntityInterface(GLOSSARY_TERM1).getEntityReference();

    createGlossaryTerm = createRequest(test, 2).withRelatedTerms(null);
    GLOSSARY_TERM2 = createEntity(createGlossaryTerm, ADMIN_AUTH_HEADERS);
    GLOSSARY_TERM_REF2 = new GlossaryTermEntityInterface(GLOSSARY_TERM2).getEntityReference();
  }

  @Order(0)
  @Test
  void get_listGlossaryTermsWithDifferentFilters() throws HttpResponseException {
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
    term1.setChildren(
        List.of(
            new GlossaryTermEntityInterface(term11).getEntityReference(),
            new GlossaryTermEntityInterface(term12).getEntityReference()));

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
    term2.setChildren(
        List.of(
            new GlossaryTermEntityInterface(term21).getEntityReference(),
            new GlossaryTermEntityInterface(term22).getEntityReference()));

    // List terms without any filters
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("fields", "children,relatedTerms,reviewers,tags");
    ResultList<GlossaryTerm> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    List<GlossaryTerm> expectedTerms =
        Arrays.asList(GLOSSARY_TERM1, GLOSSARY_TERM2, term1, term11, term12, term2, term21, term22);
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

  public GlossaryTerm createTerm(Glossary glossary, GlossaryTerm parent, String termName) throws HttpResponseException {
    EntityReference glossaryRef = new GlossaryEntityInterface(glossary).getEntityReference();
    EntityReference parentRef = parent != null ? new GlossaryTermEntityInterface(parent).getEntityReference() : null;
    CreateGlossaryTerm createGlossaryTerm =
        createRequest(termName, "", "", null).withGlossary(glossaryRef).withParent(parentRef);
    return createEntity(createGlossaryTerm, ADMIN_AUTH_HEADERS);
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
  }

  @Override
  public CreateGlossaryTerm createRequest(String name, String description, String displayName, EntityReference owner) {
    return new CreateGlossaryTerm()
        .withName(name)
        .withSynonyms(List.of("syn1", "syn2", "syn3"))
        .withDescription(description)
        .withDisplayName(displayName)
        .withGlossary(GLOSSARY_REF1)
        .withRelatedTerms(Arrays.asList(GLOSSARY_TERM_REF1, GLOSSARY_TERM_REF2))
        .withReviewers(List.of(USER_OWNER1));
  }

  @Override
  public EntityReference getContainer(CreateGlossaryTerm createRequest) {
    return null;
  }

  @Override
  public void validateCreatedEntity(GlossaryTerm entity, CreateGlossaryTerm request, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(entity), request.getDescription(), TestUtils.getPrincipal(authHeaders), null);

    // Validate fully qualified name
    String fqn = entity.getParent() == null ? entity.getGlossary().getName() : entity.getParent().getName();
    fqn = fqn + "." + entity.getName();
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
  public void validateUpdatedEntity(GlossaryTerm updated, CreateGlossaryTerm request, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCreatedEntity(updated, request, authHeaders);
  }

  @Override
  public void compareEntities(GlossaryTerm expected, GlossaryTerm patched, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(patched), expected.getDescription(), TestUtils.getPrincipal(authHeaders), null);

    validateEntityReference(patched.getGlossary());
    assertEquals(expected.getGlossary().getId(), patched.getGlossary().getId());

    // Entity specific validation
    TestUtils.validateTags(expected.getTags(), patched.getTags());
  }

  @Override
  public GlossaryTermEntityInterface getEntityInterface(GlossaryTerm entity) {
    return new GlossaryTermEntityInterface(entity);
  }

  @Override
  public void validateGetWithDifferentFields(GlossaryTerm term, boolean byName) throws HttpResponseException {
    String fields = "";
    term =
        byName
            ? getEntityByName(term.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(term.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNull(term.getChildren(), term.getRelatedTerms(), term.getReviewers(), term.getTags());

    // .../teams?fields=profile,teams
    fields = "relatedTerms,reviewers,tags";
    term =
        byName
            ? getEntityByName(term.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(term.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(term.getRelatedTerms(), term.getReviewers(), term.getTags());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
