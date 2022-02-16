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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.assertEntityReferenceList;
import static org.openmetadata.catalog.util.TestUtils.validateEntityReference;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
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
  public void validateCreatedEntity(
      GlossaryTerm createdEntity, CreateGlossaryTerm request, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(createdEntity), request.getDescription(), TestUtils.getPrincipal(authHeaders), null);

    validateEntityReference(createdEntity.getGlossary());
    assertTrue(EntityUtil.entityReferenceMatch.test(request.getGlossary(), createdEntity.getGlossary()));

    if (request.getParent() != null) {
      validateEntityReference(createdEntity.getParent());
      assertTrue(EntityUtil.entityReferenceMatch.test(request.getParent(), createdEntity.getParent()));
    }

    assertEntityReferenceList(request.getRelatedTerms(), createdEntity.getRelatedTerms());
    assertEntityReferenceList(request.getReviewers(), createdEntity.getReviewers());

    // Entity specific validation
    TestUtils.validateTags(request.getTags(), createdEntity.getTags());
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
  public void validateGetWithDifferentFields(GlossaryTerm entity, boolean byName) throws HttpResponseException {}

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
