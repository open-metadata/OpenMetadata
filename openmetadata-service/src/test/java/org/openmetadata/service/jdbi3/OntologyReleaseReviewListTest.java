/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mockStatic;
import static org.openmetadata.service.jdbi3.OntologyTestDatabase.migrate;
import static org.openmetadata.service.jdbi3.OntologyTestDatabase.withDatabase;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskReviewVote;
import org.openmetadata.schema.type.TaskReviewVoteDecision;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.ontology.OntologyReleaseReviewReader.View;
import org.openmetadata.service.ontology.OntologyReview;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Lists release reviews the way {@code GET /v1/ontologies/reviews} does, over approval tasks stored
 * the way {@link TaskRepository#storeEntity} stores them: {@code about} and the people on the task
 * live in relationship rows, not in the task JSON.
 */
class OntologyReleaseReviewListTest {
  private static final int DEFAULT_PAGE_SIZE = 25;

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void eachViewListsTheCallersOpenReviewsNewestFirst(ConnectionType dialect) {
    withReviews(
        dialect,
        reviews -> {
          User requester = reviews.user("requester");
          User alice = reviews.user("alice");
          User bob = reviews.user("bob");
          reviews.inReview(
              "voted", requester, List.of(alice, bob), List.of(bob), List.of(approval(alice)));
          reviews.inReview(
              "unvoted", requester, List.of(alice, bob), List.of(alice, bob), List.of());

          assertAll(
              () -> assertEquals(List.of("unvoted", "voted"), reviews.list(View.ASSIGNED, alice)),
              () -> assertEquals(List.of("unvoted"), reviews.list(View.PENDING, alice)),
              () ->
                  assertEquals(List.of("unvoted", "voted"), reviews.list(View.CREATED, requester)));
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void theCallersGlossaryApprovalsAreNeverReadToListTheirReleaseReview(ConnectionType dialect) {
    withReviews(
        dialect,
        reviews -> {
          User requester = reviews.user("requester");
          User steward = reviews.user("steward");
          UUID customer = reviews.glossaryApproval("customer", requester, steward);
          UUID account = reviews.glossaryApproval("account", requester, steward);
          UUID review =
              reviews.inReview("release", requester, List.of(steward), List.of(steward), List.of());
          Set<UUID> tasks = Set.of(customer, account, review);

          Listing pending = reviews.listing(View.PENDING, steward);
          Listing created = reviews.listing(View.CREATED, requester);

          assertAll(
              () -> assertEquals(List.of("release"), pending.releases()),
              () -> assertEquals(Set.of(review), pending.tasksRead(tasks)),
              () -> assertEquals(List.of("release"), created.releases()),
              () -> assertEquals(Set.of(review), created.tasksRead(tasks)));
        });
  }

  private static TaskReviewVote approval(User voter) {
    return new TaskReviewVote()
        .withVoter(voter.getEntityReference())
        .withAssignee(voter.getEntityReference())
        .withDecision(TaskReviewVoteDecision.Approved)
        .withStage("approval")
        .withTimestamp(1L);
  }

  private static void withReviews(ConnectionType dialect, Consumer<Reviews> test) {
    withDatabase(
        dialect,
        handle -> {
          migrate(handle, dialect);
          CollectionDAO previous = Entity.getCollectionDAO();
          EntityRelationshipRepository previousRelationships =
              Entity.getEntityRelationshipRepository();
          Entity.setCollectionDAO(handle.getJdbi().onDemand(CollectionDAO.class));
          Entity.setEntityRelationshipRepository(
              new EntityRelationshipRepository(Entity.getCollectionDAO()));
          try (MockedStatic<SubjectContext> subjects = mockStatic(SubjectContext.class)) {
            new UserRepository();
            new GlossaryTermRepository();
            new OntologyRepository();
            test.accept(
                new Reviews(
                    handle.getJdbi(),
                    subjects,
                    new OntologyReleaseRepository(),
                    new TaskRepository()));
          } finally {
            Entity.setCollectionDAO(previous);
            Entity.setEntityRelationshipRepository(previousRelationships);
          }
        });
  }

  private record Listing(List<String> releases, List<String> statements) {
    /** A task counts as read when any statement of the listing names or binds its id. */
    Set<UUID> tasksRead(Set<UUID> tasks) {
      return tasks.stream()
          .filter(
              task ->
                  statements.stream().anyMatch(statement -> statement.contains(task.toString())))
          .collect(Collectors.toSet());
    }
  }

  private static final class Reviews {
    private final String run = UUID.randomUUID().toString().substring(0, 8);
    private final Map<UUID, String> labels = new HashMap<>();
    private final Jdbi jdbi;
    private final MockedStatic<SubjectContext> subjects;
    private final OntologyReleaseRepository releases;
    private final TaskRepository tasks;
    private final Ontology ontology;
    private long revision;

    private Reviews(
        Jdbi jdbi,
        MockedStatic<SubjectContext> subjects,
        OntologyReleaseRepository releases,
        TaskRepository tasks) {
      this.jdbi = jdbi;
      this.subjects = subjects;
      this.releases = releases;
      this.tasks = tasks;
      ontology =
          new Ontology()
              .withId(UUID.randomUUID())
              .withName("Reviews" + run)
              .withFullyQualifiedName("Reviews" + run)
              .withIri(URI.create("https://example.org/reviews/" + run))
              .withNamespace(URI.create("https://example.org/reviews/" + run + "/"))
              .withVersion(0.1)
              .withUpdatedAt(1L)
              .withUpdatedBy("admin");
      Entity.getCollectionDAO().ontologyEntityDAO().insert(ontology, ontology.getName());
    }

    User user(String label) {
      String name = label + run;
      User user =
          new User()
              .withId(UUID.randomUUID())
              .withName(name)
              .withFullyQualifiedName(name)
              .withEmail(name + "@example.org")
              .withIsBot(false)
              .withTeams(List.of())
              .withVersion(0.1)
              .withUpdatedAt(1L)
              .withUpdatedBy("admin");
      Entity.getCollectionDAO().userDAO().insert(user, name);
      subjects
          .when(() -> SubjectContext.getSubjectContext(name))
          .thenReturn(new SubjectContext(user, null));
      return user;
    }

    UUID inReview(
        String label,
        User requester,
        List<User> reviewers,
        List<User> assignees,
        List<TaskReviewVote> votes) {
      UUID taskId = UUID.randomUUID();
      revision++;
      OntologyRelease release =
          new OntologyRelease()
              .withId(UUID.randomUUID())
              .withName(label + run)
              .withFullyQualifiedName(label + run)
              .withOntology(ontology.getEntityReference())
              .withReleaseRevision(revision)
              .withSourceWorkingRevision(0L)
              .withVersion(0.1)
              .withUpdatedAt(revision)
              .withUpdatedBy("admin")
              .withEntityStatus(EntityStatus.IN_REVIEW)
              .withReviewAuthor(requester.getName())
              .withReviewTask(taskId);
      Entity.getCollectionDAO().ontologyReleaseDAO().insert(release, release.getName());
      labels.put(release.getId(), label);
      store(
          openApproval(taskId, requester)
              .withOntologyReview(OntologyReview.target(release))
              .withReviewVotes(votes),
          release.getEntityReference(),
          requester,
          reviewers,
          assignees);
      return taskId;
    }

    UUID glossaryApproval(String label, User requester, User steward) {
      String name = label + run;
      GlossaryTerm term =
          new GlossaryTerm()
              .withId(UUID.randomUUID())
              .withName(name)
              .withFullyQualifiedName("Business" + run + "." + name)
              .withDescription(name)
              .withVersion(0.1)
              .withUpdatedAt(1L)
              .withUpdatedBy("admin");
      Entity.getCollectionDAO().glossaryTermDAO().insert(term, term.getFullyQualifiedName());
      UUID taskId = UUID.randomUUID();
      store(
          openApproval(taskId, requester),
          term.getEntityReference(),
          requester,
          List.of(steward),
          List.of(steward));
      return taskId;
    }

    List<String> list(View view, User caller) {
      return releases
          .listReviews(view, caller.getName(), DEFAULT_PAGE_SIZE, null, release -> true)
          .getData()
          .stream()
          .map(review -> labels.get(review.getRelease().getId()))
          .toList();
    }

    Listing listing(View view, User caller) {
      SqlStatements statements = jdbi.getConfig(SqlStatements.class);
      SqlLogger previous = statements.getSqlLogger();
      List<String> executed = new ArrayList<>();
      statements.setSqlLogger(
          new SqlLogger() {
            @Override
            public void logBeforeExecution(StatementContext context) {
              executed.add(context.getRenderedSql() + " " + context.getBinding());
            }
          });
      try {
        return new Listing(list(view, caller), executed);
      } finally {
        statements.setSqlLogger(previous);
      }
    }

    private static Task openApproval(UUID taskId, User requester) {
      return new Task()
          .withId(taskId)
          .withName("Approval " + taskId)
          .withTaskId("TASK-" + taskId.toString().substring(0, 13))
          .withCategory(TaskCategory.Approval)
          .withType(TaskEntityType.RequestApproval)
          .withStatus(TaskEntityStatus.Open)
          .withCreatedById(requester.getId().toString())
          .withVersion(0.1)
          .withCreatedAt(1L)
          .withUpdatedAt(1L)
          .withUpdatedBy(requester.getName());
    }

    private void store(
        Task task,
        EntityReference about,
        User requester,
        List<User> reviewers,
        List<User> assignees) {
      tasks.setFullyQualifiedName(task);
      Entity.getCollectionDAO()
          .taskDAO()
          .insertTask(
              task.getId().toString(), JsonUtils.pojoToJson(task), task.getFullyQualifiedName());
      relate(about, task, Relationship.MENTIONED_IN);
      relate(requester.getEntityReference(), task, Relationship.CREATED);
      reviewers.forEach(
          reviewer -> relate(reviewer.getEntityReference(), task, Relationship.REVIEWS));
      assignees.forEach(
          assignee -> relate(assignee.getEntityReference(), task, Relationship.ASSIGNED_TO));
    }

    private void relate(EntityReference from, Task task, Relationship relation) {
      tasks.addRelationship(from.getId(), task.getId(), from.getType(), Entity.TASK, relation);
    }
  }
}
