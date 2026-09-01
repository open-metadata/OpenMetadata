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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MetricDeleteDialog from './MetricDeleteDialog';

const props = {
  isDeleting: false,
  isOpen: true,
  metricName: 'Gross Margin',
  onCancel: jest.fn(),
  onConfirm: jest.fn().mockResolvedValue(undefined),
};

describe('MetricDeleteDialog', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders an accessible Untitled soft and hard delete choice', () => {
    render(<MetricDeleteDialog {...props} />);

    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
    expect(
      screen.getByRole('radiogroup', { name: 'label.delete' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: /^label.soft-delete/ })
    ).toBeChecked();
    expect(
      screen.getByRole('radio', { name: /^label.permanently-delete/ })
    ).not.toBeChecked();
  });

  it('confirms the selected deletion mode', async () => {
    render(<MetricDeleteDialog {...props} />);

    fireEvent.click(screen.getByTestId('hard-delete'));
    fireEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() =>
      expect(props.onConfirm).toHaveBeenCalledWith('hard-delete')
    );
  });

  it('cancels without starting a deletion', () => {
    render(<MetricDeleteDialog {...props} />);

    fireEvent.click(screen.getByTestId('discard-button'));

    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('prevents dismissal while deletion is in progress', () => {
    render(<MetricDeleteDialog {...props} isDeleting />);

    expect(
      screen.queryByRole('button', { name: 'Close' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'label.cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'label.delete' })).toBeDisabled();
  });
});
