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

import { EmptyAssigneeStrategy } from '../../../../generated/governance/workflows/elements/nodes/userTask/userApprovalTask';

export const EMPTY_ASSIGNEE_STRATEGY_OPTIONS: Record<
  EmptyAssigneeStrategy,
  { labelKey: string; hintKey: string }
> = {
  [EmptyAssigneeStrategy.None]: {
    labelKey: 'label.approve-automatically',
    hintKey: 'message.empty-assignee-strategy-none-hint',
  },
  [EmptyAssigneeStrategy.AssignAdmins]: {
    labelKey: 'label.assign-to-admins',
    hintKey: 'message.empty-assignee-strategy-assign-admins-hint',
  },
  [EmptyAssigneeStrategy.Wait]: {
    labelKey: 'label.keep-open-unassigned',
    hintKey: 'message.empty-assignee-strategy-wait-hint',
  },
};

// A task workflow (noOp trigger) never approves on its own: with none, its task stays open and the
// owner fallback assigns the asset's owners.
export const NONE_IN_TASK_WORKFLOW_OPTION = {
  labelKey: 'label.go-to-asset-owners',
  hintKey: 'message.empty-assignee-strategy-none-task-workflow-hint',
};

// The builder offers these, the default first. `wait` is not offered: a task nobody is asked to act
// on helps no one. A step that already stores it still shows it, so its value never goes blank.
export const SELECTABLE_EMPTY_ASSIGNEE_STRATEGIES: EmptyAssigneeStrategy[] = [
  EmptyAssigneeStrategy.None,
  EmptyAssigneeStrategy.AssignAdmins,
];
