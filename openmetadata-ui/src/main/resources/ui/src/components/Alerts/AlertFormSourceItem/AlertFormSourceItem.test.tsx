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
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useFqn } from '../../../hooks/useFqn';
import { MOCK_FILTER_RESOURCES } from '../../../test/unit/mocks/observability.mock';
import AlertFormSourceItem from './AlertFormSourceItem';

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: '' }),
}));

const FormWrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe('AlertFormSourceItem', () => {
  beforeEach(() => {
    (useFqn as jest.Mock).mockReturnValue({ fqn: '' });
  });

  it('should renders without crashing', () => {
    render(<AlertFormSourceItem filterResources={MOCK_FILTER_RESOURCES} />, {
      wrapper: FormWrapper,
    });

    expect(screen.getByText('label.source')).toBeInTheDocument();
    expect(
      screen.getByText('message.alerts-source-description')
    ).toBeInTheDocument();

    expect(screen.getByTestId('add-source-button')).toBeInTheDocument();
  });

  it('should render the trigger select when fqn is provided', () => {
    (useFqn as jest.Mock).mockImplementation(() => ({
      fqn: 'test',
    }));

    render(<AlertFormSourceItem filterResources={MOCK_FILTER_RESOURCES} />, {
      wrapper: FormWrapper,
    });

    expect(screen.getByTestId('source-select')).toBeInTheDocument();
  });

  it('should display select dropdown when clicked on add trigger button', async () => {
    render(<AlertFormSourceItem filterResources={MOCK_FILTER_RESOURCES} />, {
      wrapper: FormWrapper,
    });
    const addButton = screen.getByTestId('add-source-button');
    fireEvent.click(addButton);

    expect(screen.getByTestId('drop-down-menu')).toBeInTheDocument();
  });

  it('keeps the source selection controlled and reports the previous selection on removal', async () => {
    (useFqn as jest.Mock).mockReturnValue({ fqn: 'existing-alert' });
    const changed = jest.fn();
    const SourceForm = () => {
      const [value, setValue] = useState(['all']);

      return (
        <MemoryRouter>
          <AlertFormSourceItem
            filterResources={[{ name: 'all' }, { name: 'dashboard' }]}
            value={value}
            onChange={(next, previous) => {
              changed(next, previous);
              setValue(next);
            }}
          />
        </MemoryRouter>
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
