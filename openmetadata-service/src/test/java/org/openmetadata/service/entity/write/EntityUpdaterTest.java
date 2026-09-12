package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_NAME;
import static org.openmetadata.service.Entity.PIPELINE;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.Repository;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class EntityUpdaterTest {
  @Test
  void deferredDiffKeepsCallerIdentityAndCapturesOnlySelectedFields() {
    final var repository = new TestRepository();
    final Pipeline original = entity("before").withDescription("old");
    final Pipeline updated = entity("after").withDescription("new");
    final var updater = repository.updater(original, updated, EntityOperation.PATCH);
    updater.setPatchedFields(Set.of(FIELD_DESCRIPTION));
    updater.updateWithDeferredStore();
    assertSame(original, updater.getOriginal());
    assertSame(updated, updater.getUpdated());
    assertEquals(original.getId(), updated.getId());
    assertEquals(1.1, updated.getVersion());
    assertEquals(
        List.of(FIELD_DESCRIPTION),
        updater.getIncrementalChangeDescription().getFieldsUpdated().stream()
            .map(change -> change.getName())
            .toList());
    assertFalse(updater.isEntityStored());
  }

  @Test
  void consolidationUsesTheCurrentMutationSnapshot() {
    final var repository = new TestRepository();
    final var updater = repository.updater(entity("first"), entity("after"), EntityOperation.PUT);
    updater.setPatchedFields(Set.of(FIELD_NAME));
    updater.setChangeDescription(new ChangeDescription());
    updater.applyChanges(false, false);
    assertEquals(
        "first", updater.getChangeDescription().getFieldsUpdated().getFirst().getOldValue());
    updater.setOriginal(entity("previous"));
    updater.setChangeDescription(new ChangeDescription());
    updater.applyChanges(false, true);
    assertEquals(
        "previous", updater.getChangeDescription().getFieldsUpdated().getFirst().getOldValue());
    assertEquals(
        "after", updater.getChangeDescription().getFieldsUpdated().getFirst().getNewValue());
  }

  @Test
  void softDeletionSkipsSharedMetadataAndEntityPolicies() {
    final Pipeline original = entity("before").withDeleted(false).withDescription("old");
    final Pipeline updated = entity("after").withDeleted(true).withDescription("new");
    final var updater =
        new TestRepository().updater(original, updated, EntityOperation.SOFT_DELETE);
    updater.updateWithDeferredStore();
    assertEquals(
        List.of("deleted"),
        updater.getIncrementalChangeDescription().getFieldsUpdated().stream()
            .map(change -> change.getName())
            .toList());
    assertEquals("new", updated.getDescription());
  }

  @Test
  void deferredEffectsRunOnceAndAReplayClearsOldAttemptGuards() {
    final var repository = new TestRepository();
    final var updater = repository.updater(entity("same"), entity("same"), EntityOperation.PUT);
    final List<String> published = new ArrayList<>();
    updater.deferReactOperation(() -> published.add("first"));
    updater.runDeferredReactOperations();
    updater.runDeferredReactOperations();
    assertEquals(List.of("first"), published);
    updater.deferReactOperation(() -> published.add("discarded"));
    updater.resetMutationAttempt();
    updater.deferReactOperation(() -> published.add("replayed"));
    updater.runDeferredReactOperations();
    assertEquals(List.of("first", "replayed"), published);
  }

  @Test
  void failingDeferredEffectDoesNotSuppressFollowingEffects() {
    final var updater =
        new TestRepository().updater(entity("same"), entity("same"), EntityOperation.PUT);
    final List<String> published = new ArrayList<>();
    updater.deferReactOperation(
        () -> {
          throw new IllegalStateException("failed effect");
        });
    updater.deferReactOperation(() -> published.add("after failure"));
    updater.runDeferredReactOperations();
    assertEquals(List.of("after failure"), published);
  }

  @Test
  void providerProtectionKeepsPutFallbackAndPatchRejection() {
    final var repository = new TestRepository();
    final Pipeline original = new ProviderPipeline(ProviderType.SYSTEM);
    final var put = new ProviderPipeline(ProviderType.USER);
    repository
        .updater(original, put, EntityOperation.PUT)
        .restrictSystemProviderChange(provider -> put.provider = provider);
    assertEquals(ProviderType.SYSTEM, put.getProvider());
    final var patch = new ProviderPipeline(ProviderType.USER);
    assertThrows(
        IllegalArgumentException.class,
        () ->
            repository
                .updater(original, patch, EntityOperation.PATCH)
                .restrictSystemProviderChange(provider -> patch.provider = provider));
    assertEquals(ProviderType.USER, patch.getProvider());
  }

  @Test
  void sharedContextDoesNotSharePatchSelectionOrMutationState() {
    final var repository = new TestRepository();
    final var first = repository.updater(entity("before"), entity("after"), EntityOperation.PUT);
    final var second = repository.updater(entity("before"), entity("after"), EntityOperation.PUT);
    first.setPatchedFields(Set.of(FIELD_DESCRIPTION));
    first.setChangeDescription(new ChangeDescription());
    second.setChangeDescription(new ChangeDescription());
    assertFalse(first.recordChange(FIELD_NAME, "before", "after"));
    assertTrue(second.recordChange(FIELD_NAME, "before", "after"));
    assertFalse(first.isEntityChanged());
    assertTrue(second.isEntityChanged());
  }

  private static Pipeline entity(final String name) {
    return new Pipeline()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(name)
        .withVersion(1.0)
        .withUpdatedBy("admin")
        .withUpdatedAt(10L);
  }

  private static final class ProviderPipeline extends Pipeline {
    private ProviderType provider;

    private ProviderPipeline(final ProviderType provider) {
      this.provider = provider;
      setName("same");
      setUpdatedBy("admin");
    }

    @Override
    public ProviderType getProvider() {
      return provider;
    }
  }

  @Repository
  private static final class TestRepository implements EntityPolicy<Pipeline> {
    private final EntityPolicyContext<Pipeline> entityContext;

    private TestRepository() {
      entityContext =
          new EntityPolicyContext<>(
              new EntityPolicyContext.Schema<>(
                  "pipelines", PIPELINE, Pipeline.class, mock(CollectionDAO.PipelineDAO.class)),
              new EntityPolicyContext.WriteFields(FIELD_DESCRIPTION, FIELD_DESCRIPTION, Set.of()),
              EntityModuleDependencies.standard());
      EntityModuleFactory.initialize(this, false);
    }

    private EntityUpdater<Pipeline> updater(
        Pipeline original, Pipeline updated, EntityOperation operation) {
      return new EntityUpdater<>(
          context().services().getUpdaterServices(),
          new EntityUpdateRequest<>(original, updated, operation, null, false),
          new EntitySpecificMutation<>() {
            @Override
            public void update(EntityUpdater<Pipeline> mutation, boolean consolidating) {
              mutation.recordChange(
                  FIELD_NAME, mutation.getOriginal().getName(), mutation.getUpdated().getName());
            }
          });
    }

    @Override
    public void setFields(Pipeline entity, Fields fields, RelationIncludes includes) {}

    @Override
    public void clearFields(Pipeline entity, Fields fields) {}

    @Override
    public void prepare(Pipeline entity, boolean update) {}

    @Override
    public void storeEntity(Pipeline entity, boolean update) {}

    @Override
    public void storeRelationships(Pipeline entity) {}

    @Override
    public EntityPolicyContext<Pipeline> context() {
      return entityContext;
    }
  }
}
