package org.openmetadata.service.entity.metadata;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.SEPARATOR;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.BiFunction;
import java.util.function.ToIntFunction;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;

/** Keeps task and workflow references attached to renamed entities within the owning flush. */
@Slf4j
public final class EntityWorkflowReferences {
  public record Rename(String entityType, String oldFqn, String newFqn) {}

  public record Subtree(String oldLink, String oldChildPrefix, String oldStem, String newStem) {
    private static Subtree from(final Rename rename) {
      final String oldLink = new EntityLink(rename.entityType(), rename.oldFqn()).getLinkString();
      final String newLink = new EntityLink(rename.entityType(), rename.newFqn()).getLinkString();
      final String oldStem = oldLink.substring(0, oldLink.length() - 1);
      final String newStem = newLink.substring(0, newLink.length() - 1);
      return new Subtree(oldLink, oldStem + SEPARATOR + "%", oldStem, newStem);
    }
  }

  private final BiFunction<List<String>, List<String>, int[]> tasks;
  private final ToIntFunction<Subtree> instances;

  public EntityWorkflowReferences(
      final BiFunction<List<String>, List<String>, int[]> tasks,
      final ToIntFunction<Subtree> instances) {
    this.tasks = tasks;
    this.instances = instances;
  }

  public void renameTasks(final Map<String, String> updates) {
    if (nullOrEmpty(updates)) {
      return;
    }
    final int[] counts =
        tasks.apply(new ArrayList<>(updates.keySet()), new ArrayList<>(updates.values()));
    int rows = 0;
    for (final int count : counts) {
      rows += count;
    }
    LOG.info("[fqn-change] task aboutFqnHash updates={} rowsUpdated={}", updates.size(), rows);
  }

  public void renameInstances(final Rename rename) {
    final int count = instances.applyAsInt(Subtree.from(rename));
    if (count > 0) {
      LOG.info(
          "[fqn-change] repointed workflow instances {} -> {} rows={}",
          rename.oldFqn(),
          rename.newFqn(),
          count);
    }
  }
}
