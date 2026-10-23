package org.openmetadata.service.tasks;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.type.TaskReviewVote;
import org.openmetadata.schema.type.TaskReviewVoteDecision;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/** Counted votes on a multi-reviewer task: one per voter, each covering one assignee entry. */
public final class TaskReviewVotes {
  private TaskReviewVotes() {}

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
