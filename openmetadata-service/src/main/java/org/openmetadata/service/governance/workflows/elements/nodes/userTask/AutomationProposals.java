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

package org.openmetadata.service.governance.workflows.elements.nodes.userTask;

import static java.util.Comparator.comparing;
import static java.util.Comparator.naturalOrder;
import static java.util.Comparator.nullsFirst;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.context.DerivationEvidence;
import org.openmetadata.schema.entity.context.MemoryDerivation;
import org.openmetadata.schema.type.AutomationProposal;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.GlossaryApprovalPayload;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/**
 * The payload of the request that decides a glossary term an automation proposed. Every user may
 * read tasks while the memories an agent derives from may be Private or Shared, so it names those
 * memories by id and type only, and leaves the agent's reasons to the memory derivations API.
 */
final class AutomationProposals {
  private AutomationProposals() {}

  /**
   * Whether a request about {@code entity} decides an automation's proposal: a glossary term an
   * automation provided that was never approved. A published term's later reviews are reviews of
   * changes.
   */
  static boolean decidesProposal(String entityType, EntityInterface<?> entity) {
    return Entity.GLOSSARY_TERM.equals(entityType)
        && ProviderType.AUTOMATION.equals(entity.getProvider())
        && !hasApprovedVersion(Entity.getEntityRepository(entityType).listVersions(entity.getId()));
  }

  static boolean hasApprovedVersion(EntityHistory history) {
    return history.getVersions().stream().anyMatch(AutomationProposals::isApproved);
  }

  private static boolean isApproved(Object version) {
    String status =
        JsonUtils.readOrConvertValue(version, JsonNode.class)
            .path(Entity.FIELD_ENTITY_STATUS)
            .asText(null);
    return EntityStatus.APPROVED.value().equals(status);
  }

  static GlossaryApprovalPayload payloadFor(
      EntityInterface<?> term, List<MemoryDerivation> derivations) {
    return new GlossaryApprovalPayload()
        .withGlossaryTerm(reference(term))
        .withAction(GlossaryApprovalPayload.Action.CREATE)
        .withProposal(proposalOf(term, derivations));
  }

  // As the task's `about`: a term's own reference would also copy its description.
  private static EntityReference reference(EntityInterface<?> term) {
    return new EntityReference()
        .withId(term.getId())
        .withType(Entity.GLOSSARY_TERM)
        .withName(term.getName())
        .withFullyQualifiedName(term.getFullyQualifiedName());
  }

  private static AutomationProposal proposalOf(
      EntityInterface<?> term, List<MemoryDerivation> derivations) {
    Optional<DerivationEvidence> evidence = latestEvidence(derivations);
    return new AutomationProposal()
        .withProvider(term.getProvider())
        .withAgent(evidence.map(DerivationEvidence::getAgent).orElse(null))
        .withConfidence(evidence.map(DerivationEvidence::getConfidence).orElse(null))
        .withDerivedFrom(sources(derivations));
  }

  // When several memories led to the term, the most recent evidence speaks for the proposal.
  private static Optional<DerivationEvidence> latestEvidence(List<MemoryDerivation> derivations) {
    return derivations.stream()
        .map(MemoryDerivation::getEvidence)
        .filter(Objects::nonNull)
        .max(comparing(DerivationEvidence::getDerivedAt, nullsFirst(naturalOrder())));
  }

  private static List<EntityReference> sources(List<MemoryDerivation> derivations) {
    return derivations.stream()
        .map(MemoryDerivation::getMemory)
        .map(memory -> new EntityReference().withId(memory.getId()).withType(memory.getType()))
        .distinct()
        .toList();
  }
}
