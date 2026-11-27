package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.DerivationEvidence;
import org.openmetadata.schema.entity.context.MemoryDerivation;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.util.EntityUtil.Fields;

/** The relationship table and the memory store are the boundaries; visibility is the caller's. */
class MemoryDerivationsTest {

  private final ContextMemoryRepository memories = mock(ContextMemoryRepository.class);
  private final EntityRelationshipDAO relationships = mock(EntityRelationshipDAO.class);
  private final MemoryDerivations derivations = new MemoryDerivations(memories, relationships);

  @Test
  void keepsOnlyTheDerivationsWhoseMemoryTheCallerMaySee() {
    ContextMemory visible = memory("Net revenue retention");
    ContextMemory hidden = memory("Board compensation");
    UUID visibleTerm = UUID.randomUUID();
    UUID hiddenTerm = UUID.randomUUID();
    DerivationEvidence evidence =
        new DerivationEvidence()
            .withAgent("Glossary Agent")
            .withConfidence(0.92)
            .withReasons(List.of("Defines a recurring metric"));
    stubEdges(
        edge(visibleTerm, visible, JsonUtils.pojoToJson(evidence)),
        edge(hiddenTerm, hidden, JsonUtils.pojoToJson(evidence)));
    stubMemories(visible, hidden);

    List<MemoryDerivation> found =
        derivations.find(
            Entity.GLOSSARY_TERM,
            List.of(visibleTerm, hiddenTerm),
            loaded -> loaded.stream().filter(memory -> memory == visible).toList());

    assertEquals(1, found.size());
    MemoryDerivation derivation = found.getFirst();
    assertEquals(visibleTerm, derivation.getEntity().getId());
    assertEquals(Entity.GLOSSARY_TERM, derivation.getEntity().getType());
    assertEquals(visible.getId(), derivation.getMemory().getId());
    assertEquals("Net revenue retention", derivation.getMemory().getDisplayName());
    assertEquals(0.92, derivation.getEvidence().getConfidence());
    assertEquals(List.of("Defines a recurring metric"), derivation.getEvidence().getReasons());
  }

  @Test
  void aLinkWithoutReadableEvidenceStillNamesItsMemory() {
    ContextMemory memory = memory("Churn risk");
    UUID plain = UUID.randomUUID();
    UUID garbled = UUID.randomUUID();
    stubEdges(edge(plain, memory, null), edge(garbled, memory, "{not json"));
    stubMemories(memory);

    List<MemoryDerivation> found =
        derivations.find(Entity.GLOSSARY_TERM, List.of(plain, garbled), loaded -> loaded);

    assertEquals(2, found.size());
    assertTrue(found.stream().allMatch(derivation -> derivation.getEvidence() == null));
    assertTrue(
        found.stream()
            .allMatch(derivation -> memory.getId().equals(derivation.getMemory().getId())));
  }

  @Test
  void anEntityWithoutDerivationsAsksForNoMemories() {
    stubEdges();

    List<MemoryDerivation> found =
        derivations.find(
            Entity.GLOSSARY_TERM,
            List.of(UUID.randomUUID()),
            loaded -> {
              assertTrue(loaded.isEmpty());
              return loaded;
            });

    assertTrue(found.isEmpty());
  }

  @Test
  void refusesEvidenceAReviewerCouldNotRead() {
    DerivationEvidence tooSure = new DerivationEvidence().withConfidence(1.5);
    DerivationEvidence tooChatty =
        new DerivationEvidence().withConfidence(0.9).withReasons(List.of("a", "b", "c", "d"));

    assertThrows(IllegalArgumentException.class, () -> MemoryDerivations.requireValid(tooSure));
    assertThrows(IllegalArgumentException.class, () -> MemoryDerivations.requireValid(tooChatty));
    assertDoesNotThrow(
        () ->
            MemoryDerivations.requireValid(
                new DerivationEvidence().withConfidence(1.0).withReasons(List.of("a", "b", "c"))));
  }

  @Test
  void evidenceIsEmptyForABlankEdge() {
    assertTrue(MemoryDerivations.evidence(edge(UUID.randomUUID(), memory("x"), "")).isEmpty());
    assertNull(MemoryDerivations.evidence(edge(UUID.randomUUID(), memory("x"), null)).orElse(null));
  }

  private void stubEdges(EntityRelationshipObject... edges) {
    when(relationships.findToBatch(
            anyList(),
            eq(Relationship.DERIVED_FROM.ordinal()),
            eq(Entity.GLOSSARY_TERM),
            eq(Entity.CONTEXT_MEMORY)))
        .thenReturn(List.of(edges));
  }

  private void stubMemories(ContextMemory... found) {
    Fields fields = mock(Fields.class);
    when(memories.getFields("owners,primaryEntity")).thenReturn(fields);
    when(memories.get(any(), anyList(), eq(fields), eq(Include.NON_DELETED)))
        .thenReturn(List.of(found));
  }

  private static EntityRelationshipObject edge(UUID termId, ContextMemory memory, String json) {
    return EntityRelationshipObject.builder()
        .fromId(termId.toString())
        .toId(memory.getId().toString())
        .fromEntity(Entity.GLOSSARY_TERM)
        .toEntity(Entity.CONTEXT_MEMORY)
        .relation(Relationship.DERIVED_FROM.ordinal())
        .json(json)
        .build();
  }

  private static ContextMemory memory(String title) {
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withName(title.toLowerCase().replace(' ', '-'))
        .withFullyQualifiedName(title.toLowerCase().replace(' ', '-'))
        .withTitle(title);
  }
}
