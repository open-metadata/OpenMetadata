package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.openmetadata.schema.api.data.OntologyReleaseReview;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyApprovalRule;
import org.openmetadata.schema.type.OntologyReviewAssignee;
import org.openmetadata.schema.type.OntologyReviewAssigneeStatus;
import org.openmetadata.schema.type.OntologyReviewDecision;
import org.openmetadata.schema.type.TaskResolution;
import org.openmetadata.schema.type.TaskReviewVote;
import org.openmetadata.schema.type.TaskReviewVoteDecision;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.governance.workflows.OntologyApprovalWorkflow;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.tasks.TaskReviewVotes;

/**
 * The review of one release as one caller sees it, built from the task's recorded votes. The
 * entry list is the task's reviewers, which no vote prunes, plus the entry of any recorded vote,
 * so a review requested before the field existed still lists every assignee.
 */
public final class OntologyReleaseReviewReader {
  public enum View {
    ASSIGNED,
    CREATED,
    PENDING;

    public static View parse(final String value) {
      for (final View view : values()) {
        if (view.name().equalsIgnoreCase(value)) {
          return view;
        }
      }
      throw new BadRequestException("view must be one of assigned, created or pending");
    }
  }

  private final OntologyRelease release;
  private final Task task;
  private final String caller;
  private final List<EntityReference> entries;
  private final EntityReference callerEntry;

  public OntologyReleaseReviewReader(
      final OntologyRelease release, final Task task, final String caller) {
    this.release = release;
    this.task = task;
    this.caller = caller;
    this.entries = entries(task);
    final SubjectContext subject = SubjectContext.getSubjectContext(caller);
    this.callerEntry =
        TaskReviewVotes.entryFor(entries, subject.user().getEntityReference(), subject.getTeams());
  }

  public boolean matches(final View view) {
    return switch (view) {
      case ASSIGNED -> callerEntry != null;
      case CREATED -> created();
      case PENDING -> callerCanVote();
    };
  }

  public OntologyReleaseReview review() {
    return new OntologyReleaseReview()
        .withRelease(release.getEntityReference())
        .withOntology(release.getOntology())
        .withTask(task.getEntityReference())
        .withTaskId(task.getTaskId())
        .withRequester(task.getCreatedBy())
        .withApprovalRule(OntologyApprovalWorkflow.approvalRule(task))
        .withStatus(release.getEntityStatus())
        .withAssignees(entries.stream().map(this::assignee).toList())
        .withLatestDecision(latestDecision())
        .withCallerCanVote(callerCanVote())
        .withCallerCompletesRule(callerCompletesRule());
  }

  private static List<EntityReference> entries(final Task task) {
    final List<EntityReference> entries = new ArrayList<>(TaskReviewVotes.entries(task));
    for (final TaskReviewVote vote : listOrEmpty(task.getReviewVotes())) {
      if (entries.stream()
          .noneMatch(entry -> TaskReviewVotes.sameEntity(entry, vote.getAssignee()))) {
        entries.add(vote.getAssignee());
      }
    }
    return List.copyOf(entries);
  }

  private OntologyReviewAssignee assignee(final EntityReference entry) {
    final TaskReviewVote vote = voteFor(entry);
    return new OntologyReviewAssignee().withAssignee(entry).withStatus(status(vote)).withVote(vote);
  }

  private TaskReviewVote voteFor(final EntityReference entry) {
    return listOrEmpty(task.getReviewVotes()).stream()
        .filter(vote -> TaskReviewVotes.sameEntity(vote.getAssignee(), entry))
        .findFirst()
        .orElse(null);
  }

  private static OntologyReviewAssigneeStatus status(final TaskReviewVote vote) {
    if (vote == null) {
      return OntologyReviewAssigneeStatus.Pending;
    }
    return vote.getDecision() == TaskReviewVoteDecision.Rejected
        ? OntologyReviewAssigneeStatus.Rejected
        : OntologyReviewAssigneeStatus.Approved;
  }

  private OntologyReviewDecision latestDecision() {
    final TaskResolution resolution = task.getResolution();
    if (resolution == null || resolution.getType() == null) {
      return null;
    }
    final TaskReviewVoteDecision decision =
        switch (resolution.getType()) {
          case Approved, AutoApproved -> TaskReviewVoteDecision.Approved;
          case Rejected, AutoRejected -> TaskReviewVoteDecision.Rejected;
          default -> null;
        };
    return decision == null
        ? null
        : new OntologyReviewDecision()
            .withDecision(decision)
            .withUser(resolution.getResolvedBy())
            .withReason(resolution.getComment())
            .withTimestamp(resolution.getResolvedAt());
  }

  private boolean open() {
    return release.getEntityStatus() == EntityStatus.IN_REVIEW
        && Objects.equals(release.getReviewTask(), task.getId())
        && !TaskRepository.isTerminalStatus(task.getStatus())
        && task.getResolution() == null;
  }

  private boolean created() {
    return task.getCreatedBy() != null && caller.equals(task.getCreatedBy().getName());
  }

  private boolean callerCanVote() {
    return open()
        && callerEntry != null
        && voteFor(callerEntry) == null
        && !caller.equals(release.getReviewAuthor())
        && !created();
  }

  private boolean callerCompletesRule() {
    return callerCanVote()
        && (OntologyApprovalWorkflow.approvalRule(task) == OntologyApprovalRule.AnyReviewer
            || entries.stream()
                .filter(entry -> entry != callerEntry)
                .allMatch(
                    entry -> status(voteFor(entry)) == OntologyReviewAssigneeStatus.Approved));
  }
}
