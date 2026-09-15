package org.openmetadata.service.entity.write;

import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import java.time.Clock;
import java.util.List;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import java.util.function.UnaryOperator;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;

/** Preserves the ordered PATCH preparation contract, including secret and impersonation handling. */
public final class EntityPatchPreparation<T extends EntityInterface> {
  public record Rules<T>(
      Consumer<T> prepare, BiConsumer<T, T> evaluate, BiConsumer<T, T> restoreAttributes) {}

  public record References(
      UnaryOperator<List<EntityReference>> owners, UnaryOperator<List<EntityReference>> domains) {}

  private final BiFunction<T, T, T> restoreSecrets;
  private final Rules<T> rules;
  private final References references;
  private final Clock clock;

  public EntityPatchPreparation(
      final BiFunction<T, T, T> restoreSecrets,
      final Rules<T> rules,
      final References references,
      final Clock clock) {
    this.restoreSecrets = restoreSecrets;
    this.rules = rules;
    this.references = references;
    this.clock = clock;
  }

  public T prepare(final T original, final T patched, final EntityCommandActor actor) {
    final T updated;
    try (var ignored = phase("patchRestoreSecrets")) {
      updated = restoreSecrets.apply(original, patched);
    }
    updated.setUpdatedBy(actor.user());
    updated.setUpdatedAt(clock.millis());
    applyRules(original, updated);
    validateReferences(updated);
    try (var ignored = phase("patchRestoreAttributes")) {
      rules.restoreAttributes().accept(original, updated);
    }
    updated.setImpersonatedBy(actor.impersonatedBy());
    return updated;
  }

  private void applyRules(final T original, final T updated) {
    try (var ignored = phase("patchPrepareInternal")) {
      rules.prepare().accept(updated);
    }
    try (var ignored = phase("patchRuleEvaluation")) {
      rules.evaluate().accept(original, updated);
    }
  }

  private void validateReferences(final T updated) {
    final List<EntityReference> owners;
    try (var ignored = phase("patchValidateOwners")) {
      owners = references.owners().apply(updated.getOwners());
    }
    updated.setOwners(owners);
    final List<EntityReference> domains;
    try (var ignored = phase("patchValidateDomains")) {
      domains = references.domains().apply(updated.getDomains());
    }
    updated.setDomains(domains);
  }
}
