package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.entity.metadata.DerivedTagLoader.FailureMode;
import org.openmetadata.service.util.EntityUtil.Fields;

class EntityFieldLoadingTest {
  private static final Fields FIELDS = new Fields(Set.of("owners", "tags", "certification"));

  @Test
  void sharedMetadataPrecedesCustomFieldsAndSuppressesHandledRelationshipFetchers() {
    final var loading = loading();
    loading.register(
        "owners",
        (entities, fields) -> {
          throw new AssertionError("Repeated owner read");
        });
    loading.register(
        "custom",
        (entities, fields) ->
            entities.forEach(
                entity ->
                    entity.setDescription(
                        entity.getOwners().getFirst().getName()
                            + ":"
                            + entity.getTags().getFirst().getTagFQN())));
    final Container entity = new Container();
    loading.populate(List.of(entity), FIELDS);
    assertEquals("owner:classification.label", entity.getDescription());
  }

  @Test
  void exclusionsPreserveCustomValuesWhileSharedRelationshipsStillLoad() {
    final var loading = loading();
    loading.register(
        "tags",
        (entities, fields) -> {
          throw new AssertionError("Excluded tag fetcher");
        });
    final List<TagLabel> previous = List.of(new TagLabel().withTagFQN("previous.label"));
    final Container entity = new Container().withTags(previous);
    loading.populate(List.of(entity), FIELDS, Set.of("tags", "owners"));
    assertSame(previous, entity.getTags());
    assertEquals("owner", entity.getOwners().getFirst().getName());
    assertEquals("certification selected", entity.getDisplayName());
  }

  @Test
  void replacingARegisteredPolicyUsesTheLatestImplementation() {
    final var loading = loading();
    loading.register(
        "custom", (entities, fields) -> entities.forEach(entity -> entity.setDescription("old")));
    loading.register(
        "custom",
        (entities, fields) -> entities.forEach(entity -> entity.setDescription("current")));
    final Container entity = new Container();
    loading.populate(List.of(entity), FIELDS);
    assertEquals("current", entity.getDescription());
  }

  @Test
  void tagFailuresStopCustomHydrationAndRetainAlreadyResolvedRelationships() {
    final var failure = new IllegalStateException("unavailable tags");
    final var loading =
        new EntityFieldLoading<Container>(
            (entities, fields) -> {
              entities.getFirst().setDisplayName("relationships resolved");
              return Set.of();
            },
            (entities, projection) -> {
              throw failure;
            },
            () -> FailureMode.PROPAGATE);
    loading.register(
        "custom", (entities, fields) -> entities.getFirst().setDescription("must not run"));
    final Container entity = new Container().withDescription("original");
    assertSame(
        failure,
        assertThrows(IllegalStateException.class, () -> loading.populate(List.of(entity), FIELDS)));
    assertEquals("relationships resolved", entity.getDisplayName());
    assertEquals("original", entity.getDescription());
  }

  @Test
  void emptySelectionsStillReachRegisteredPoliciesAndResolveTheCurrentFailureMode() {
    final var current = new AtomicReference<>(FailureMode.PROPAGATE);
    final List<FailureMode> modes = new ArrayList<>();
    final List<String> completed = new ArrayList<>();
    final var loading =
        new EntityFieldLoading<Container>(
            (entities, fields) -> Set.of(),
            (entities, projection) -> {
              assertEquals(false, projection.tags());
              assertEquals(false, projection.certification());
              modes.add(projection.failureMode());
            },
            current::get);
    loading.register("custom", (entities, fields) -> completed.add("empty request"));
    loading.populate(List.of(), Fields.EMPTY_FIELDS);
    current.set(FailureMode.FALL_BACK_TO_INDIVIDUAL);
    loading.populate(List.of(), Fields.EMPTY_FIELDS);
    assertEquals(List.of(FailureMode.PROPAGATE, FailureMode.FALL_BACK_TO_INDIVIDUAL), modes);
    assertEquals(List.of("empty request", "empty request"), completed);
  }

  private static EntityFieldLoading<Container> loading() {
    return new EntityFieldLoading<>(
        (entities, fields) -> {
          entities.forEach(
              entity -> entity.setOwners(List.of(new EntityReference().withName("owner"))));
          return Set.of("owners");
        },
        (entities, projection) ->
            entities.forEach(
                entity -> {
                  if (projection.tags())
                    entity.setTags(List.of(new TagLabel().withTagFQN("classification.label")));
                  if (projection.certification()) entity.setDisplayName("certification selected");
                }),
        () -> FailureMode.PROPAGATE);
  }
}
