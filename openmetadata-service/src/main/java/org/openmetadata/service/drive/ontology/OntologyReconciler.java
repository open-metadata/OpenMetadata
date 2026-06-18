/*
 * Copyright 2024 Collate.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.openmetadata.service.drive.ontology;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.MetricExpression;
import org.openmetadata.schema.configuration.AIDeletionPolicy;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetricExpressionLanguage;
import org.openmetadata.schema.type.MetricType;
import org.openmetadata.schema.type.MetricUnitOfMeasurement;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.MetricRepository;

/**
 * Owns every ontology write: it turns an {@link OntologyDerivation} into real Glossary Terms and
 * Metrics, manages the {@code DERIVED_FROM} (agent-owned) and {@code RELATED_TO} (reused) edges back
 * to the source {@link ContextMemory}, and enforces the ownership lifecycle from the design's §9.
 *
 * <p>Ownership is keyed on {@link ProviderType#AUTOMATION}: the agent only ever manages entities it
 * created with that provider. A CREATE verdict mints the entity (minting its glossary too when none
 * fits) and owns it; a REUSE verdict only links an existing entity for provenance and never claims
 * it; on re-derive, owned entities the new verdict no longer implies are retired, while any entity a
 * human has adopted (provider flipped off {@code automation}) is left untouched. Both re-derive
 * retirement and memory-deletion retirement (via {@link #onMemoryDeleted}) route through the same
 * {@code deletionPolicy}-driven {@link AIDeletionPolicy} modes; re-derive passes {@code
 * hardDelete=true} for the {@code CASCADE} case since the entity is regenerable from the memory. An
 * all-SKIP derivation (the signal {@code OntologyExtractor} emits on an empty or failed LLM result)
 * is treated as carrying no actionable intent and is a complete no-op, so a transient LLM hiccup can
 * never mass-retire a memory's derived set.
 */
@Slf4j
public class OntologyReconciler {
  private static final String ONTOLOGY_BOT_NAME = "ontology-bot";
  private static final String CORE_FIELDS = "";

  private final GlossaryTermRepository termRepo;
  private final MetricRepository metricRepo;
  private final GlossaryRepository glossaryRepo;

  public OntologyReconciler(
      final GlossaryTermRepository termRepo,
      final MetricRepository metricRepo,
      final GlossaryRepository glossaryRepo) {
    this.termRepo = termRepo;
    this.metricRepo = metricRepo;
    this.glossaryRepo = glossaryRepo;
  }

  /** Tally of what a reconcile run did, by ownership outcome. */
  public record ReconcileResult(int createdTerms, int createdMetrics, int reused, int retired) {
    /** Total entities created; kept for call sites that do not need axis-level granularity. */
    public int created() {
      return createdTerms + createdMetrics;
    }
  }

  public ReconcileResult reconcile(
      final ContextMemory memory, final OntologyDerivation verdict, final AIDeletionPolicy policy) {
    final ReconcileResult result;
    if (isAllSkip(verdict)) {
      LOG.info("All-SKIP derivation for memory {}; skipping reconcile entirely", memory.getId());
      result = new ReconcileResult(0, 0, 0, 0);
    } else {
      result = reconcileNonSkip(memory, verdict, policy);
    }
    return result;
  }

  private ReconcileResult reconcileNonSkip(
      final ContextMemory memory, final OntologyDerivation verdict, final AIDeletionPolicy policy) {
    final Counts counts = new Counts();
    final String impliedTerm = applyTermAxis(memory, verdict.termVerdict(), counts);
    final String impliedMetric = applyMetricAxis(memory, verdict.metricVerdict(), counts);
    retireStaleOwned(memory, Entity.GLOSSARY_TERM, termRepo, impliedTerm, policy, counts);
    retireStaleOwned(memory, Entity.METRIC, metricRepo, impliedMetric, policy, counts);
    LOG.info(
        "Reconciled ontology for memory {}: {} terms created, {} metrics created, {} reused, {} retired",
        memory.getId(),
        counts.createdTerms,
        counts.createdMetrics,
        counts.reused,
        counts.retired);
    return new ReconcileResult(
        counts.createdTerms, counts.createdMetrics, counts.reused, counts.retired);
  }

  private boolean isAllSkip(final OntologyDerivation verdict) {
    return isSkip(verdict.termVerdict()) && isSkip(verdict.metricVerdict());
  }

  private boolean isSkip(final OntologyVerdict verdict) {
    final String action = verdict == null ? OntologyAction.SKIP : verdict.action();
    return action == null || OntologyAction.SKIP.equals(action);
  }

  private String applyTermAxis(
      final ContextMemory memory, final OntologyVerdict verdict, final Counts counts) {
    final String action = verdict == null ? OntologyAction.SKIP : verdict.action();
    String implied = null;
    if (OntologyAction.CREATE.equals(action)) {
      implied = createTerm(memory, verdict, counts);
    } else if (OntologyAction.REUSE.equals(action)) {
      reuse(memory, verdict, Entity.GLOSSARY_TERM, termRepo, counts);
    }
    return implied;
  }

  private String applyMetricAxis(
      final ContextMemory memory, final OntologyVerdict verdict, final Counts counts) {
    final String action = verdict == null ? OntologyAction.SKIP : verdict.action();
    String implied = null;
    if (OntologyAction.CREATE.equals(action)) {
      implied = createMetric(memory, verdict, counts);
    } else if (OntologyAction.REUSE.equals(action)) {
      reuse(memory, verdict, Entity.METRIC, metricRepo, counts);
    }
    return implied;
  }

  private String createTerm(
      final ContextMemory memory, final OntologyVerdict verdict, final Counts counts) {
    final EntityReference existingOwned =
        findOwnedByName(memory, Entity.GLOSSARY_TERM, termRepo, verdict.name());
    if (existingOwned == null) {
      final EntityReference glossary = resolveOrMintGlossary(verdict);
      final GlossaryTerm term =
          new GlossaryTerm()
              .withName(verdict.name())
              .withDisplayName(verdict.displayName())
              .withDescription(verdict.description())
              .withGlossary(glossary)
              .withProvider(ProviderType.AUTOMATION)
              .withUpdatedBy(ONTOLOGY_BOT_NAME);
      final GlossaryTerm created = termRepo.createInternal(term);
      addDerivedFromEdge(created.getId(), memory.getId(), Entity.GLOSSARY_TERM, termRepo);
      counts.createdTerms++;
    }
    return verdict.name();
  }

  private String createMetric(
      final ContextMemory memory, final OntologyVerdict verdict, final Counts counts) {
    final EntityReference existingOwned =
        findOwnedByName(memory, Entity.METRIC, metricRepo, verdict.name());
    if (existingOwned == null) {
      final Metric metric =
          new Metric()
              .withName(verdict.name())
              .withDisplayName(verdict.displayName())
              .withDescription(verdict.description())
              .withMetricType(toMetricType(verdict.metricType()))
              .withUnitOfMeasurement(toUnit(verdict.unitOfMeasurement()))
              .withMetricExpression(toExpression(verdict.metricExpressionCode()))
              .withProvider(ProviderType.AUTOMATION)
              .withUpdatedBy(ONTOLOGY_BOT_NAME);
      final Metric created = metricRepo.createInternal(metric);
      addDerivedFromEdge(created.getId(), memory.getId(), Entity.METRIC, metricRepo);
      counts.createdMetrics++;
    }
    return verdict.name();
  }

  private void reuse(
      final ContextMemory memory,
      final OntologyVerdict verdict,
      final String entityType,
      final EntityRepository<?> repo,
      final Counts counts) {
    final EntityInterface target = findByFqn(repo, verdict.targetFqn());
    if (target == null) {
      LOG.warn(
          "REUSE verdict for {} could not resolve fqn '{}'; skipping",
          entityType,
          verdict.targetFqn());
    } else {
      repo.addRelationship(
          memory.getId(),
          target.getId(),
          Entity.CONTEXT_MEMORY,
          entityType,
          Relationship.RELATED_TO,
          false);
      counts.reused++;
    }
  }

  private EntityReference resolveOrMintGlossary(final OntologyVerdict verdict) {
    EntityReference glossary = resolveGlossary(verdict.targetFqn());
    if (glossary == null) {
      final Glossary minted =
          new Glossary()
              .withName(verdict.newGlossaryName())
              .withDisplayName(verdict.newGlossaryName())
              .withDescription(verdict.newGlossaryDescription())
              .withProvider(ProviderType.AUTOMATION)
              .withUpdatedBy(ONTOLOGY_BOT_NAME);
      glossary = glossaryRepo.createInternal(minted).getEntityReference();
    }
    return glossary;
  }

  private EntityReference resolveGlossary(final String fqn) {
    EntityReference ref = null;
    if (!nullOrEmpty(fqn)) {
      final Glossary glossary = glossaryRepo.findByNameOrNull(fqn, Include.NON_DELETED);
      ref = glossary == null ? null : glossary.getEntityReference();
    }
    return ref;
  }

  private EntityInterface findByFqn(final EntityRepository<?> repo, final String fqn) {
    EntityInterface entity = null;
    if (!nullOrEmpty(fqn)) {
      entity = repo.findByNameOrNull(fqn, Include.NON_DELETED);
    }
    return entity;
  }

  private EntityReference findOwnedByName(
      final ContextMemory memory,
      final String entityType,
      final EntityRepository<?> repo,
      final String name) {
    EntityReference match = null;
    for (final EntityReference owned : ownedDerived(memory, entityType, repo)) {
      if (Objects.equals(owned.getName(), name)) {
        match = owned;
      }
    }
    return match;
  }

  private void retireStaleOwned(
      final ContextMemory memory,
      final String entityType,
      final EntityRepository<?> repo,
      final String impliedName,
      final AIDeletionPolicy policy,
      final Counts counts) {
    for (final EntityReference owned : ownedDerived(memory, entityType, repo)) {
      if (!Objects.equals(owned.getName(), impliedName) && isAutomationOwned(repo, owned)) {
        retireByPolicy(memory, entityType, repo, owned, true, policy);
        counts.retired++;
      }
    }
  }

  public void onMemoryDeleted(
      final ContextMemory memory, final boolean hardDelete, final AIDeletionPolicy policy) {
    retireAllOwned(memory, Entity.GLOSSARY_TERM, termRepo, hardDelete, policy);
    retireAllOwned(memory, Entity.METRIC, metricRepo, hardDelete, policy);
    dropReusedLinks(memory, Entity.GLOSSARY_TERM, termRepo);
    dropReusedLinks(memory, Entity.METRIC, metricRepo);
  }

  /**
   * Restores CASCADE-soft-deleted owned entities when their source memory is restored. Only
   * automation-owned entities that still have a {@code DERIVED_FROM} edge back to this memory are
   * restored — ORPHAN/DEPRECATE-released entities lost that edge during deletion, so they are
   * correctly NOT re-linked. {@link EntityRepository#restoreEntity} is a no-op on already-active
   * entities, so calling it unconditionally on all {@code Include.ALL} results is safe.
   */
  public void onMemoryRestored(final ContextMemory memory) {
    restoreOwnedByType(memory, Entity.GLOSSARY_TERM, termRepo);
    restoreOwnedByType(memory, Entity.METRIC, metricRepo);
  }

  private void restoreOwnedByType(
      final ContextMemory memory, final String entityType, final EntityRepository<?> repo) {
    for (final EntityReference ref :
        repo.findFrom(
            memory.getId(),
            Entity.CONTEXT_MEMORY,
            Relationship.DERIVED_FROM,
            entityType,
            Include.ALL)) {
      if (isAutomationOwnedIncludeAll(repo, ref)) {
        repo.restoreEntity(ONTOLOGY_BOT_NAME, ref.getId());
      }
    }
  }

  private boolean isAutomationOwnedIncludeAll(
      final EntityRepository<?> repo, final EntityReference ref) {
    final EntityInterface entity = repo.find(ref.getId(), Include.ALL);
    return entity.getProvider() == ProviderType.AUTOMATION;
  }

  private void retireAllOwned(
      final ContextMemory memory,
      final String entityType,
      final EntityRepository<?> repo,
      final boolean hardDelete,
      final AIDeletionPolicy policy) {
    for (final EntityReference owned : ownedDerived(memory, entityType, repo)) {
      if (isAutomationOwned(repo, owned)) {
        retireByPolicy(memory, entityType, repo, owned, hardDelete, policy);
      }
    }
  }

  private void retireByPolicy(
      final ContextMemory memory,
      final String entityType,
      final EntityRepository<?> repo,
      final EntityReference owned,
      final boolean hardDelete,
      final AIDeletionPolicy policy) {
    switch (policy) {
      case CASCADE -> repo.delete(ONTOLOGY_BOT_NAME, owned.getId(), false, hardDelete);
      case ORPHAN -> {
        editOwned(repo, owned.getId(), entity -> setProvider(entity, ProviderType.USER));
        dropDerivedFromEdge(memory, entityType, repo, owned.getId());
      }
      case DEPRECATE -> {
        editOwned(repo, owned.getId(), entity -> entity.setEntityStatus(EntityStatus.DEPRECATED));
        dropDerivedFromEdge(memory, entityType, repo, owned.getId());
      }
    }
  }

  private void dropReusedLinks(
      final ContextMemory memory, final String entityType, final EntityRepository<?> repo) {
    final List<EntityReference> reused =
        repo.findTo(memory.getId(), Entity.CONTEXT_MEMORY, Relationship.RELATED_TO, entityType);
    for (final EntityReference link : reused) {
      repo.deleteRelationship(
          memory.getId(), Entity.CONTEXT_MEMORY, link.getId(), entityType, Relationship.RELATED_TO);
    }
  }

  private void editOwned(
      final EntityRepository<?> repo, final UUID id, final Consumer<EntityInterface> mutation) {
    editOwnedTyped(repo, id, mutation);
  }

  private <T extends EntityInterface> void editOwnedTyped(
      final EntityRepository<T> repo, final UUID id, final Consumer<EntityInterface> mutation) {
    final T original = repo.get(null, id, repo.getFields(CORE_FIELDS));
    final T updated = JsonUtils.deepCopy(original, repo.getEntityClass());
    mutation.accept(updated);
    updated.setUpdatedBy(ONTOLOGY_BOT_NAME);
    updated.setUpdatedAt(System.currentTimeMillis());
    repo.update(null, original, updated, ONTOLOGY_BOT_NAME);
  }

  private void dropDerivedFromEdge(
      final ContextMemory memory,
      final String entityType,
      final EntityRepository<?> repo,
      final UUID derivedId) {
    repo.deleteRelationship(
        derivedId, entityType, memory.getId(), Entity.CONTEXT_MEMORY, Relationship.DERIVED_FROM);
  }

  private void addDerivedFromEdge(
      final UUID derivedId,
      final UUID memoryId,
      final String entityType,
      final EntityRepository<?> repo) {
    repo.addRelationship(
        derivedId, memoryId, entityType, Entity.CONTEXT_MEMORY, Relationship.DERIVED_FROM, false);
  }

  private List<EntityReference> ownedDerived(
      final ContextMemory memory, final String entityType, final EntityRepository<?> repo) {
    return repo.findFrom(
        memory.getId(), Entity.CONTEXT_MEMORY, Relationship.DERIVED_FROM, entityType);
  }

  private boolean isAutomationOwned(final EntityRepository<?> repo, final EntityReference ref) {
    final EntityInterface entity = repo.get(null, ref.getId(), repo.getFields(CORE_FIELDS));
    return entity.getProvider() == ProviderType.AUTOMATION;
  }

  private void setProvider(final EntityInterface entity, final ProviderType provider) {
    if (entity instanceof GlossaryTerm term) {
      term.setProvider(provider);
    } else if (entity instanceof Metric metric) {
      metric.setProvider(provider);
    }
  }

  private MetricExpression toExpression(final String code) {
    MetricExpression expression = null;
    if (!nullOrEmpty(code)) {
      expression = new MetricExpression().withLanguage(MetricExpressionLanguage.SQL).withCode(code);
    }
    return expression;
  }

  private MetricType toMetricType(final String value) {
    return nullOrEmpty(value) ? null : MetricType.fromValue(value);
  }

  private MetricUnitOfMeasurement toUnit(final String value) {
    return nullOrEmpty(value) ? null : MetricUnitOfMeasurement.fromValue(value);
  }

  /** Mutable tally threaded through reconciliation to keep each step a small single-purpose method. */
  private static final class Counts {
    private int createdTerms;
    private int createdMetrics;
    private int reused;
    private int retired;
  }
}
