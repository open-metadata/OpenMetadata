package org.openmetadata.service.entity.delete;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.Entity.ANNOUNCEMENT;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TASK;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;
import org.openmetadata.service.jdbi3.EntityDAO;

class EntityFeedCleanupTest {
  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void unavailableTaskStorageDoesNotPreventAnnouncementCleanup(boolean batch) {
    final UUID tableId = UUID.randomUUID();
    final UUID announcementId = UUID.randomUUID();
    final UUID unrelatedId = UUID.randomUUID();
    final Set<UUID> persistedArtifacts = new HashSet<>(Set.of(announcementId, unrelatedId));
    final EntityRelationshipDAO relationships = mock(EntityRelationshipDAO.class);
    final EntityDAO<?> rows = mock(EntityDAO.class);
    when(relationships.findTo(any(), any(), anyInt(), any()))
        .thenAnswer(
            call -> {
              failTaskLookup(call.getArgument(3));
              return List.of(
                  EntityRelationshipRecord.builder().id(announcementId).type(ANNOUNCEMENT).build());
            });
    when(relationships.findToBatch(any(), anyInt(), anyString(), anyString()))
        .thenAnswer(
            call -> {
              failTaskLookup(call.getArgument(3));
              return List.of(
                  EntityRelationshipObject.builder().toId(announcementId.toString()).build());
            });
    doAnswer(
            call -> {
              persistedArtifacts.remove(call.getArgument(0));
              return null;
            })
        .when(rows)
        .delete(any());
    doAnswer(
            call -> {
              final List<UUID> ids = call.getArgument(0);
              persistedArtifacts.removeAll(ids);
              return ids.size();
            })
        .when(rows)
        .deleteByIds(any());
    final EntityFeedCleanup cleanup =
        new EntityFeedCleanup(
            TABLE,
            () -> relationships,
            List.of(
                new EntityFeedCleanup.Artifact(TASK, () -> rows),
                new EntityFeedCleanup.Artifact(ANNOUNCEMENT, () -> rows)));

    if (batch) {
      cleanup.removeMany(List.of(tableId));
    } else {
      cleanup.remove(tableId);
    }

    assertEquals(Set.of(unrelatedId), persistedArtifacts);
  }

  private void failTaskLookup(String type) {
    if (TASK.equals(type)) {
      throw new IllegalStateException("Task storage unavailable");
    }
  }
}
