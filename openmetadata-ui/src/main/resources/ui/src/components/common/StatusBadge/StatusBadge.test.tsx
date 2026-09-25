/*
 *  Copyright 2025 Collate.
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
import StatusBadge from './StatusBadge.component';
import { StatusType } from './StatusBadge.interface';

describe('StatusBadge', () => {
  it('renders the label and forwards the data-testid', () => {
    render(
      <StatusBadge dataTestId="sb" label="Failed" status={StatusType.Failure} />
    );

    expect(screen.getByTestId('sb')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('keeps the legacy status hook classes for consumers/e2e', () => {
    render(
      <StatusBadge dataTestId="sb" label="Ok" status={StatusType.Success} />
    );

    expect(screen.getByTestId('sb')).toHaveClass('status-badge', 'success');
    expect(screen.getByText('Ok')).toHaveClass('status-badge-label');
  });

  it('maps each status to the expected core Badge utility color', () => {
    const cases: [StatusType, string][] = [
      [StatusType.Failure, 'utility-error'],
      [StatusType.Success, 'utility-success'],
      [StatusType.Pending, 'utility-warning'],
      [StatusType.Started, 'utility-purple'],
      [StatusType.Aborted, 'utility-orange'],
      [StatusType.Deprecated, 'utility-gray'],
    ];

    cases.forEach(([status, expected]) => {
      const { unmount } = render(
        <StatusBadge dataTestId="sb" label={status} status={status} />
      );

      expect(screen.getByTestId('sb').className).toContain(expected);

      unmount();
    });
  });
});
