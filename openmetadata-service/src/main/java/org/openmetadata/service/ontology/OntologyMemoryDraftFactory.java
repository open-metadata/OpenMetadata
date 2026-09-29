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

package org.openmetadata.service.ontology;

import static org.openmetadata.service.ontology.OntologyAiOutputValidator.requireCompletion;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
final class OntologyMemoryDraftFactory {
  private static final double MIN_CONFIDENCE = 0.6D;
  private static final double INITIAL_VERSION = 0.1D;
  private static final int MAX_DESCRIPTION_CHARS = 4_000;
  private static final int MAX_RATIONALE_CHARS = 2_000;
  private static final Pattern TERM_NAME = Pattern.compile("[A-Za-z][A-Za-z0-9_-]{0,127}");

  Optional<CreateOntologyChangeSet> create(
      final long jobId,
      final Glossary glossary,
      final Set<UUID> memoryIds,
      final OntologyAiCompletionGateway.Completion<OntologyAiCompletionGateway.MemoryTermCandidate>
          completion,
      final Predicate<String> termExists) {
    requireCompletion(completion);
    if (completion.items().size() > memoryIds.size() * 2) {
      throw OntologyAiOutputValidator.invalid("memory derivation exceeded its term limit");
    }
    final Set<String> names = new HashSet<>();
    final List<OntologyChangeOperation> operations = new ArrayList<>();
    for (final OntologyAiCompletionGateway.MemoryTermCandidate candidate : completion.items()) {
      addCandidate(
          candidate, glossary, memoryIds, completion.modelId(), termExists, names, operations);
    }
    if (operations.isEmpty()) {
      return Optional.empty();
    }
    return Optional.of(
        new CreateOntologyChangeSet()
            .withName(changeSetName(jobId))
            .withDisplayName("Glossary terms from memories")
            .withDescription(
                "AI proposals grounded in published context memories. Review before applying.")
            .withGlossaries(Set.of(glossary.getFullyQualifiedName()))
            .withState(OntologyChangeSetState.DRAFT)
            .withOperations(List.copyOf(operations))
            .withUndoCursor(operations.size())
            .withProvider(ProviderType.USER));
  }

  static String changeSetName(final long jobId) {
    return "memory-glossary-" + jobId;
  }

  private static void addCandidate(
      final OntologyAiCompletionGateway.MemoryTermCandidate candidate,
      final Glossary glossary,
      final Set<UUID> memoryIds,
      final String modelId,
      final Predicate<String> termExists,
      final Set<String> names,
      final List<OntologyChangeOperation> operations) {
    if (!isValid(candidate, memoryIds)) {
      LOG.warn("Skipping invalid glossary suggestion from memory derivation");
      return;
    }
    final String fqn = FullyQualifiedName.add(glossary.getFullyQualifiedName(), candidate.name());
    if (!names.add(fqn) || termExists.test(fqn)) {
      return;
    }
    final GlossaryTerm term =
        new GlossaryTerm()
            .withId(UUID.randomUUID())
            .withName(candidate.name())
            .withDisplayName(candidate.displayName())
            .withDescription(candidate.description())
            .withFullyQualifiedName(fqn)
            .withGlossary(glossary.getEntityReference())
            .withVersion(INITIAL_VERSION)
            .withEntityStatus(EntityStatus.DRAFT)
            .withProvider(ProviderType.USER);
    operations.add(
        new OntologyChangeOperation()
            .withId(UUID.randomUUID())
            .withOperationType(OntologyChangeOperationType.CREATE_TERM)
            .withTerm(term)
            .withState(OntologyChangeOperationState.ACTIVE)
            .withSourceMemoryIds(Set.of(candidate.sourceMemoryId()))
            .withConfidence(candidate.confidence())
            .withRationale(candidate.rationale())
            .withModelId(modelId));
  }

  private static boolean isValid(
      final OntologyAiCompletionGateway.MemoryTermCandidate candidate, final Set<UUID> memoryIds) {
    return candidate != null
        && memoryIds.contains(candidate.sourceMemoryId())
        && isValidName(candidate.name())
        && hasText(candidate.displayName())
        && candidate.displayName().length() <= 256
        && hasText(candidate.description())
        && candidate.description().length() <= MAX_DESCRIPTION_CHARS
        && hasText(candidate.rationale())
        && candidate.rationale().length() <= MAX_RATIONALE_CHARS
        && Double.isFinite(candidate.confidence())
        && candidate.confidence() >= MIN_CONFIDENCE
        && candidate.confidence() <= 1D;
  }

  private static boolean isValidName(final String name) {
    return name != null && TERM_NAME.matcher(name).matches();
  }

  private static boolean hasText(final String text) {
    return text != null && !text.isBlank();
  }
}
