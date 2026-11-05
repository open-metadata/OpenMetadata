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

import { act, render, screen } from '@testing-library/react';
import { searchQuery } from '../../../../../../rest/searchAPI';
import { getControlledArgumentFieldCoreUI } from './NotificationAlertArgFields';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  Box: jest
    .fn()
    .mockImplementation(({ children, ...props }) => (
      <div {...props}>{children}</div>
    )),
  Autocomplete: Object.assign(
    jest
      .fn()
      .mockImplementation(({ children, items, selectedItems, ...props }) => (
        <div {...props}>
          {items?.map((item: { id: string; label: string }) => children(item))}
          {selectedItems?.map((item: { id: string; label: string }) => (
            <span data-testid={`chip-${item.id}`} key={item.id}>
              {item.label}
            </span>
          ))}
        </div>
      )),
    {
      Item: jest
        .fn()
        .mockImplementation(({ children }) => <div>{children}</div>),
    }
  ),
}));

jest.mock('../../../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({ hits: { hits: [] } }),
}));

jest.mock('../../../../../../rest/contractAPI', () => ({
  searchContracts: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../../../../utils/EntityNameUtils', () => ({
  getEntityName: (entity: { name?: string; displayName?: string }) =>
    entity?.displayName ?? entity?.name ?? '',
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: { getEntityTypeSearchIndexMapping: () => ({}) },
}));

jest.mock('../../../../../../utils/SearchPureUtils', () => ({
  getTermQuery: jest.fn().mockReturnValue({}),
}));

function Wrapper({ argument }: { argument: string }) {
  return getControlledArgumentFieldCoreUI(
    argument,
    [],
    jest.fn(),
    'table',
    [],
    [],
    false
  );
}

function DisabledWrapper({ argument }: { argument: string }) {
  return getControlledArgumentFieldCoreUI(
    argument,
    [],
    jest.fn(),
    'table',
    [],
    [],
    true
  );
}

function ValueWrapper({
  argument,
  value,
}: {
  argument: string;
  value: string[];
}) {
  return getControlledArgumentFieldCoreUI(
    argument,
    value,
    jest.fn(),
    'table',
    [],
    [],
    false
  );
}

describe('NotificationAlertArgFields', () => {
  it('should render fqnList with correct data-testid', () => {
    render(<Wrapper argument="fqnList" />);

    expect(screen.getByTestId('fqn-list-select')).toBeInTheDocument();
  });

  it('should render domainList with correct data-testid', () => {
    render(<Wrapper argument="domainList" />);

    expect(screen.getByTestId('domain-select')).toBeInTheDocument();
  });

  it('should render eventTypeList with correct data-testid', () => {
    render(<Wrapper argument="eventTypeList" />);

    expect(screen.getByTestId('event-type-select')).toBeInTheDocument();
  });

  it('should render testStatusList with correct data-testid', () => {
    render(<Wrapper argument="testStatusList" />);

    expect(screen.getByTestId('test-status-select')).toBeInTheDocument();
  });

  it('should render empty fragment for unknown argument', () => {
    const { container } = render(<Wrapper argument="unknownField" />);

    expect(container.innerHTML).toBe('');
  });

  it('should propagate isDisabled state', () => {
    render(<DisabledWrapper argument="eventTypeList" />);

    const element = screen.getByTestId('event-type-select');

    expect(element).toBeInTheDocument();
  });

  it('resolves the label of a saved value that arrives after the field mounted, once', async () => {
    (searchQuery as jest.Mock)
      .mockClear()
      .mockResolvedValueOnce({ hits: { hits: [] } })
      .mockResolvedValueOnce({
        hits: {
          hits: [
            {
              _source: {
                fullyQualifiedName: 'ada',
                name: 'ada',
                displayName: 'Ada Lovelace',
              },
            },
          ],
        },
      });

    const { rerender } = render(
      <ValueWrapper argument="userList" value={[]} />
    );
    await act(async () => {
      rerender(<ValueWrapper argument="userList" value={['ada']} />);
    });

    expect(screen.getByTestId('chip-ada')).toHaveTextContent('Ada Lovelace');
    expect(searchQuery).toHaveBeenCalledTimes(2);

    await act(async () => {
      rerender(<ValueWrapper argument="userList" value={['ada']} />);
    });

    expect(searchQuery).toHaveBeenCalledTimes(2);
  });
});
