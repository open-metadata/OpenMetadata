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
import { fireEvent, render, screen } from '@testing-library/react';
import MetricStatusAction from './MetricStatusAction.component';

describe('MetricStatusAction', () => {
  it('requires a reviewer note for Reject but not Approve', () => {
    const onApprove = jest.fn();
    const onReject = jest.fn();
    const onNoteChange = jest.fn();
    const { rerender } = render(
      <MetricStatusAction
        note=""
        onApprove={onApprove}
        onNoteChange={onNoteChange}
        onReject={onReject}
      />
    );

    expect(screen.getByTestId('metric-approval-reject-btn')).toBeDisabled();
    expect(screen.getByTestId('metric-approval-approve-btn')).toBeEnabled();

    fireEvent.click(screen.getByTestId('metric-approval-approve-btn'));

    expect(onApprove).toHaveBeenCalledTimes(1);

    rerender(
      <MetricStatusAction
        note="Missing definition"
        onApprove={onApprove}
        onNoteChange={onNoteChange}
        onReject={onReject}
      />
    );
    fireEvent.click(screen.getByTestId('metric-approval-reject-btn'));

    expect(onReject).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('metric-approval-reject-btn')).toHaveTextContent(
      'label.reject'
    );
    expect(screen.queryByText('label.decline')).not.toBeInTheDocument();
  });
});
