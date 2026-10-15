/*
 *  Copyright 2026 Collate.
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
import { isEqual } from 'lodash';
import { Task } from '../../../../generated/entity/tasks/task';
import { EntityReference } from '../../../../generated/entity/type';

interface TaskOwnershipFlags {
  isOwner: boolean;
  isCreator: boolean;
  isAssignee: boolean;
  isPartOfAssigneeTeam: boolean;
}

export const computeTaskOwnershipFlags = (
  owners: EntityReference[],
  task: Task,
  currentUser?: { id?: string; name?: string; teams?: EntityReference[] }
): TaskOwnershipFlags => {
  const isUserPartOfTeam = (teamId: string): boolean =>
    Boolean(currentUser?.teams?.find((team) => teamId === team.id));

  const isOwner = Boolean(
    owners?.some((owner) => isEqual(owner.id, currentUser?.id))
  );
  const isCreator = isEqual(task.createdBy?.name, currentUser?.name);
  const isAssignee = Boolean(
    task.assignees?.some((assignee) => isEqual(assignee.id, currentUser?.id))
  );
  const isPartOfAssigneeTeam = Boolean(
    task.assignees?.some((assignee) =>
      assignee.type === 'team' ? isUserPartOfTeam(assignee.id) : false
    )
  );

  return { isOwner, isCreator, isAssignee, isPartOfAssigneeTeam };
};

interface TaskEditAccessParams {
  isAdminUser: boolean;
  isAssignee: boolean;
  isOwner: boolean;
  isCreator: boolean;
  isPartOfAssigneeTeam: boolean;
  hasGlossaryReviewer?: boolean;
  isTaskClosed: boolean;
  ownersCount: number;
}

interface TaskEditAccessFlags {
  hasEditAccess: boolean;
  shouldEditAssignee: boolean;
}

// Extracted so the numerous boolean short-circuits live in their own
// complexity scope instead of TaskTabNew's render body.
export const computeTaskEditAccessFlags = ({
  isAdminUser,
  isAssignee,
  isOwner,
  isCreator,
  isPartOfAssigneeTeam,
  hasGlossaryReviewer,
  isTaskClosed,
  ownersCount,
}: TaskEditAccessParams): TaskEditAccessFlags => {
  const isOwnerWithoutReviewer = !hasGlossaryReviewer && isOwner;
  const isAssigneeTeamMemberNonCreator = isPartOfAssigneeTeam && !isCreator;
  const hasEditAccess =
    isAdminUser ||
    isAssignee ||
    isOwnerWithoutReviewer ||
    isAssigneeTeamMemberNonCreator;
  const shouldEditAssignee =
    (isCreator || hasEditAccess) && !isTaskClosed && ownersCount === 0;

  return { hasEditAccess, shouldEditAssignee };
};
