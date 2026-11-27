/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.context.center;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.function.UnaryOperator;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.DerivationEvidence;
import org.openmetadata.schema.entity.context.MemoryDerivation;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;

/**
 * The evidence an AI agent leaves on what it derives from a memory: its confidence and reasons.
 * The evidence rides on the derived entity's {@code DERIVED_FROM} edge to the memory, so the
 * derived entity gains no field, and it is read back only through memories the caller may see.
 */
@Slf4j
public final class MemoryDerivations {
  public static final int MAX_ENTITIES = 100;
  public static final int MAX_REASONS = 3;
  private static final String MEMORY_FIELDS = "owners,primaryEntity";

  private final Supplier<ContextMemoryRepository> memories;
  private final Supplier<EntityRelationshipDAO> relationships;

  /** Resolves the stores on first use, so it can be built before the server has them. */
  public MemoryDerivations() {
    this(
        () -> (ContextMemoryRepository) Entity.getEntityRepository(Entity.CONTEXT_MEMORY),
        () -> Entity.getCollectionDAO().relationshipDAO());
  }

  MemoryDerivations(ContextMemoryRepository memories, EntityRelationshipDAO relationships) {
    this(() -> memories, () -> relationships);
  }

  private MemoryDerivations(
      Supplier<ContextMemoryRepository> memories, Supplier<EntityRelationshipDAO> relationships) {
    this.memories = memories;
    this.relationships = relationships;
  }

  /** Links {@code derived} to the memory it came from, keeping the agent's evidence on the link. */
  public void record(UUID memoryId, EntityReference derived, DerivationEvidence evidence) {
    requireValid(evidence);
    memories
        .get()
        .addRelationship(
            derived.getId(),
            memoryId,
            derived.getType(),
            Entity.CONTEXT_MEMORY,
            Relationship.DERIVED_FROM,
            JsonUtils.pojoToJson(evidence),
            false);
  }

  // A reviewer reads the evidence as is, so a bad deriver must fail its own write, not the panel.
  static void requireValid(DerivationEvidence evidence) {
    Double confidence = evidence.getConfidence();
    if (confidence != null && !(confidence >= 0 && confidence <= 1)) {
      throw new IllegalArgumentException(
          "A derivation's confidence must be between 0 and 1, not " + confidence);
    }
    if (listOrEmpty(evidence.getReasons()).size() > MAX_REASONS) {
      throw new IllegalArgumentException(
          "A derivation carries at most " + MAX_REASONS + " reasons");
    }
  }

  /**
   * The derivations of {@code entityIds}, each with its memory and evidence, keeping only those
   * whose memory {@code visibleOnly} returns.
   */
  public List<MemoryDerivation> find(
      String entityType, List<UUID> entityIds, UnaryOperator<List<ContextMemory>> visibleOnly) {
    List<EntityRelationshipObject> edges =
        relationships
            .get()
            .findToBatch(
                entityIds.stream().map(UUID::toString).toList(),
                Relationship.DERIVED_FROM.ordinal(),
                entityType,
                Entity.CONTEXT_MEMORY);
    Map<String, ContextMemory> visibleMemories = visibleMemories(edges, visibleOnly);
    return edges.stream()
        .filter(edge -> visibleMemories.containsKey(edge.getToId()))
        .map(edge -> toDerivation(edge, visibleMemories.get(edge.getToId())))
        .toList();
  }

  private Map<String, ContextMemory> visibleMemories(
      List<EntityRelationshipObject> edges, UnaryOperator<List<ContextMemory>> visibleOnly) {
    List<UUID> memoryIds =
        edges.stream().map(edge -> UUID.fromString(edge.getToId())).distinct().toList();
    List<ContextMemory> found = memoryIds.isEmpty() ? List.of() : loadMemories(memoryIds);
    return visibleOnly.apply(found).stream()
        .collect(Collectors.toMap(memory -> memory.getId().toString(), Function.identity()));
  }

  private List<ContextMemory> loadMemories(List<UUID> memoryIds) {
    ContextMemoryRepository repository = memories.get();
    return repository.get(
        null, memoryIds, repository.getFields(MEMORY_FIELDS), Include.NON_DELETED);
  }

  private static MemoryDerivation toDerivation(
      EntityRelationshipObject edge, ContextMemory memory) {
    return new MemoryDerivation()
        .withEntity(
            new EntityReference()
                .withId(UUID.fromString(edge.getFromId()))
                .withType(edge.getFromEntity()))
        .withMemory(memoryReference(memory))
        .withEvidence(evidence(edge).orElse(null));
  }

  /** A memory without a display name is shown by its title, which is what people wrote. */
  private static EntityReference memoryReference(ContextMemory memory) {
    EntityReference reference = memory.getEntityReference();
    if (nullOrEmpty(memory.getDisplayName()) && !nullOrEmpty(memory.getTitle())) {
      reference.setDisplayName(memory.getTitle());
    }
    return reference;
  }

  static Optional<DerivationEvidence> evidence(EntityRelationshipObject edge) {
    Optional<DerivationEvidence> evidence = Optional.empty();
    if (!nullOrEmpty(edge.getJson())) {
      try {
        evidence = Optional.of(JsonUtils.readValue(edge.getJson(), DerivationEvidence.class));
      } catch (RuntimeException e) {
        LOG.warn(
            "Ignoring unreadable derivation evidence from {} {} to memory {}",
            edge.getFromEntity(),
            edge.getFromId(),
            edge.getToId(),
            e);
      }
    }
    return evidence;
  }
}
