package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;

import java.util.HashMap;
import java.util.List;
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
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

class GlossaryTermIndexTest {

  private static MockedStatic<Entity> entityStaticMock;

  @BeforeAll
  static void setUp() {
    SearchRepository mockSearchRepo =
        Mockito.mock(SearchRepository.class, Mockito.RETURNS_DEEP_STUBS);
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

    GlossaryTermIndex index = new GlossaryTermIndex(glossaryTerm);

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

    GlossaryTermIndex index = new GlossaryTermIndex(glossaryTerm);

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

    GlossaryTermIndex index = new GlossaryTermIndex(glossaryTerm);

    Map<String, Object> glossaryMap = new HashMap<>();
    glossaryMap.put("name", "testGlossary");
    Map<String, Object> doc = new HashMap<>();
    doc.put("glossary", glossaryMap);

    Map<String, Object> result = index.buildSearchIndexDocInternal(doc);

    @SuppressWarnings("unchecked")
    Map<String, Object> resultGlossary = (Map<String, Object>) result.get("glossary");
    assertFalse(resultGlossary.containsKey("mutuallyExclusive"));
  }

  @Test
  void testBuildSearchIndexDoc_preservesTypedRelatedTermsMetadata() {
    UUID edgeId = UUID.randomUUID();
    UUID targetId = UUID.randomUUID();
    UUID relationshipTypeId = UUID.randomUUID();
    long createdAt = 1700000000000L;

    TermRelation relation =
        new TermRelation()
            .withId(edgeId)
            .withRelationType("broader")
            .withProvenance(RelationProvenance.AI_SUGGESTED)
            .withStatus(EntityStatus.DRAFT)
            .withCreatedBy("agent-bot")
            .withCreatedAt(createdAt)
            .withRelationshipType(
                new EntityReference()
                    .withId(relationshipTypeId)
                    .withType("relationshipType")
                    .withName("broader")
                    .withFullyQualifiedName("broader"))
            .withTerm(
                new EntityReference()
                    .withId(targetId)
                    .withType(Entity.GLOSSARY_TERM)
                    .withName("Revenue")
                    .withFullyQualifiedName("Finance.Revenue"));

    GlossaryTerm glossaryTerm =
        new GlossaryTerm()
            .withId(UUID.randomUUID())
            .withName("GrossRevenue")
            .withFullyQualifiedName("Finance.GrossRevenue")
            .withRelatedTerms(List.of(relation));

    Map<String, Object> doc = new GlossaryTermIndex(glossaryTerm).buildSearchIndexDoc();

    assertTrue(doc.containsKey("relatedTerms"));
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> indexedRelations =
        (List<Map<String, Object>>) doc.get("relatedTerms");
    assertEquals(1, indexedRelations.size());
    Map<String, Object> indexed = indexedRelations.getFirst();
    assertEquals(edgeId.toString(), indexed.get("id"));
    assertEquals("broader", indexed.get("relationType"));
    assertEquals("AiSuggested", indexed.get("provenance"));
    assertEquals("Draft", indexed.get("status"));
    assertEquals("agent-bot", indexed.get("createdBy"));
    assertEquals(createdAt, indexed.get("createdAt"));
    @SuppressWarnings("unchecked")
    Map<String, Object> indexedTerm = (Map<String, Object>) indexed.get("term");
    assertEquals("Finance.Revenue", indexedTerm.get("fullyQualifiedName"));
    @SuppressWarnings("unchecked")
    Map<String, Object> indexedRelType = (Map<String, Object>) indexed.get("relationshipType");
    assertEquals("broader", indexedRelType.get("name"));
  }

  @Test
  void testBuildSearchIndexDoc_writesEmptyRelatedTermsArrayWhenClearedAndOmitsWhenNull() {
    GlossaryTerm cleared =
        new GlossaryTerm()
            .withId(UUID.randomUUID())
            .withName("Cleared")
            .withFullyQualifiedName("Finance.Cleared")
            .withRelatedTerms(List.of());
    Map<String, Object> clearedDoc = new GlossaryTermIndex(cleared).buildSearchIndexDoc();
    assertTrue(clearedDoc.containsKey("relatedTerms"));
    assertEquals(List.of(), clearedDoc.get("relatedTerms"));

    GlossaryTerm unloaded =
        new GlossaryTerm()
            .withId(UUID.randomUUID())
            .withName("Unloaded")
            .withFullyQualifiedName("Finance.Unloaded")
            .withRelatedTerms(null);
    Map<String, Object> unloadedDoc = new GlossaryTermIndex(unloaded).buildSearchIndexDoc();
    assertFalse(unloadedDoc.containsKey("relatedTerms"));
  }
}
