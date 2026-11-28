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
import { Task } from '../../../../generated/entity/tasks/task';
import {
  computeTaskEditAccessFlags,
  computeTaskOwnershipFlags,
  computeWorkflowTaskAccess,
  isMostlyRewritten,
} from './TaskTab.utils';

const task = {
  createdBy: { id: 'u-req', name: 'requester', type: 'user' },
  assignees: [
    { id: 'u-rev', name: 'reviewer', type: 'user' },
    { id: 't-gov', name: 'governance', type: 'team' },
  ],
} as unknown as Task;
const owners = [{ id: 'u-own', name: 'owner', type: 'user' }];

const canDecide = (
  user: { id: string; name: string; teams?: { id: string; type: string }[] },
  { isAdminUser = false, hasGlossaryReviewer = false } = {}
) =>
  computeTaskEditAccessFlags({
    ...computeTaskOwnershipFlags(owners, task, user),
    isAdminUser,
    hasGlossaryReviewer,
    isTaskClosed: false,
    ownersCount: owners.length,
  }).hasEditAccess;

describe('TaskTab.utils', () => {
  it('lets admins and assignees decide', () => {
    expect(canDecide({ id: 'u-x', name: 'x' }, { isAdminUser: true })).toBe(
      true
    );
    expect(canDecide({ id: 'u-rev', name: 'reviewer' })).toBe(true);
  });

  it('lets members of an assigned team decide, unless they filed the task', () => {
    const teams = [{ id: 't-gov', type: 'team' }];

    expect(canDecide({ id: 'u-m', name: 'member', teams })).toBe(true);
    expect(canDecide({ id: 'u-req', name: 'requester', teams })).toBe(false);
  });

  it('lets owners decide only when the glossary has no reviewers', () => {
    expect(canDecide({ id: 'u-own', name: 'owner' })).toBe(true);
    expect(
      canDecide({ id: 'u-own', name: 'owner' }, { hasGlossaryReviewer: true })
    ).toBe(false);
  });

  it('does not let anyone else decide', () => {
    expect(canDecide({ id: 'u-x', name: 'x' })).toBe(false);
  });
});

describe('computeWorkflowTaskAccess', () => {
  const access = (
    overrides: Partial<Parameters<typeof computeWorkflowTaskAccess>[0]>
  ) =>
    computeWorkflowTaskAccess({
      isRequestApproval: true,
      hasChangeRequest: false,
      isAssignee: false,
      isPartOfAssigneeTeam: false,
      hasEditAccess: true,
      isCreator: false,
      ...overrides,
    });

  it('shows a workflow approval only to its assignees, not to an admin or owner', () => {
    expect(access({})).toEqual({
      hasWorkflowAccess: false,
      showsWorkflowActions: false,
    });
    expect(access({ isAssignee: true }).showsWorkflowActions).toBe(true);
    expect(access({ isPartOfAssigneeTeam: true }).hasWorkflowAccess).toBe(true);
    expect(
      access({ isRequestApproval: false, hasChangeRequest: true })
        .showsWorkflowActions
    ).toBe(false);
  });

  it('keeps edit access for other workflow tasks', () => {
    expect(access({ isRequestApproval: false })).toEqual({
      hasWorkflowAccess: true,
      showsWorkflowActions: true,
    });
  });
});

describe('isMostlyRewritten', () => {
  it('keeps an appended sentence as an edit', () => {
    expect(
      isMostlyRewritten(
        'The agreement is the top of the hierarchy.',
        'The agreement is the top of the hierarchy. Test change'
      )
    ).toBe(false);
  });

  it('treats a replaced description as a rewrite', () => {
    expect(
      isMostlyRewritten(
        'The interest rate a lender charges on a loan, expressed as an annual percentage.',
        "The annual cost of borrowing on a loan's outstanding principal, quoted as a fixed or floating percentage."
      )
    ).toBe(true);
  });

  it('does not treat two empty values as a rewrite', () => {
    expect(isMostlyRewritten('', '')).toBe(false);
  });
});
