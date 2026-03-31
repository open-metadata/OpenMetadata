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
package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

class GlossaryTermIndexTest {

  private static MockedStatic<Entity> entityStaticMock;

  @BeforeAll
  static void setUp() {
    SearchRepository mockSearchRepo = mock(SearchRepository.class, Mockito.RETURNS_DEEP_STUBS);
    entityStaticMock = Mockito.mockStatic(Entity.class);
    entityStaticMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepo);
  }

  @AfterAll
  static void tearDown() {
    entityStaticMock.close();
  }

  @Test
  void testBuildSearchIndexDocInternal_enrichesGlossaryMutuallyExclusive() {
    UUID glossaryId = UUID.randomUUID();
    EntityReference glossaryRef = new EntityReference().withId(glossaryId).withType("glossary");

    GlossaryTerm glossaryTerm = new GlossaryTerm();
    glossaryTerm.setName("testTerm");
    glossaryTerm.setFullyQualifiedName("testGlossary.testTerm");
    glossaryTerm.setGlossary(glossaryRef);

    Glossary glossary = new Glossary();
    glossary.setName("testGlossary");
    glossary.setMutuallyExclusive(true);

    entityStaticMock
        .when(
            () ->
                Entity.getEntityOrNull(
                    any(EntityReference.class), eq("mutuallyExclusive"), eq(Include.NON_DELETED)))
        .thenReturn(glossary);

    GlossaryTermIndex index = Mockito.spy(new GlossaryTermIndex(glossaryTerm));
    Mockito.doReturn(new HashMap<>())
        .when(index)
        .getCommonAttributesMap(glossaryTerm, "glossaryTerm");

    Map<String, Object> glossaryMap = new HashMap<>();
    glossaryMap.put("name", "testGlossary");
    Map<String, Object> doc = new HashMap<>();
    doc.put("glossary", glossaryMap);

    Map<String, Object> result = index.buildSearchIndexDocInternal(doc);

    assertTrue(result.containsKey("glossary"));
    @SuppressWarnings("unchecked")
    Map<String, Object> resultGlossary = (Map<String, Object>) result.get("glossary");
    assertEquals(true, resultGlossary.get("mutuallyExclusive"));
  }

  @Test
  void testBuildSearchIndexDocInternal_noGlossaryKey() {
    GlossaryTerm glossaryTerm = new GlossaryTerm();
    glossaryTerm.setName("testTerm");
    glossaryTerm.setFullyQualifiedName("testGlossary.testTerm");

    GlossaryTermIndex index = Mockito.spy(new GlossaryTermIndex(glossaryTerm));
    Mockito.doReturn(new HashMap<>())
        .when(index)
        .getCommonAttributesMap(glossaryTerm, "glossaryTerm");

    Map<String, Object> doc = new HashMap<>();

    Map<String, Object> result = index.buildSearchIndexDocInternal(doc);

    assertFalse(result.containsKey("glossary"));
  }

  @Test
  void testBuildSearchIndexDocInternal_glossaryWithNullMutuallyExclusive() {
    UUID glossaryId = UUID.randomUUID();
    EntityReference glossaryRef = new EntityReference().withId(glossaryId).withType("glossary");

    GlossaryTerm glossaryTerm = new GlossaryTerm();
    glossaryTerm.setName("testTerm");
    glossaryTerm.setFullyQualifiedName("testGlossary.testTerm");
    glossaryTerm.setGlossary(glossaryRef);

    Glossary glossary = new Glossary();
    glossary.setName("testGlossary");
    glossary.setMutuallyExclusive(null);

    entityStaticMock
        .when(
            () ->
                Entity.getEntityOrNull(
                    any(EntityReference.class), eq("mutuallyExclusive"), eq(Include.NON_DELETED)))
        .thenReturn(glossary);

    GlossaryTermIndex index = Mockito.spy(new GlossaryTermIndex(glossaryTerm));
    Mockito.doReturn(new HashMap<>())
        .when(index)
        .getCommonAttributesMap(glossaryTerm, "glossaryTerm");

    Map<String, Object> glossaryMap = new HashMap<>();
    glossaryMap.put("name", "testGlossary");
    Map<String, Object> doc = new HashMap<>();
    doc.put("glossary", glossaryMap);

    Map<String, Object> result = index.buildSearchIndexDocInternal(doc);

    @SuppressWarnings("unchecked")
    Map<String, Object> resultGlossary = (Map<String, Object>) result.get("glossary");
    assertFalse(resultGlossary.containsKey("mutuallyExclusive"));
  }
}
