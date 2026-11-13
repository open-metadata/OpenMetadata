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
import { getEntityVersionHistory } from '../../../rest/entityVersionAPI';
import { getWorkflowInstancesForApplication } from '../../../rest/workflowAPI';
import { getWorkflowDefinitionById } from '../../../rest/workflowDefinitionsAPI';
import {
  getStatusChange,
  getStatusChangeLines,
} from './EntityStatusDecision.utils';

jest.mock('../../../rest/entityVersionAPI', () => ({
  getEntityVersionHistory: jest.fn(),
}));

jest.mock('../../../rest/workflowAPI', () => ({
  getWorkflowInstancesForApplication: jest.fn(),
  getWorkflowInstanceStateById: jest.fn(),
}));

jest.mock('../../../rest/workflowDefinitionsAPI', () => ({
  getWorkflowDefinitionById: jest.fn(),
}));

const DEFINITIONS: Record<string, object> = {
  lifecycle: {
    id: 'lifecycle',
    name: 'DataProductLifecycle',
    displayName: 'Data product lifecycle',
    config: { lifecycle: { version: 1 } },
  },
  gate: {
    id: 'gate',
    name: 'DataProductChangeReview',
    displayName: 'Data product change review',
    nodes: [{ subType: 'userApprovalTask' }],
  },
};

const LINK = '<#E::dataProduct::Invoices>';

// The versions endpoint returns each version as a JSON string, newest first.
const version = (
  entityStatus: string,
  updatedBy: string,
  updatedAt: number,
  changesStatus = true
) =>
  JSON.stringify({
    entityStatus,
    updatedBy,
    updatedAt,
    changeDescription: changesStatus
      ? { fieldsUpdated: [{ name: 'entityStatus' }] }
      : { fieldsUpdated: [{ name: 'description' }] },
  });

const run = (
  workflowDefinitionId: string,
  startedAt: number,
  endedAt: number | undefined,
  variables: object = {}
) => ({
  id: `${workflowDefinitionId}-${startedAt}`,
  workflowDefinitionId,
  startedAt,
  endedAt,
  variables,
});

const givenVersions = (...versions: string[]) =>
  (getEntityVersionHistory as jest.Mock).mockResolvedValue({ versions });

const givenRuns = (...runs: object[]) =>
  (getWorkflowInstancesForApplication as jest.Mock).mockResolvedValue({
    data: runs,
    paging: {},
  });

describe('getStatusChange', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getWorkflowDefinitionById as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve(DEFINITIONS[id])
    );
  });

  it('names the approval the workflow that changed the status recorded', async () => {
    givenVersions(
      version('Approved', 'ana', 1_000_000, false),
      version('Approved', 'ana', 500_000),
      version('In Review', 'admin', 100_000)
    );
    givenRuns(
      run('lifecycle', 99_000, 501_000, {
        global_updatedBy: 'admin',
        approvals: [
          {
            id: 'a',
            node: 'Approve',
            decision: 'Approved',
            decidedBy: ['ana'],
            decidedAt: 499_000,
          },
        ],
      })
    );

    expect(await getStatusChange('dataProduct', 'id', LINK)).toEqual({
      status: 'Approved',
      changedBy: 'ana',
      changedAt: 500_000,
      workflowName: 'Data product lifecycle',
      triggeredBy: 'admin',
      scheduled: false,
      outcome: expect.objectContaining({ decidedBy: ['ana'] }),
    });
    expect(getWorkflowInstancesForApplication).toHaveBeenCalledTimes(1);
  });

  it('takes the decision recorded closest to the change, even when it was recorded just after', async () => {
    givenVersions(version('Approved', 'ana', 500_000));
    givenRuns(
      run('lifecycle', 10_000, 520_000, {
        approvals: [
          {
            id: 'old',
            node: 'Approve',
            decision: 'Rejected',
            decidedBy: ['ben'],
            decidedAt: 100_000,
          },
          {
            id: 'late',
            node: 'Approve',
            decision: 'Approved',
            decidedBy: ['ana'],
            decidedAt: 512_000,
          },
        ],
      })
    );

    const change = await getStatusChange('dataProduct', 'id', LINK);

    expect(change.outcome?.id).toBe('late');
  });

  it('names the run that decided the status, not the run its own status write started', async () => {
    givenVersions(version('Approved', 'ana', 500_000));
    givenRuns(
      run('lifecycle', 500_100, 500_300),
      run('lifecycle', 100_000, 500_050, {
        global_updatedBy: 'admin',
        approvals: [
          {
            id: 'decided',
            node: 'Approve',
            decision: 'Approved',
            decidedBy: ['ana'],
            decidedAt: 500_057,
          },
        ],
      })
    );

    const change = await getStatusChange('dataProduct', 'id', LINK);

    expect(change.outcome?.id).toBe('decided');
    expect(change.triggeredBy).toBe('admin');
  });

  it('names the workflow and whose change started it when it set the status without an approval', async () => {
    givenVersions(version('In Review', 'admin', 100_000));
    givenRuns(
      run('gate', 99_500, 100_500),
      run('lifecycle', 99_000, 101_000, { global_updatedBy: 'admin' })
    );

    const change = await getStatusChange('dataProduct', 'id', LINK);

    expect(change.workflowName).toBe('Data product lifecycle');
    expect(change.triggeredBy).toBe('admin');
    expect(change.outcome).toBeUndefined();
  });

  it('leaves the workflow out when no status-setting run was running at the change', async () => {
    givenVersions(version('Deprecated', 'ana', 900_000));
    givenRuns(run('lifecycle', 10_000, 20_000));

    expect(await getStatusChange('dataProduct', 'id', LINK)).toEqual({
      status: 'Deprecated',
      changedBy: 'ana',
      changedAt: 900_000,
    });
    expect(getWorkflowDefinitionById).not.toHaveBeenCalled();
  });

  it('falls back to the version that created the entity when no version changed the status', async () => {
    givenVersions(version('Draft', 'ana', 5_000, false));
    givenRuns();

    const change = await getStatusChange('dataProduct', 'id', LINK);

    expect(change).toEqual({
      status: 'Draft',
      changedBy: 'ana',
      changedAt: 5_000,
    });
  });
});

describe('getStatusChangeLines', () => {
  const outcome = (overrides: object) => ({
    id: 'outcome',
    node: 'Approve',
    decision: 'Approved',
    decidedBy: ['ana'],
    decidedAt: 1,
    ...overrides,
  });

  it('names the people who decided, then the workflow', () => {
    expect(
      getStatusChangeLines({
        workflowName: 'Lifecycle',
        outcome: outcome({ decision: 'Rejected' }) as never,
      })
    ).toEqual([
      { key: 'message.workflow-run-rejected-by', values: { user: 'ana' } },
      { text: 'Lifecycle' },
    ]);
  });

  it('says the workflow approved it itself, and why', () => {
    expect(
      getStatusChangeLines({
        workflowName: 'Lifecycle',
        outcome: outcome({
          automaticReason: 'NoAssignees',
          decidedBy: [],
        }) as never,
      })
    ).toEqual([
      {
        key: 'message.entity-status-auto-approved-by',
        values: { workflow: 'Lifecycle' },
      },
      { key: 'message.entity-status-no-one-to-review' },
    ]);
  });

  it('says a workflow set it without an approval, after whose change or on its schedule', () => {
    expect(
      getStatusChangeLines({
        status: 'In Review',
        workflowName: 'Lifecycle',
        triggeredBy: 'admin',
      })
    ).toEqual([
      {
        key: 'message.entity-status-set-by',
        values: { status: 'In Review', by: 'Lifecycle' },
      },
      {
        key: 'message.entity-status-after-change-by',
        values: { user: 'admin' },
      },
    ]);
    expect(
      getStatusChangeLines({
        status: 'Approved',
        workflowName: 'Nightly certification',
        scheduled: true,
      })[1]
    ).toEqual({ key: 'message.entity-status-on-schedule' });
  });

  it('says a workflow set it when only the governance bot is known', () => {
    expect(
      getStatusChangeLines({ status: 'Approved', changedBy: 'governance-bot' })
    ).toEqual([
      {
        key: 'message.entity-status-set-by-a-workflow',
        values: { status: 'Approved' },
      },
    ]);
  });

  it('names the person who set it by hand, and says when nothing is recorded', () => {
    expect(
      getStatusChangeLines({ status: 'Deprecated', changedBy: 'ana' })
    ).toEqual([
      {
        key: 'message.entity-status-set-by',
        values: { status: 'Deprecated', by: 'ana' },
      },
    ]);
    expect(getStatusChangeLines(undefined)).toEqual([
      { key: 'message.entity-status-no-recorded-change' },
    ]);
  });
});
