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
import { render, screen } from '@testing-library/react';
import {
  ChangeOutcome,
  ChangeRequest,
  ChangeRequestStatus,
  MutationOp,
  MutationOpType,
} from '../../../generated/governance/changeRequest/changeRequest';
import { getChangeRequest } from '../../../rest/changeRequestsAPI';
import ChangeRequestChangesById from './ChangeRequestChangesById.component';

jest.mock('../../../rest/changeRequestsAPI', () => ({
  getChangeRequest: jest.fn(),
}));

jest.mock('./ChangeRequestChanges.component', () => ({
  __esModule: true,
  default: ({ ops }: { ops: MutationOp[] }) => (
    <div data-testid="changes">{ops.map((op) => op.field).join(',')}</div>
  ),
}));

const DESCRIPTION = {
  op: MutationOpType.Set,
  field: 'description',
  value: '"new"',
  outcome: ChangeOutcome.Pending,
};
const TAG = {
  op: MutationOpType.Add,
  field: 'tags',
  key: 'PII.Sensitive',
  value: '{"tagFQN":"PII.Sensitive"}',
  outcome: ChangeOutcome.Applied,
};

const renderRequest = async (status: ChangeRequestStatus) => {
  (getChangeRequest as jest.Mock).mockResolvedValue({
    id: 'cr',
    status,
    activeRevision: { ops: [DESCRIPTION, TAG] },
  } as unknown as ChangeRequest);
  render(<ChangeRequestChangesById changeRequestId="cr" />);

  return screen.findAllByTestId('changes');
};

describe('ChangeRequestChangesById', () => {
  it('shows only the changes still under review while the request is open', async () => {
    const lists = await renderRequest(ChangeRequestStatus.Pending);

    expect(lists.map((list) => list.textContent)).toEqual(['description']);
    expect(
      screen.queryByTestId(`decided-changes-${ChangeOutcome.Applied}`)
    ).not.toBeInTheDocument();
  });

  it('shows how each change ended once the request is closed', async () => {
    const lists = await renderRequest(ChangeRequestStatus.Applied);

    expect(lists.map((list) => list.textContent)).toEqual([
      'description',
      'tags',
    ]);
    expect(
      screen.getByTestId(`decided-changes-${ChangeOutcome.Applied}`)
    ).toBeInTheDocument();
  });
});
