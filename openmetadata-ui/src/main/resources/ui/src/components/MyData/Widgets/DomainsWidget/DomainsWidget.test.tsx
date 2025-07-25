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
import { MemoryRouter } from 'react-router-dom';
import {
  Domain,
  DomainType,
} from '../../../../generated/entity/domains/domain';
import { getDomainList } from '../../../../rest/domainAPI';
import DomainsWidget from './DomainsWidget';

const mockProps = {
  isEditView: false,
  handleRemoveWidget: jest.fn(),
  widgetKey: 'domains-widget',
  handleLayoutUpdate: jest.fn(),
  currentLayout: [
    {
      i: 'domains-widget',
      x: 0,
      y: 0,
      w: 2,
      h: 4,
      config: {},
    },
  ],
};

const mockDomains: Domain[] = [
  {
    id: '1',
    name: 'clients',
    displayName: 'Clients',
    assets: [{ id: 'a1', type: 'table' }],
    style: { color: '#4F8CFF', iconURL: '' },
    domainType: DomainType.Aggregate,
    description: '',
  },
  {
    id: '2',
    name: 'marketing',
    displayName: 'Marketing',
    assets: [
      { id: 'a2', type: 'table' },
      { id: 'a3', type: 'table' },
    ],
    style: { color: '#A259FF', iconURL: '' },
    domainType: DomainType.Aggregate,
    description: '',
  },
];

jest.mock('../../../../rest/domainAPI', () => ({
  getDomainList: jest.fn(() => Promise.resolve({ data: mockDomains })),
}));

describe('DomainsWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderDomainsWidget = (props = {}) => {
    return render(
      <MemoryRouter>
        <DomainsWidget {...mockProps} {...props} />
      </MemoryRouter>
    );
  };

  it('renders widget with header', async () => {
    renderDomainsWidget();

    expect(await screen.findByTestId('widget-header')).toBeInTheDocument();
  });

  it('renders widget wrapper', async () => {
    renderDomainsWidget();

    expect(await screen.findByTestId('widget-wrapper')).toBeInTheDocument();
  });

  it('renders a list of domains', async () => {
    renderDomainsWidget();

    expect(await screen.findByText('Clients')).toBeInTheDocument();
    expect(await screen.findByText('Marketing')).toBeInTheDocument();
  });

  it('renders empty state when no domains', async () => {
    (getDomainList as jest.Mock).mockResolvedValue({ data: [] });
    renderDomainsWidget();

    expect(await screen.findByText('label.no-domains-yet')).toBeInTheDocument();
  });
});
