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
import { Form } from 'antd';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useFqn } from '../../../hooks/useFqn';
import { MOCK_FILTER_RESOURCES } from '../../../test/unit/mocks/observability.mock';
import AlertFormSourceItem from './AlertFormSourceItem';

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: '' }),
}));

const FormWrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>
    <Form>{children}</Form>
  </MemoryRouter>
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

  it('commits a different source and clears incompatible filters and destinations', async () => {
    (useFqn as jest.Mock).mockReturnValue({ fqn: 'existing-alert' });
    const onFinish = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <MemoryRouter>
        <Form
          initialValues={{
            resources: ['all'],
            input: { filters: [{ name: 'filterByOwnerName' }] },
            destinations: [{ category: 'Admins', type: 'Email' }],
          }}
          onFinish={onFinish}>
          <AlertFormSourceItem
            filterResources={[{ name: 'all' }, { name: 'dashboard' }]}
          />
          <Form.List name={['input', 'filters']}>
            {(fields) =>
              fields.map((field) => (
                <div data-testid="existing-filter" key={field.key}>
                  Owner
                </div>
              ))
            }
          </Form.List>
          <Form.List name="destinations">
            {(fields) =>
              fields.map((field) => (
                <div data-testid="existing-destination" key={field.key}>
                  Email
                </div>
              ))
            }
          </Form.List>
          <button type="submit">Save source</button>
        </Form>
      </MemoryRouter>
    );

    expect(screen.getByTestId('existing-filter')).toBeVisible();
    expect(screen.getByTestId('existing-destination')).toBeVisible();

    await user.click(
      within(screen.getByTestId('source-select')).getByRole('combobox')
    );
    await user.click(screen.getByTestId('dashboard-option'));

    await waitFor(() =>
      expect(screen.queryByTestId('existing-filter')).not.toBeInTheDocument()
    );

    expect(
      screen.queryByTestId('existing-destination')
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save source' }));
    await waitFor(() =>
      expect(onFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          resources: ['dashboard'],
          input: { filters: undefined },
          destinations: [],
        })
      )
    );
  });
});
