package org.openmetadata.service.tasks;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.type.TaskReviewVote;
import org.openmetadata.schema.type.TaskReviewVoteDecision;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/** Counted votes on a multi-reviewer task: one per voter, each covering one assignee entry. */
public final class TaskReviewVotes {
  private TaskReviewVotes() {}

  public static String variable(final UUID taskId) {
    return "taskReviewVotes_" + taskId;
  }

  public static List<TaskReviewVote> read(final Object value) {
    return value == null ? List.of() : JsonUtils.readObjects((String) value, TaskReviewVote.class);
  }

  public static List<TaskReviewVote> merge(
      final List<TaskReviewVote> votes, final List<TaskReviewVote> incoming) {
    List<TaskReviewVote> merged = listOrEmpty(votes);
    for (final TaskReviewVote vote : listOrEmpty(incoming)) {
      merged = record(merged, vote);
    }
    return merged;
  }

  public static boolean hasVoted(final List<TaskReviewVote> votes, final String voter) {
    return listOrEmpty(votes).stream()
        .anyMatch(vote -> vote.getVoter() != null && voter.equals(vote.getVoter().getName()));
  }

  /** The votes with {@code vote} appended, unless its voter already appears. */
  public static List<TaskReviewVote> record(
      final List<TaskReviewVote> votes, final TaskReviewVote vote) {
    if (hasVoted(votes, vote.getVoter().getName())) {
      return listOrEmpty(votes);
    }
    final List<TaskReviewVote> recorded = new ArrayList<>(listOrEmpty(votes));
    recorded.add(vote);
    return List.copyOf(recorded);
  }

  /**
   * The entry a voter votes through: the voter's own user entry when listed, else the first team
   * entry the voter belongs to, else null.
   */
  public static EntityReference entryFor(
      final List<EntityReference> entries,
      final EntityReference voter,
      final List<EntityReference> voterTeams) {
    for (final EntityReference entry : listOrEmpty(entries)) {
      if (Entity.USER.equals(entry.getType()) && sameEntity(entry, voter)) {
        return entry;
      }
    }
    for (final EntityReference entry : listOrEmpty(entries)) {
      if (Entity.TEAM.equals(entry.getType())
          && listOrEmpty(voterTeams).stream().anyMatch(team -> sameEntity(entry, team))) {
        return entry;
      }
    }
    return null;
  }

  public static TaskReviewVote vote(
      final Task task,
      final EntityReference voter,
      final TaskReviewVoteDecision decision,
      final String comment,
      final long timestamp) {
    final EntityReference entry =
        entryFor(
            entries(task), voter, SubjectContext.getSubjectContext(voter.getName()).getTeams());
    return new TaskReviewVote()
        .withVoter(voter)
        .withAssignee(entry == null ? voter : entry)
        .withDecision(decision)
        .withComment(comment)
        .withTimestamp(timestamp);
  }

  /** The stable entry list: the task's reviewers, which no vote prunes, else its assignees. */
  public static List<EntityReference> entries(final Task task) {
    return nullOrEmpty(task.getReviewers())
        ? listOrEmpty(task.getAssignees())
        : task.getReviewers();
  }

  public static TaskReviewVoteDecision decision(final TaskResolutionType resolution) {
    return resolution == TaskResolutionType.Rejected
            || resolution == TaskResolutionType.AutoRejected
        ? TaskReviewVoteDecision.Rejected
        : TaskReviewVoteDecision.Approved;
  }

  public static TaskReviewVoteDecision decisionForResult(final Object result) {
    if (result instanceof Boolean approved) {
      return approved ? TaskReviewVoteDecision.Approved : TaskReviewVoteDecision.Rejected;
    }
    if (result instanceof String value) {
      return switch (value.trim().toLowerCase(Locale.ROOT)) {
        case "true", "approve", "approved" -> TaskReviewVoteDecision.Approved;
        case "false", "reject", "rejected" -> TaskReviewVoteDecision.Rejected;
        default -> null;
      };
    }
    return null;
  }

  public static boolean isDecision(final TaskResolutionType resolution) {
    return resolution == TaskResolutionType.Approved
        || resolution == TaskResolutionType.AutoApproved
        || resolution == TaskResolutionType.Rejected
        || resolution == TaskResolutionType.AutoRejected;
  }

  public static boolean sameEntity(final EntityReference first, final EntityReference second) {
    if (first == null
        || second == null
        || (first.getType() != null
            && second.getType() != null
            && !first.getType().equals(second.getType()))) {
      return false;
    }
    return (first.getId() != null && Objects.equals(first.getId(), second.getId()))
        || (first.getName() != null && Objects.equals(first.getName(), second.getName()));
  }
}
