package org.openmetadata.service.entity.delete;

import static org.mockito.Mockito.lenient;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.service.entity.policy.EntityPolicy;

public final class EntitySubtreeFixture implements EntitySubtree {

  public record Change(EntityHierarchy.Action action, List<UUID> ids, String actor) {

    public Change {
      ids = List.copyOf(ids);
    }
  }

  private final List<Change> changes = new ArrayList<>();

  public static EntitySubtreeFixture attach(final EntityPolicy<?> repository) {
    final var fixture = new EntitySubtreeFixture();
    lenient().when(repository.subtrees()).thenReturn(fixture);
    lenient()
        .when(repository.restores())
        .thenReturn(
            (actor, id) -> {
              throw new AssertionError("Expected a batch restoration");
            });
    return fixture;
  }

  public List<Change> changes() {
    return List.copyOf(changes);
  }

  @Override
  public void bulkRestoreSubtree(final List<UUID> ids, final String actor) {
    changes.add(new Change(EntityHierarchy.Action.RESTORE, ids, actor));
  }

  @Override
  public void bulkSoftDeleteSubtree(final List<UUID> ids, final String actor) {
    changes.add(new Change(EntityHierarchy.Action.SOFT_DELETE, ids, actor));
  }

  @Override
  public void bulkHardDeleteSubtree(final List<UUID> ids, final String actor) {
    changes.add(new Change(EntityHierarchy.Action.HARD_DELETE, ids, actor));
  }
}
