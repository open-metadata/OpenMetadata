/*
 * Copyright 2026 Collate
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the
 * License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
 */
package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.ontology.OntologyAiOutputValidator.requireEntityName;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.api.data.OntologyDomainDraftRequest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.AssetRealization;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyAttribute;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.OntologyDiscoveryEvidence;
import org.openmetadata.schema.type.OntologyProposedBinding;
import org.openmetadata.schema.type.OntologyProposedClass;
import org.openmetadata.schema.type.OntologyProposedProperty;
import org.openmetadata.schema.type.OntologyProposedRelationship;
import org.openmetadata.schema.type.OntologyRelationship;
import org.openmetadata.schema.type.OntologySourceColumn;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.FullyQualifiedName;

/** Compiles extracted structure without a second, lossy generative-model pass. */
final class OntologyDiscoveryProposalCompiler {
  static final String COMPILER_ID = "ontology-proposal-compiler-v1";
  private final OntologyAiCatalog catalog;
  private final OntologyDomainDraftRequest request;
  private final Glossary glossary;
  private final long generatedAt;
  private final Map<String, GlossaryTerm> terms = new LinkedHashMap<>();
  private final Map<String, Double> versions = new LinkedHashMap<>();
  private final Map<String, Table> tables = new LinkedHashMap<>();
  private final List<OntologyChangeOperation> operations = new ArrayList<>();

  OntologyDiscoveryProposalCompiler(
      OntologyAiCatalog catalog,
      OntologyDomainDraftRequest request,
      Glossary glossary,
      long generatedAt) {
    this.catalog = catalog;
    this.request = request;
    this.glossary = glossary;
    this.generatedAt = generatedAt;
  }

  CreateOntologyChangeSet compile() {
    if (request.getDiscoveryContext() == null
        || request.getProposal().getClasses().isEmpty()
        || request.getProposal().getClasses().size() > request.getMaxConcepts()) {
      throw new IllegalArgumentException(
          "Structured discovery requires evidence and a bounded, nonempty class list");
    }
    request.getProposal().getClasses().forEach(this::compileClass);
    listOrEmpty(request.getProposal().getRelationships()).forEach(this::compileRelationship);
    if (operations.isEmpty() || operations.size() > 1000) {
      throw new IllegalArgumentException(
          "Structured discovery must produce between 1 and 1000 operations");
    }
    return new CreateOntologyChangeSet()
        .withName(request.getChangeSetName())
        .withDisplayName(request.getDisplayName())
        .withDescription(request.getDescription())
        .withGlossaries(Set.of(glossary.getFullyQualifiedName()))
        .withState(OntologyChangeSetState.DRAFT)
        .withOperations(operations)
        .withUndoCursor(operations.size())
        .withProvider(ProviderType.AUTOMATION);
  }

  private void compileClass(final OntologyProposedClass candidate) {
    if (terms.containsKey(candidate.getKey())) {
      throw new IllegalArgumentException("Duplicate discovery class key");
    }
    final GlossaryTerm term = resolveTerm(candidate);
    if (terms.values().stream()
        .anyMatch(
            existing ->
                existing.getId().equals(term.getId())
                    || existing.getFullyQualifiedName().equals(term.getFullyQualifiedName()))) {
      throw new IllegalArgumentException("Duplicate discovery concept identity");
    }
    terms.put(candidate.getKey(), term);
    versions.put(candidate.getKey(), candidate.getBaseVersion());
    if (candidate.getExistingTermId() == null) {
      operations.add(
          operation(candidate.getKey(), "class", candidate.getEvidenceFqns())
              .withOperationType(OntologyChangeOperationType.CREATE_TERM)
              .withTerm(term));
    }
    final Set<String> propertyNames = new HashSet<>();
    for (final OntologyProposedProperty property : listOrEmpty(candidate.getProperties())) {
      if (!propertyNames.add(property.getName())) {
        throw new IllegalArgumentException("Duplicate discovery property name");
      }
      compileProperty(candidate, property);
    }
    listOrEmpty(candidate.getTableBindings())
        .forEach(binding -> compileBinding(candidate, binding));
  }

  private GlossaryTerm resolveTerm(final OntologyProposedClass candidate) {
    requireEntityName(candidate.getName());
    if (candidate.getExistingTermId() != null) {
      final GlossaryTerm existing = catalog.term(candidate.getExistingTermId());
      if (!Objects.equals(existing.getVersion(), candidate.getBaseVersion())
          || !Objects.equals(existing.getGlossary().getId(), glossary.getId())
          || !Objects.equals(existing.getName(), candidate.getName())
          || candidate.getParentKey() != null) {
        throw new IllegalArgumentException(
            "Existing discovery concepts require their current identity and version; reparenting is separate");
      }
      return existing;
    }
    if (candidate.getBaseVersion() != null) {
      throw new IllegalArgumentException("New discovery concepts cannot have a base version");
    }
    final EntityReference parent =
        candidate.getParentKey() == null
            ? null
            : term(candidate.getParentKey()).getEntityReference();
    final String parentFqn =
        parent == null ? glossary.getFullyQualifiedName() : parent.getFullyQualifiedName();
    return new GlossaryTerm()
        .withId(id("class:" + candidate.getKey()))
        .withName(candidate.getName())
        .withDisplayName(candidate.getDisplayName())
        .withDescription(candidate.getDescription())
        .withGlossary(glossary.getEntityReference())
        .withParent(parent)
        .withFullyQualifiedName(FullyQualifiedName.add(parentFqn, candidate.getName()))
        .withVersion(0.1)
        .withEntityStatus(EntityStatus.DRAFT)
        .withProvider(ProviderType.USER);
  }

  private void compileProperty(
      final OntologyProposedClass candidate, final OntologyProposedProperty property) {
    final GlossaryTerm term = term(candidate.getKey());
    requireEntityName(property.getName());
    listOrEmpty(property.getSourceColumns()).forEach(source -> validateColumn(source, property));
    final OntologyAttribute existing =
        listOrEmpty(term.getAttributes()).stream()
            .filter(value -> value.getName().equals(property.getName()))
            .findFirst()
            .orElse(null);
    final OntologyAttribute attribute =
        (existing == null
                ? new OntologyAttribute()
                    .withId(id("property:" + term.getId() + ":" + property.getName()))
                : JsonUtils.deepCopy(existing, OntologyAttribute.class))
            .withName(property.getName())
            .withDataType(property.getDataType())
            .withIsIdentifier(property.getIsIdentifier())
            .withEnumValues(property.getEnumValues());
    if (property.getDescription() != null) attribute.setDescription(property.getDescription());
    if (property.getUnit() != null) attribute.setUnit(property.getUnit());
    final List<OntologySourceColumn> mappings =
        new ArrayList<>(listOrEmpty(attribute.getSourceColumns()));
    listOrEmpty(property.getSourceColumns()).stream()
        .filter(source -> !mappings.contains(source))
        .forEach(mappings::add);
    if (mappings.size() > 100) {
      throw new IllegalArgumentException(
          "A discovery property supports at most 100 source mappings");
    }
    attribute.setSourceColumns(mappings);
    operations.add(
        targetOperation(
                candidate.getKey(), "property:" + property.getName(), property.getEvidenceFqns())
            .withOperationType(OntologyChangeOperationType.UPSERT_ATTRIBUTE)
            .withAttribute(attribute));
  }

  private void compileBinding(
      final OntologyProposedClass candidate, final OntologyProposedBinding proposed) {
    final String fqn = proposed.getTableFqn();
    requireTableEvidence(fqn, candidate.getEvidenceFqns());
    final Table table = table(fqn);
    final AssetRealization existing =
        listOrEmpty(term(candidate.getKey()).getRealizedIn()).stream()
            .filter(value -> value.getAsset().getId().equals(table.getId()))
            .findFirst()
            .orElse(null);
    final AssetRealization binding =
        (existing == null
                ? new AssetRealization().withId(id("binding:" + candidate.getKey() + ":" + fqn))
                : JsonUtils.deepCopy(existing, AssetRealization.class))
            .withRole(proposed.getRole())
            .withProvenance(RelationProvenance.AI_SUGGESTED)
            .withAsset(table.getEntityReference());
    operations.add(
        targetOperation(candidate.getKey(), "binding:" + fqn, candidate.getEvidenceFqns())
            .withOperationType(OntologyChangeOperationType.BIND_ASSET)
            .withAssetBinding(binding));
  }

  private void validateColumn(
      final OntologySourceColumn source, final OntologyProposedProperty property) {
    requireTableEvidence(source.getTableFqn(), property.getEvidenceFqns());
    if (!hasColumn(table(source.getTableFqn()).getColumns(), source.getColumnFqn())) {
      throw new IllegalArgumentException("Discovery property references an unknown source column");
    }
  }

  private static boolean hasColumn(final List<Column> columns, final String fqn) {
    return listOrEmpty(columns).stream()
        .anyMatch(
            column ->
                Objects.equals(column.getFullyQualifiedName(), fqn)
                    || hasColumn(column.getChildren(), fqn));
  }

  private Table table(final String fqn) {
    return tables.computeIfAbsent(
        fqn,
        key -> {
          final Table table = catalog.table(key);
          if (table.getService() == null
              || !Objects.equals(
                  table.getService().getFullyQualifiedName(),
                  request.getDiscoveryContext().getServiceFqn())) {
            throw new IllegalArgumentException(
                "Discovery binding references a table outside the service");
          }
          return table;
        });
  }

  private void requireTableEvidence(final String fqn, final Set<String> evidenceFqns) {
    if (evidence(evidenceFqns).stream()
        .noneMatch(
            item ->
                "table".equals(item.getEntityType()) && fqn.equals(item.getFullyQualifiedName()))) {
      throw new IllegalArgumentException(
          "Every source binding requires versioned owning-table evidence");
    }
  }

  private void compileRelationship(final OntologyProposedRelationship candidate) {
    final GlossaryTerm from = term(candidate.getFromKey());
    final GlossaryTerm to = term(candidate.getToKey());
    final String key =
        "relationship:"
            + candidate.getFromKey()
            + ":"
            + candidate.getToKey()
            + ":"
            + candidate.getRelationshipTypeId();
    final OntologyRelationship relationship =
        new OntologyRelationship()
            .withId(id(key))
            .withFromTerm(from.getEntityReference())
            .withToTerm(to.getEntityReference())
            .withRelationshipType(
                catalog.relationshipType(candidate.getRelationshipTypeId()).getEntityReference())
            .withProvenance(RelationProvenance.AI_SUGGESTED)
            .withStatus(EntityStatus.DRAFT)
            .withCreatedBy("ontology-agent")
            .withCreatedAt(generatedAt);
    operations.add(
        targetOperation(candidate.getFromKey(), key, candidate.getEvidenceFqns())
            .withOperationType(OntologyChangeOperationType.ADD_RELATIONSHIP)
            .withRelationship(relationship));
  }

  private GlossaryTerm term(final String key) {
    if (!terms.containsKey(key)) {
      throw new IllegalArgumentException(
          "Discovery class reference must identify an earlier declared class");
    }
    return terms.get(key);
  }

  private OntologyChangeOperation targetOperation(
      final String key, final String suffix, final Set<String> evidenceFqns) {
    return operation(key, suffix, evidenceFqns)
        .withTargetId(term(key).getId())
        .withBaseVersion(versions.get(key));
  }

  private OntologyChangeOperation operation(
      final String key, final String suffix, final Set<String> evidenceFqns) {
    return new OntologyChangeOperation()
        .withId(id("operation:" + key + ":" + suffix))
        .withState(OntologyChangeOperationState.ACTIVE)
        .withDiscoveryEvidence(evidence(evidenceFqns))
        .withEvidenceFingerprint(request.getDiscoveryContext().getEvidenceFingerprint());
  }

  private List<OntologyDiscoveryEvidence> evidence(final Set<String> fqns) {
    if (fqns == null || fqns.isEmpty()) {
      throw new IllegalArgumentException("Every discovery operation requires evidence");
    }
    final List<OntologyDiscoveryEvidence> selected =
        request.getDiscoveryContext().getEvidence().stream()
            .filter(item -> fqns.contains(item.getFullyQualifiedName()))
            .toList();
    if (selected.stream().map(OntologyDiscoveryEvidence::getFullyQualifiedName).distinct().count()
        != fqns.size()) {
      throw new IllegalArgumentException(
          "Operation evidence must reference the validated discovery context");
    }
    return selected;
  }

  private UUID id(final String key) {
    return UUID.nameUUIDFromBytes(
        (request.getChangeSetName() + ":" + key).getBytes(StandardCharsets.UTF_8));
  }
}
