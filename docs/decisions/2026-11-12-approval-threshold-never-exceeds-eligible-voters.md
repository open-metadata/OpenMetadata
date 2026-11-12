# An approval task's threshold never exceeds the users able to vote on it

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Harshit Shah
- **Guard:** `CreateTaskTest#approvalThresholdNeverExceedsTheUsersAbleToVote`
- **Related:** LHV support ticket 22036

## Context
A User Approval node's threshold is a fixed number from its configuration. The assignees are
resolved separately, and the requester is removed from them to prevent self-approval. When a data
contract required two approvals from its owner and reviewer and the reviewer made the change, one
assignee remained against a threshold of two. After the owner approved, the task stayed open with
no one left to vote, and the contract could never move forward.

## Decision
`CreateTask.resolveApprovalThreshold` lowers the threshold to the number of assignees when every
assignee is a user. A list that holds a team is not capped, because any number of its members can
vote. An empty list is not capped either. The requester's change is not counted as an approval:
that would be self-approval under another name.

## Consequences
A task can always complete. The cost is that a two-approval rule becomes one independent approval
when the requester is one of the two eligible approvers. A workflow that needs two independent
approvals in that case must name enough approvers, for example a team or a third reviewer, or use
the admin fallback. The cap applies when the task is created; tasks already open keep the
threshold they started with.
