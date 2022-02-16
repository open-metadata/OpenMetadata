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
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.validateEntityReference;

import java.io.IOException;
import java.net.URISyntaxException;
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
import org.openmetadata.catalog.jdbi3.GlossaryTermRepository.GlossaryTermEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.TestUtils;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class GlossaryTermResourceTest extends EntityResourceTest<GlossaryTerm, CreateGlossaryTerm> {
  public static Glossary GLOSSARY;

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
    CreateGlossary createGlossary = glossaryResourceTest.createRequest(test);
    GLOSSARY = glossaryResourceTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);
  }

  @Override
  public CreateGlossaryTerm createRequest(String name, String description, String displayName, EntityReference owner) {
    return new CreateGlossaryTerm()
        .withName(name)
        .withDescription(description)
        .withDisplayName(displayName)
        .withGlossaryId(GLOSSARY.getId());
  }

  @Override
  public EntityReference getContainer(CreateGlossaryTerm createRequest) {
    return null;
  }

  /**
   * A method variant to be called form other tests to create a glossary without depending on Database, DatabaseService
   * set up in the {@code setup()} method
   */
  public GlossaryTerm createEntity(TestInfo test, int index) throws IOException {
    CreateGlossaryTerm create = new CreateGlossaryTerm().withName(getEntityName(test, index));
    return createEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Override
  public void validateCreatedEntity(
      GlossaryTerm createdEntity, CreateGlossaryTerm createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(createdEntity), createRequest.getDescription(), TestUtils.getPrincipal(authHeaders), null);

    validateEntityReference(createdEntity.getGlossary());
    assertEquals(createRequest.getGlossaryId(), createdEntity.getGlossary().getId());

    // Entity specific validation
    TestUtils.validateTags(createRequest.getTags(), createdEntity.getTags());
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
