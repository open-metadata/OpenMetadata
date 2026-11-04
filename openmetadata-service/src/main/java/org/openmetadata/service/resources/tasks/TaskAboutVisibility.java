package org.openmetadata.service.resources.tasks;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext;

import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ViewPermissionFilter;
import org.openmetadata.service.security.policyevaluator.RowDecisionGate;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * A task discloses the entity it is about, so reading it also needs ViewBasic on that entity
 * (ADR:2026-11-03-read-handlers-authorize-like-the-entity-reads-they-mirror). Reads by id check
 * their one task; a listing checks its page here, in one batch.
 */
public final class TaskAboutVisibility {
  private static final List<MetadataOperation> VIEW_BASIC = List.of(MetadataOperation.VIEW_BASIC);

  private final ViewPermissionFilter viewPermissionFilter;

  public TaskAboutVisibility(Authorizer authorizer) {
    this.viewPermissionFilter = new ViewPermissionFilter(authorizer);
  }

  /**
   * The page without the tasks about an entity the caller may not view. It is not refilled, so it
   * can come back short; a task about no entity keeps the decision made on the task itself.
   */
  public ResultList<Task> retainViewable(SecurityContext securityContext, ResultList<Task> page) {
    List<Task> tasks = listOrEmpty(page.getData());
    Map<UUID, List<EntityReference>> aboutByTask = aboutEntities(tasks);
    Set<UUID> hidden = hiddenEntities(securityContext, aboutByTask.values());
    if (!hidden.isEmpty()) {
      page.setData(
          tasks.stream()
              .filter(task -> !isAboutAnyOf(aboutByTask.get(task.getId()), hidden))
              .collect(Collectors.toCollection(ArrayList::new)));
    }
    return page;
  }

  /** The entities each task is about, read for the whole page in one query. */
  private static Map<UUID, List<EntityReference>> aboutEntities(List<Task> tasks) {
    Map<UUID, List<EntityReference>> aboutByTask = new HashMap<>();
    if (!tasks.isEmpty()) {
      List<String> taskIds = tasks.stream().map(task -> task.getId().toString()).toList();
      for (CollectionDAO.EntityRelationshipObject about :
          Entity.getCollectionDAO()
              .relationshipDAO()
              .findFromBatch(taskIds, Entity.TASK, Relationship.MENTIONED_IN.ordinal())) {
        aboutByTask
            .computeIfAbsent(UUID.fromString(about.getToId()), taskId -> new ArrayList<>())
            .add(
                new EntityReference()
                    .withId(UUID.fromString(about.getFromId()))
                    .withType(about.getFromEntity()));
      }
    }
    return aboutByTask;
  }

  /**
   * The ids among {@code entities} the caller may not view. A type whose every entity the caller
   * may view, as for an admin, is not checked; a check that fails hides the entity.
   */
  private Set<UUID> hiddenEntities(
      SecurityContext securityContext, Collection<List<EntityReference>> entities) {
    SubjectContext subject = getSubjectContext(securityContext);
    Map<String, Boolean> typeMayDiffer = new HashMap<>();
    List<EntityReference> toCheck =
        entities.stream()
            .flatMap(List::stream)
            .filter(
                entity ->
                    typeMayDiffer.computeIfAbsent(
                        entity.getType(),
                        type -> RowDecisionGate.mayDiffer(subject, type, VIEW_BASIC)))
            .toList();
    Set<UUID> viewable =
        toCheck.isEmpty() ? Set.of() : viewPermissionFilter.viewableIds(securityContext, toCheck);
    return toCheck.stream()
        .map(EntityReference::getId)
        .filter(id -> !viewable.contains(id))
        .collect(Collectors.toSet());
  }

  private static boolean isAboutAnyOf(List<EntityReference> about, Set<UUID> entityIds) {
    return listOrEmpty(about).stream().anyMatch(entity -> entityIds.contains(entity.getId()));
  }
}
