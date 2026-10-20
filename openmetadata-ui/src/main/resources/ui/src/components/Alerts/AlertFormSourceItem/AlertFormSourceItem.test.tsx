/*
 *  Copyright 2024 Collate.
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
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MOCK_FILTER_RESOURCES } from '../../../test/unit/mocks/observability.mock';
import AlertFormSourceItem from './AlertFormSourceItem';

describe('AlertFormSourceItem', () => {
  it('offers the source picker straight away, with nothing chosen', () => {
    render(<AlertFormSourceItem filterResources={MOCK_FILTER_RESOURCES} />);

    expect(screen.getByText('label.source')).toBeInTheDocument();
    expect(
      screen.getByText('message.alerts-source-description')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('source-select')).getByRole('combobox')
    ).toHaveAttribute('placeholder', 'label.select-field');
    expect(screen.queryByTestId('add-source-button')).not.toBeInTheDocument();
  });

  it('shows the error under the picker', () => {
    render(
      <AlertFormSourceItem
        error="Source is required"
        filterResources={MOCK_FILTER_RESOURCES}
      />
    );

    expect(screen.getByText('Source is required')).toBeInTheDocument();
  });

  it('keeps the source selection controlled and reports the previous selection on removal', async () => {
    const changed = jest.fn();
    const SourceForm = () => {
      const [value, setValue] = useState(['all']);

      return (
        <AlertFormSourceItem
          filterResources={[{ name: 'all' }, { name: 'dashboard' }]}
          value={value}
          onChange={(next, previous) => {
            changed(next, previous);
            setValue(next);
          }}
        />
      );
    };
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<SourceForm />);
    const [removeAll] = within(
      screen.getByTestId('source-select')
    ).getAllByRole('button');
    await user.click(removeAll);

    expect(changed).toHaveBeenLastCalledWith([], ['all']);

    await user.click(
      within(screen.getByTestId('source-select')).getByRole('combobox')
    );
    await user.click(screen.getByTestId('dashboard-option'));
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(changed).toHaveBeenLastCalledWith(['dashboard'], [])
    );

    expect(screen.getByTestId('source-select')).toHaveTextContent(
      'label.dashboard'
    );
  });
});
