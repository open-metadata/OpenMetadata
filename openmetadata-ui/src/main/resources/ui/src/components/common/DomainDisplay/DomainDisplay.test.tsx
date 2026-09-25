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
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { EntityReference } from '../../../generated/entity/type';
import { DomainDisplay } from './DomainDisplay.component';

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity?.name || 'Unknown'),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getDomainPath: jest
    .fn()
    .mockImplementation((fqn: string) => `/domain/${fqn}`),
}));

const mockDomain1: EntityReference = {
  id: 'domain-1',
  fullyQualifiedName: 'domain.one',
  name: 'Domain One',
  type: 'domain',
};

const mockDomain2: EntityReference = {
  id: 'domain-2',
  fullyQualifiedName: 'domain.two',
  name: 'Domain Two',
  type: 'domain',
};

const mockDomain3: EntityReference = {
  id: 'domain-3',
  fullyQualifiedName: 'domain.three',
  name: 'Domain Three',
  type: 'domain',
};

const renderDomainDisplay = (props: ComponentProps<typeof DomainDisplay>) =>
  render(
    <MemoryRouter>
      <DomainDisplay {...props} />
    </MemoryRouter>
  );

describe('DomainDisplay Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render nothing when domains array is empty', () => {
    const { container } = renderDomainDisplay({ domains: [] });

    expect(container.firstChild).toBeNull();
  });

  it('should render a single domain as a DomainTag chip linking to its page', () => {
    renderDomainDisplay({ domains: [mockDomain1] });

    const chip = screen.getByTestId('domain-tag-domain.one');

    expect(chip).toBeInTheDocument();
    expect(screen.getByText('Domain One')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/domain/domain.one'
    );
  });

  it('should show the first domain and collapse the rest behind a "+N More" toggle', () => {
    renderDomainDisplay({
      domains: [mockDomain1, mockDomain2, mockDomain3],
    });

    expect(screen.getByTestId('domain-tag-domain.one')).toBeInTheDocument();
    expect(
      screen.queryByTestId('domain-tag-domain.two')
    ).not.toBeInTheDocument();

    const showMore = screen.getByTestId('show-all-domains');

    expect(showMore).toBeInTheDocument();

    fireEvent.click(showMore);

    expect(screen.getByTestId('domain-tag-domain.two')).toBeInTheDocument();
    expect(screen.getByTestId('domain-tag-domain.three')).toBeInTheDocument();
  });

  it('should render a domain without a fully qualified name unlinked', () => {
    renderDomainDisplay({
      domains: [
        { id: 'x', name: 'No FQN Domain', type: 'domain' } as EntityReference,
      ],
    });

    expect(screen.getByText('No FQN Domain')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
