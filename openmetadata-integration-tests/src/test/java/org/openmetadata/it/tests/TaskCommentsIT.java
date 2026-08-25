/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskComment;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskPriority;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;

/**
 * Integration tests for Task Comments functionality.
 *
 * <p>Tests cover:
 * - Adding comments to tasks
 * - Editing comments (author permission)
 * - Deleting comments (author and admin permissions)
 * - Permission denied scenarios
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Execution(ExecutionMode.SAME_THREAD)
public class TaskCommentsIT {

  private static OpenMetadataClient adminClient;
  private static OpenMetadataClient user1Client;
  private static OpenMetadataClient user2Client;
  private static SharedEntities shared;

  @BeforeAll
  static void setup() {
    adminClient = SdkClients.adminClient();
    user1Client = SdkClients.user1Client();
    user2Client = SdkClients.user2Client();
    shared = SharedEntities.get();
  }

  private Task createTestTask(OpenMetadataClient client) {
    CreateTask createTask =
        new CreateTask()
            .withName("test-task-" + UUID.randomUUID())
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate)
            .withPriority(TaskPriority.Medium)
            .withAssignees(List.of(shared.USER1.getName()));

    return client.tasks().create(createTask);
  }

  @Test
  @Order(1)
  void test_addComment_success() {
    Task task = createTestTask(adminClient);

    try {
      Task updatedTask =
          adminClient.tasks().addComment(task.getId().toString(), "This is a test comment");

      assertNotNull(updatedTask.getComments());
      assertEquals(1, updatedTask.getComments().size());
      assertEquals("This is a test comment", updatedTask.getComments().get(0).getMessage());
      assertEquals(Integer.valueOf(1), updatedTask.getCommentCount());
    } finally {
      adminClient.tasks().delete(task.getId().toString(), java.util.Map.of("hardDelete", "true"));
    }
  }

  @Test
  @Order(2)
  void test_addMultipleComments_success() {
    Task task = createTestTask(adminClient);

    try {
      user1Client.tasks().addComment(task.getId().toString(), "First comment from user1");
      user2Client.tasks().addComment(task.getId().toString(), "Second comment from user2");
      Task updatedTask =
          adminClient.tasks().addComment(task.getId().toString(), "Third comment from admin");

      assertNotNull(updatedTask.getComments());
      assertEquals(3, updatedTask.getComments().size());
      assertEquals(Integer.valueOf(3), updatedTask.getCommentCount());

      assertEquals("First comment from user1", updatedTask.getComments().get(0).getMessage());
      assertEquals("Second comment from user2", updatedTask.getComments().get(1).getMessage());
      assertEquals("Third comment from admin", updatedTask.getComments().get(2).getMessage());
    } finally {
      adminClient.tasks().delete(task.getId().toString(), java.util.Map.of("hardDelete", "true"));
    }
  }

  @Test
  @Order(3)
  void test_editOwnComment_success() {
    Task task = createTestTask(adminClient);

    try {
      Task taskWithComment =
          user1Client.tasks().addComment(task.getId().toString(), "Original message");
      UUID commentId = taskWithComment.getComments().get(0).getId();

      Task updatedTask =
          user1Client.tasks().editComment(task.getId().toString(), commentId, "Edited message");

      assertEquals(1, updatedTask.getComments().size());
      assertEquals("Edited message", updatedTask.getComments().get(0).getMessage());
    } finally {
      adminClient.tasks().delete(task.getId().toString(), java.util.Map.of("hardDelete", "true"));
    }
  }

  @Test
  @Order(4)
  void test_editOtherUserComment_forbidden() {
    Task task = createTestTask(adminClient);

    try {
      Task taskWithComment =
          user1Client.tasks().addComment(task.getId().toString(), "User1 comment");
      UUID commentId = taskWithComment.getComments().get(0).getId();

      ForbiddenException exception =
          assertThrows(
              ForbiddenException.class,
              () ->
                  user2Client
                      .tasks()
                      .editComment(task.getId().toString(), commentId, "Trying to edit"));

      assertTrue(
          exception.getMessage().contains("not authorized to edit"),
          "Expected authorization error message");
    } finally {
      adminClient.tasks().delete(task.getId().toString(), java.util.Map.of("hardDelete", "true"));
    }
  }

  @Test
  @Order(5)
  void test_deleteOwnComment_success() {
    Task task = createTestTask(adminClient);

    try {
      Task taskWithComment =
          user1Client.tasks().addComment(task.getId().toString(), "Comment to delete");
      assertEquals(1, taskWithComment.getComments().size());

      UUID commentId = taskWithComment.getComments().get(0).getId();
      Task updatedTask = user1Client.tasks().deleteComment(task.getId().toString(), commentId);

      assertTrue(updatedTask.getComments() == null || updatedTask.getComments().isEmpty());
      assertEquals(Integer.valueOf(0), updatedTask.getCommentCount());
    } finally {
      adminClient.tasks().delete(task.getId().toString(), java.util.Map.of("hardDelete", "true"));
    }
  }

  @Test
  @Order(6)
  void test_deleteOtherUserComment_forbidden() {
    Task task = createTestTask(adminClient);

    try {
      Task taskWithComment =
          user1Client.tasks().addComment(task.getId().toString(), "User1 comment");
      UUID commentId = taskWithComment.getComments().get(0).getId();

      ForbiddenException exception =
          assertThrows(
              ForbiddenException.class,
              () -> user2Client.tasks().deleteComment(task.getId().toString(), commentId));

      assertTrue(
          exception.getMessage().contains("not authorized to delete"),
          "Expected authorization error message");
    } finally {
      adminClient.tasks().delete(task.getId().toString(), java.util.Map.of("hardDelete", "true"));
    }
  }

  @Test
  @Order(7)
  void test_adminCanDeleteAnyComment_success() {
    Task task = createTestTask(adminClient);

    try {
      Task taskWithComment =
          user1Client.tasks().addComment(task.getId().toString(), "User1 comment");
      UUID commentId = taskWithComment.getComments().get(0).getId();

      Task updatedTask = adminClient.tasks().deleteComment(task.getId().toString(), commentId);

      assertTrue(updatedTask.getComments() == null || updatedTask.getComments().isEmpty());
      assertEquals(Integer.valueOf(0), updatedTask.getCommentCount());
    } finally {
      adminClient.tasks().delete(task.getId().toString(), java.util.Map.of("hardDelete", "true"));
    }
  }

  @Test
  @Order(8)
  void test_commentWithMarkdown_success() {
    Task task = createTestTask(adminClient);

    try {
      String markdownMessage =
          """
          # Header
          - Bullet point 1
          - Bullet point 2

          **Bold text** and *italic text*

          ```python
          def hello():
              print("Hello, World!")
          ```
          """;

      Task updatedTask = adminClient.tasks().addComment(task.getId().toString(), markdownMessage);

      assertEquals(markdownMessage, updatedTask.getComments().get(0).getMessage());
    } finally {
      adminClient.tasks().delete(task.getId().toString(), java.util.Map.of("hardDelete", "true"));
    }
  }

  @Test
  @Order(9)
  void test_commentWithMention_success() {
    Task task = createTestTask(adminClient);

    try {
      String mentionMessage =
          String.format("Hey @%s, please review this task.", shared.USER2.getName());

      Task updatedTask = user1Client.tasks().addComment(task.getId().toString(), mentionMessage);

      assertEquals(mentionMessage, updatedTask.getComments().get(0).getMessage());
    } finally {
      adminClient.tasks().delete(task.getId().toString(), java.util.Map.of("hardDelete", "true"));
    }
  }

  @Test
  @Order(10)
  void test_getTaskWithComments_success() {
    Task task = createTestTask(adminClient);

    try {
      adminClient.tasks().addComment(task.getId().toString(), "Comment 1");
      user1Client.tasks().addComment(task.getId().toString(), "Comment 2");

      Task fetchedTask = adminClient.tasks().get(task.getId().toString(), "comments");

      assertNotNull(fetchedTask.getComments());
      assertEquals(2, fetchedTask.getComments().size());
      assertEquals(Integer.valueOf(2), fetchedTask.getCommentCount());
    } finally {
      adminClient.tasks().delete(task.getId().toString(), java.util.Map.of("hardDelete", "true"));
    }
  }

  @Test
  @Order(11)
  void test_commentAuthorIsCorrect() {
    Task task = createTestTask(adminClient);

    try {
      Task updatedTask =
          user1Client.tasks().addComment(task.getId().toString(), "Comment by user1");

      TaskComment comment = updatedTask.getComments().get(0);
      assertNotNull(comment.getAuthor());
      assertEquals(shared.USER1.getName(), comment.getAuthor().getName());
    } finally {
      adminClient.tasks().delete(task.getId().toString(), java.util.Map.of("hardDelete", "true"));
    }
  }

  @Test
  @Order(12)
  void test_commentHasTimestamp() {
    Task task = createTestTask(adminClient);

    try {
      long beforeCreate = System.currentTimeMillis();
      Task updatedTask =
          adminClient.tasks().addComment(task.getId().toString(), "Timestamped comment");
      long afterCreate = System.currentTimeMillis();

      TaskComment comment = updatedTask.getComments().get(0);
      assertNotNull(comment.getCreatedAt());
      assertTrue(comment.getCreatedAt() >= beforeCreate);
      assertTrue(comment.getCreatedAt() <= afterCreate);
    } finally {
      adminClient.tasks().delete(task.getId().toString(), java.util.Map.of("hardDelete", "true"));
    }
  }
}
