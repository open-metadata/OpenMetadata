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

package org.openmetadata.service.drive.memory;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
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
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.MetricRepository;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.MemoryOwnership;

/**
 * Owns every ontology write: it turns an {@link MemoryDerivation} into real Glossary Terms and
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
 * all-SKIP derivation (the signal {@code MemoryExtractor} emits on an empty or failed LLM result)
 * is treated as carrying no actionable intent and is a complete no-op, so a transient LLM hiccup can
 * never mass-retire a memory's derived set.
 */
@Slf4j
public class MemoryReconciler {
  private static final String CORE_FIELDS = "";

  /** Default SKOS-style relation used when the agent links a term to its sibling concepts. */
  private static final String RELATION_TYPE_RELATED_TO = "relatedTo";

  private static final MemoryContext EMPTY_CONTEXT =
      new MemoryContext(List.of(), List.of(), List.of());

  private final GlossaryTermRepository termRepo;
  private final MetricRepository metricRepo;
  private final GlossaryRepository glossaryRepo;

  public MemoryReconciler(
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

  /**
   * Convenience overload with both axes enabled; used by unit tests and any caller that does not
   * need per-axis gating.
   */
  public ReconcileResult reconcile(
      final ContextMemory memory, final MemoryDerivation verdict, final AIDeletionPolicy policy) {
    return reconcile(memory, verdict, EMPTY_CONTEXT, policy, true, true);
  }

  public ReconcileResult reconcile(
      final ContextMemory memory,
      final MemoryDerivation verdict,
      final MemoryContext context,
      final AIDeletionPolicy policy,
      final boolean deriveTerms,
      final boolean deriveMetrics) {
    final MemoryContext ctx = context == null ? EMPTY_CONTEXT : context;
    final ReconcileResult result;
    if (isAllSkip(verdict)) {
      LOG.info("All-SKIP derivation for memory {}; skipping reconcile entirely", memory.getId());
      result = new ReconcileResult(0, 0, 0, 0);
    } else {
      result = reconcileNonSkip(memory, verdict, ctx, policy, deriveTerms, deriveMetrics);
    }
    return result;
  }

  private ReconcileResult reconcileNonSkip(
      final ContextMemory memory,
      final MemoryDerivation verdict,
      final MemoryContext ctx,
      final AIDeletionPolicy policy,
      final boolean deriveTerms,
      final boolean deriveMetrics) {
    final Counts counts = new Counts();
    if (deriveTerms) {
      final String implied = applyTermAxis(memory, verdict.termVerdict(), ctx, counts);
      retireStaleOwned(memory, Entity.GLOSSARY_TERM, termRepo, implied, policy, counts);
    }
    if (deriveMetrics) {
      final String implied = applyMetricAxis(memory, verdict.metricVerdict(), counts);
      retireStaleOwned(memory, Entity.METRIC, metricRepo, implied, policy, counts);
    }
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

  private boolean isAllSkip(final MemoryDerivation verdict) {
    return isSkip(verdict.termVerdict()) && isSkip(verdict.metricVerdict());
  }

  private boolean isSkip(final MemoryVerdict verdict) {
    final String action = verdict == null ? MemoryAction.SKIP : verdict.action();
    return action == null || MemoryAction.SKIP.equals(action);
  }

  private String applyTermAxis(
      final ContextMemory memory,
      final MemoryVerdict verdict,
      final MemoryContext ctx,
      final Counts counts) {
    final String action = verdict == null ? MemoryAction.SKIP : verdict.action();
    String implied = null;
    if (MemoryAction.CREATE.equals(action)) {
      implied = createTerm(memory, verdict, ctx, counts);
    } else if (MemoryAction.REUSE.equals(action)) {
      reuseTerm(memory, verdict, counts);
    }
    return implied;
  }

  private String applyMetricAxis(
      final ContextMemory memory, final MemoryVerdict verdict, final Counts counts) {
    final String action = verdict == null ? MemoryAction.SKIP : verdict.action();
    String implied = null;
    if (MemoryAction.CREATE.equals(action)) {
      implied = createMetric(memory, verdict, counts);
    } else if (MemoryAction.REUSE.equals(action)) {
      reuse(memory, verdict, Entity.METRIC, metricRepo, counts);
    }
    return implied;
  }

  private String createTerm(
      final ContextMemory memory,
      final MemoryVerdict verdict,
      final MemoryContext ctx,
      final Counts counts) {
    if (!isValidName(verdict.name())) {
      LOG.warn("Skipping CREATE term: invalid LLM name '{}'", verdict.name());
      return null;
    }
    final EntityReference existingOwned =
        findOwnedByName(memory, Entity.GLOSSARY_TERM, termRepo, verdict.name());
    final String result;
    if (existingOwned != null) {
      wireRelatedTerms(existingOwned.getId(), verdict.relatedTerms());
      result = verdict.name();
    } else {
      result = createTermWithFqnPrecheck(memory, verdict, ctx, counts);
    }
    return result;
  }

  private String createTermWithFqnPrecheck(
      final ContextMemory memory,
      final MemoryVerdict verdict,
      final MemoryContext ctx,
      final Counts counts) {
    final String glossaryFqn = resolveGlossaryFqn(verdict, ctx);
    final String termFqn =
        nullOrEmpty(glossaryFqn) ? null : FullyQualifiedName.build(glossaryFqn, verdict.name());
    final EntityInterface existing = findByFqn(termRepo, termFqn);
    final String result;
    if (existing != null) {
      LOG.info("Term FQN '{}' already exists; reusing instead of creating", termFqn);
      reuseExisting(memory, existing, Entity.GLOSSARY_TERM, termRepo, counts);
      wireRelatedTerms(existing.getId(), verdict.relatedTerms());
      result = verdict.name();
    } else {
      result = mintTerm(memory, verdict, ctx, counts);
    }
    return result;
  }

  /**
   * Picks the glossary FQN to file a CREATE term under: the agent's explicit choice, else the
   * glossary the source document's sibling terms already live in (so one document maps to one
   * glossary instead of sprawling), else the agent's proposed new glossary name.
   */
  private String resolveGlossaryFqn(final MemoryVerdict verdict, final MemoryContext ctx) {
    final String fqn;
    if (!nullOrEmpty(verdict.targetFqn())) {
      fqn = verdict.targetFqn();
    } else if (ctx != null && !nullOrEmpty(ctx.siblingGlossaryFqn())) {
      fqn = ctx.siblingGlossaryFqn();
    } else if (!nullOrEmpty(verdict.newGlossaryName())) {
      fqn = verdict.newGlossaryName();
    } else {
      fqn = null;
    }
    return fqn;
  }

  private String mintTerm(
      final ContextMemory memory,
      final MemoryVerdict verdict,
      final MemoryContext ctx,
      final Counts counts) {
    final EntityReference glossary = resolveOrMintGlossary(verdict, ctx);
    String result = null;
    if (glossary != null) {
      final GlossaryTerm term =
          new GlossaryTerm()
              .withId(UUID.randomUUID())
              .withName(verdict.name())
              .withDisplayName(verdict.displayName())
              .withDescription(verdict.description())
              .withGlossary(glossary)
              .withProvider(ProviderType.AUTOMATION)
              .withUpdatedBy(MemoryOwnership.MEMORY_BOT_NAME)
              .withUpdatedAt(System.currentTimeMillis());
      final GlossaryTerm created = termRepo.createInternal(term);
      addDerivedFromEdge(created.getId(), memory.getId(), Entity.GLOSSARY_TERM, termRepo);
      wireRelatedTerms(created.getId(), verdict.relatedTerms());
      counts.createdTerms++;
      result = verdict.name();
    }
    return result;
  }

  /**
   * Connects a term to the other terms the agent named, with the typed relationship it chose
   * (SKOS-style: broader/narrower, partOf/hasPart, calculatedFrom/usedToCalculate, synonym, ...), so
   * a document's concepts form a real ontology instead of disconnected "related to" units. Each FQN
   * is resolved against existing terms (so a hallucinated name is dropped, not minted) and self-links
   * are skipped. {@link GlossaryTermRepository#addTermRelation} is idempotent, so re-derivation does
   * not duplicate edges, and it canonicalizes direction for inverse pairs (e.g. broader/narrower).
   */
  private void wireRelatedTerms(final UUID termId, final List<MemoryRelation> relations) {
    for (final MemoryRelation relation : listOrEmpty(relations)) {
      final EntityInterface related = findByFqn(termRepo, relation.targetFqn());
      if (related != null && !related.getId().equals(termId)) {
        termRepo.addTermRelation(
            termId,
            new TermRelation()
                .withTerm(related.getEntityReference())
                .withRelationType(normalizeRelationType(relation.relationType())));
      }
    }
  }

  /**
   * Maps the LLM's raw relation type to the glossary's allowed vocabulary (case-insensitive),
   * defaulting to {@code relatedTo}. Keeps {@link GlossaryTermRepository#addTermRelation} — which
   * throws {@code BadRequestException} on an unknown type — from aborting the whole derivation over a
   * bad LLM string.
   */
  private String normalizeRelationType(final String raw) {
    String result = RELATION_TYPE_RELATED_TO;
    if (!nullOrEmpty(raw)) {
      for (final String allowed : GlossaryTermRepository.DEFAULT_RELATION_TYPES) {
        if (allowed.equalsIgnoreCase(raw.trim())) {
          result = allowed;
        }
      }
    }
    return result;
  }

  private void reuseTerm(
      final ContextMemory memory, final MemoryVerdict verdict, final Counts counts) {
    final EntityInterface target = findByFqn(termRepo, verdict.targetFqn());
    if (target == null) {
      LOG.warn("REUSE verdict for term could not resolve fqn '{}'; skipping", verdict.targetFqn());
    } else {
      reuseExisting(memory, target, Entity.GLOSSARY_TERM, termRepo, counts);
      wireRelatedTerms(target.getId(), verdict.relatedTerms());
    }
  }

  private String createMetric(
      final ContextMemory memory, final MemoryVerdict verdict, final Counts counts) {
    if (!isValidName(verdict.name())) {
      LOG.warn("Skipping CREATE metric: invalid LLM name '{}'", verdict.name());
      return null;
    }
    final EntityReference existingOwned =
        findOwnedByName(memory, Entity.METRIC, metricRepo, verdict.name());
    final String result;
    if (existingOwned != null) {
      result = verdict.name();
    } else {
      result = createMetricWithFqnPrecheck(memory, verdict, counts);
    }
    return result;
  }

  private String createMetricWithFqnPrecheck(
      final ContextMemory memory, final MemoryVerdict verdict, final Counts counts) {
    final EntityInterface existing = findByFqn(metricRepo, verdict.name());
    final String result;
    if (existing != null) {
      LOG.info("Metric FQN '{}' already exists; reusing instead of creating", verdict.name());
      reuseExisting(memory, existing, Entity.METRIC, metricRepo, counts);
      result = verdict.name();
    } else {
      result = mintMetric(memory, verdict, counts);
    }
    return result;
  }

  private String mintMetric(
      final ContextMemory memory, final MemoryVerdict verdict, final Counts counts) {
    final Metric metric =
        new Metric()
            .withId(UUID.randomUUID())
            .withName(verdict.name())
            .withDisplayName(verdict.displayName())
            .withDescription(verdict.description())
            .withMetricType(toMetricType(verdict.metricType()))
            .withUnitOfMeasurement(toUnit(verdict.unitOfMeasurement()))
            .withMetricExpression(toExpression(verdict.metricExpressionCode()))
            .withProvider(ProviderType.AUTOMATION)
            .withUpdatedBy(MemoryOwnership.MEMORY_BOT_NAME)
            .withUpdatedAt(System.currentTimeMillis());
    final Metric created = metricRepo.createInternal(metric);
    addDerivedFromEdge(created.getId(), memory.getId(), Entity.METRIC, metricRepo);
    counts.createdMetrics++;
    return verdict.name();
  }

  private void reuse(
      final ContextMemory memory,
      final MemoryVerdict verdict,
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
      reuseExisting(memory, target, entityType, repo, counts);
    }
  }

  private void reuseExisting(
      final ContextMemory memory,
      final EntityInterface target,
      final String entityType,
      final EntityRepository<?> repo,
      final Counts counts) {
    repo.addRelationship(
        memory.getId(),
        target.getId(),
        Entity.CONTEXT_MEMORY,
        entityType,
        Relationship.RELATED_TO,
        false);
    counts.reused++;
  }

  private EntityReference resolveOrMintGlossary(
      final MemoryVerdict verdict, final MemoryContext ctx) {
    EntityReference glossary = resolveGlossary(verdict.targetFqn());
    if (glossary == null && ctx != null) {
      glossary = resolveGlossary(ctx.siblingGlossaryFqn());
    }
    if (glossary == null) {
      glossary = resolveOrMintByName(verdict);
    }
    return glossary;
  }

  private EntityReference resolveOrMintByName(final MemoryVerdict verdict) {
    if (!isValidName(verdict.newGlossaryName())) {
      LOG.warn("Skipping glossary mint: invalid LLM name '{}'", verdict.newGlossaryName());
      return null;
    }
    final EntityReference existing = resolveGlossary(verdict.newGlossaryName());
    final EntityReference result;
    if (existing != null) {
      result = existing;
    } else {
      result = mintGlossary(verdict);
    }
    return result;
  }

  private EntityReference mintGlossary(final MemoryVerdict verdict) {
    final Glossary minted =
        new Glossary()
            .withId(UUID.randomUUID())
            .withName(verdict.newGlossaryName())
            .withDisplayName(verdict.newGlossaryName())
            .withDescription(verdict.newGlossaryDescription())
            .withProvider(ProviderType.AUTOMATION)
            .withUpdatedBy(MemoryOwnership.MEMORY_BOT_NAME)
            .withUpdatedAt(System.currentTimeMillis());
    return glossaryRepo.createInternal(minted).getEntityReference();
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
        repo.restoreEntity(MemoryOwnership.MEMORY_BOT_NAME, ref.getId());
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
      case CASCADE -> repo.delete(
          MemoryOwnership.MEMORY_BOT_NAME, owned.getId(), false, hardDelete);
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
    updated.setUpdatedBy(MemoryOwnership.MEMORY_BOT_NAME);
    updated.setUpdatedAt(System.currentTimeMillis());
    repo.update(null, original, updated, MemoryOwnership.MEMORY_BOT_NAME);
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

  private boolean isValidName(final String name) {
    return !nullOrEmpty(name) && name.chars().noneMatch(c -> c == '.' || c == '"' || c == '/');
  }

  private MetricExpression toExpression(final String code) {
    MetricExpression expression = null;
    if (!nullOrEmpty(code)) {
      expression = new MetricExpression().withLanguage(MetricExpressionLanguage.SQL).withCode(code);
    }
    return expression;
  }

  private MetricType toMetricType(final String value) {
    return resolveEnum(value, MetricType.values(), MetricType::value, "metricType");
  }

  private MetricUnitOfMeasurement toUnit(final String value) {
    return resolveEnum(
        value,
        MetricUnitOfMeasurement.values(),
        MetricUnitOfMeasurement::value,
        "unitOfMeasurement");
  }

  /**
   * Promotes a raw LLM enum string to a schema enum, matching case-insensitively against the enum's
   * JSON values. Returns {@code null} (with a warning) when nothing matches instead of letting the
   * generated {@code fromValue} throw {@link IllegalArgumentException} and abort the entire
   * derivation — both fields are optional on the Metric schema, so an unset value is valid.
   */
  private static <E extends Enum<E>> E resolveEnum(
      final String raw, final E[] values, final Function<E, String> valueOf, final String label) {
    E result = null;
    if (!nullOrEmpty(raw)) {
      final String normalized = raw.trim();
      for (final E candidate : values) {
        if (valueOf.apply(candidate).equalsIgnoreCase(normalized)) {
          result = candidate;
        }
      }
      if (result == null) {
        LOG.warn("Ontology: ignoring unrecognized {} '{}' from LLM; leaving it unset", label, raw);
      }
    }
    return result;
  }

  /** Mutable tally threaded through reconciliation to keep each step a small single-purpose method. */
  private static final class Counts {
    private int createdTerms;
    private int createdMetrics;
    private int reused;
    private int retired;
  }
}
