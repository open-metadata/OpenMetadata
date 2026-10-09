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
