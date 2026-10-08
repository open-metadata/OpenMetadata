package org.openmetadata.service.migration.utils.v200;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.migration.utils.v200.LegacyThreadTask.TaskStatus;
import org.openmetadata.service.migration.utils.v200.LegacyThreadTask.TaskType;

class LegacyThreadTaskTest {
  @Test
  void readsHistoricalTaskWithoutThePublicThreadType() {
    UUID id = UUID.randomUUID();
    UUID authorId = UUID.randomUUID();
    UUID postId = UUID.randomUUID();
    String json =
        """
        {
          "id":"%s", "type":"Task", "about":"<#E::table::service.db.schema.table>",
          "createdBy":"alice", "updatedBy":"bob", "threadTs":1000, "updatedAt":2000,
          "message":"Update the description", "resolved":true,
          "task":{
            "id":42, "type":"UpdateDescription", "status":"Closed",
            "assignees":[{"id":"%s", "type":"user"}],
            "closedBy":"bob", "closedAt":2000,
            "oldValue":"old", "suggestion":"suggested", "newValue":"accepted"
          },
          "posts":[{"id":"%s", "from":"alice", "message":"Please review", "postTs":1500}]
        }
        """
            .formatted(id, authorId, postId);

    LegacyThreadTask thread = JsonUtils.readValue(json, LegacyThreadTask.class);

    assertEquals(id, thread.id());
    assertEquals("<#E::table::service.db.schema.table>", thread.about());
    assertEquals("alice", thread.createdBy());
    assertEquals("bob", thread.updatedBy());
    assertEquals(1000L, thread.threadTs());
    assertEquals(2000L, thread.updatedAt());
    assertEquals(TaskType.UpdateDescription, thread.task().type());
    assertEquals(TaskStatus.Closed, thread.task().status());
    assertEquals(authorId, thread.task().assignees().getFirst().getId());
    assertEquals("bob", thread.task().closedBy());
    assertEquals(2000L, thread.task().closedAt());
    assertEquals("old", thread.task().oldValue());
    assertEquals("suggested", thread.task().suggestion());
    assertEquals("accepted", thread.task().newValue());
    assertEquals(postId, thread.posts().getFirst().getId());
    assertEquals("Please review", thread.posts().getFirst().getMessage());
  }

  @ParameterizedTest
  @EnumSource(TaskType.class)
  void readsEveryRetiredTaskType(TaskType type) {
    String json = "{\"type\":\"Task\",\"task\":{\"type\":\"%s\"}}".formatted(type);

    LegacyThreadTask thread = JsonUtils.readValue(json, LegacyThreadTask.class);

    assertEquals(type, thread.task().type());
    assertNull(thread.task().status());
  }
}
