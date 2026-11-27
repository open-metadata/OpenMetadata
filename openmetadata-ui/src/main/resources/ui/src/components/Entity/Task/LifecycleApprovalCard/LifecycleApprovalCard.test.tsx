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
import { EntityStatus } from '../../../../generated/governance/workflows/elements/nodes/userTask/userApprovalTask';
import LifecycleApprovalCard from './LifecycleApprovalCard';
import { getLifecycleMove } from './LifecycleApprovalCard.utils';

describe('LifecycleApprovalCard', () => {
  it('names the stage the approval moves the asset to', () => {
    render(
      <LifecycleApprovalCard
        move={{
          stage: EntityStatus.InReview,
          targetStage: EntityStatus.Approved,
        }}
      />
    );

    expect(
      screen.getByText('label.lifecycle-approval-needed')
    ).toBeInTheDocument();
    expect(screen.getByText('In Review')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('reads the move only from a lifecycle approval payload', () => {
    expect(
      getLifecycleMove({
        lifecycleMove: { stage: 'In Review', targetStage: 'Approved' },
      })
    ).toEqual({ stage: 'In Review', targetStage: 'Approved' });
    expect(getLifecycleMove({ proposedChanges: {} })).toBeNull();
    expect(getLifecycleMove(undefined)).toBeNull();
  });
});
