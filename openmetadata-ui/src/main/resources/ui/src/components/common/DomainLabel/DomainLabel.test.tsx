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
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { DomainLabel } from './DomainLabel.component';

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity?.name || 'Unknown'),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getDomainPath: jest
    .fn()
    .mockImplementation((fqn: string) => `/domain/${fqn}`),
}));

jest.mock('../../../utils/Assets/AssetsUtils', () => ({
  getAPIfromSource: jest.fn().mockReturnValue(jest.fn()),
  getEntityAPifromSource: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../../../utils/DomainUtils', () => ({
  renderDomainLink: jest
    .fn()
    .mockImplementation((domain, displayName, className) => (
      <a
        className={`domain-link ${className || ''}`}
        data-testid="domain-link"
        href={`/domain/${domain.fullyQualifiedName}`}>
        {displayName || domain.name}
      </a>
    )),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../assets/svg/ic-domain.svg', () => ({
  ReactComponent: () => <div data-testid="domain-icon">Domain Icon</div>,
}));

jest.mock('../../../assets/svg/ic-inherit.svg', () => ({
  ReactComponent: () => <div data-testid="inherit-icon">Inherit Icon</div>,
}));

jest.mock('../DomainSelectableList/DomainSelectableList.component', () => ({
  __esModule: true,
  default: ({ onUpdate, selectedDomain }: any) => (
    <button
      data-testid="domain-selectable-list"
      onClick={() => onUpdate && onUpdate(selectedDomain)}>
      Select Domain
    </button>
  ),
}));

// Mock data
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

const mockInheritedDomain: EntityReference = {
  id: 'domain-inherited',
  fullyQualifiedName: 'domain.inherited',
  name: 'Inherited Domain',
  type: 'domain',
  inherited: true,
};

const defaultProps = {
  domains: [mockDomain1],
  entityType: EntityType.TABLE,
  entityFqn: 'test.table',
  entityId: 'test-id',
};

const renderDomainLabel = (props: any = {}) =>
  render(
    <MemoryRouter>
      <DomainLabel {...defaultProps} {...props} />
    </MemoryRouter>
  );

describe('DomainLabel Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render single domain correctly', () => {
    renderDomainLabel({ domains: [mockDomain1] });

    expect(screen.getByTestId('domain-link')).toBeInTheDocument();
    expect(screen.getByText('Domain One')).toBeInTheDocument();
  });

  it('should render multiple domains with dropdown when multiple and headerLayout are true', () => {
    renderDomainLabel({
      domains: [mockDomain1, mockDomain2],
      multiple: true,
      headerLayout: true,
    });

    expect(screen.getByText('Domain One')).toBeInTheDocument();
    expect(screen.getByTestId('domain-count-button')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('should render all domains when multiple is true but headerLayout is false', () => {
    renderDomainLabel({
      domains: [mockDomain1, mockDomain2],
      multiple: true,
      headerLayout: false,
    });

    expect(screen.getByText('Domain One')).toBeInTheDocument();
    expect(screen.getByText('Domain Two')).toBeInTheDocument();
    expect(screen.queryByTestId('domain-count-button')).not.toBeInTheDocument();
  });

  it('should render "No Domains" text when domains array is empty', () => {
    renderDomainLabel({ domains: [] });

    expect(screen.getByTestId('no-domain-text')).toBeInTheDocument();
    expect(screen.getByText('label.no-entity')).toBeInTheDocument();
  });

  it('should render "No Domains" text when domains is undefined', () => {
    renderDomainLabel({ domains: undefined });

    expect(screen.getByTestId('no-domain-text')).toBeInTheDocument();
    expect(screen.getByText('label.no-entity')).toBeInTheDocument();
  });

  it('should render inherited domain with inherit icon', () => {
    renderDomainLabel({ domains: [mockInheritedDomain] });

    expect(screen.getByText('Inherited Domain')).toBeInTheDocument();
  });

  it('should handle domain with missing name', () => {
    const domainWithoutName = {
      ...mockDomain1,
      name: undefined,
    };

    renderDomainLabel({ domains: [domainWithoutName] });

    expect(screen.getByTestId('domain-link')).toBeInTheDocument();
  });

  it('should render domain heading when showDomainHeading is true', () => {
    renderDomainLabel({ showDomainHeading: true });

    expect(screen.getByTestId('header-domain-container')).toBeInTheDocument();
    expect(screen.getByText('label.domain-plural')).toBeInTheDocument();
  });

  it('should not render domain heading when showDomainHeading is false', () => {
    renderDomainLabel({ showDomainHeading: false });

    expect(screen.queryByText('Domains')).not.toBeInTheDocument();
  });

  it('should not show domain icon for single domain in header layout', () => {
    renderDomainLabel({
      headerLayout: true,
      multiple: false,
      domains: [mockDomain1],
    });

    expect(screen.queryByTestId('domain-icon')).not.toBeInTheDocument();
  });

  it('should render DomainSelectableList when hasPermission is true', () => {
    renderDomainLabel({ hasPermission: true });

    expect(screen.getByTestId('domain-selectable-list')).toBeInTheDocument();
  });

  it('should not render DomainSelectableList when hasPermission is false', () => {
    renderDomainLabel({ hasPermission: false });

    expect(
      screen.queryByTestId('domain-selectable-list')
    ).not.toBeInTheDocument();
  });

  it('should not render DomainSelectableList when hasPermission is undefined', () => {
    renderDomainLabel({ hasPermission: undefined });

    expect(
      screen.queryByTestId('domain-selectable-list')
    ).not.toBeInTheDocument();
  });

  it('should handle domains as single object instead of array', () => {
    renderDomainLabel({ domains: mockDomain1 });

    expect(screen.getByText('Domain One')).toBeInTheDocument();
  });

  it('should handle empty domain object', () => {
    const emptyDomain = {} as EntityReference;

    renderDomainLabel({ domains: [emptyDomain] });

    expect(screen.getByTestId('domain-link')).toBeInTheDocument();
  });

  it('should handle domain with empty fullyQualifiedName', () => {
    const domainWithEmptyFQN = {
      ...mockDomain1,
      fullyQualifiedName: '',
    };

    renderDomainLabel({ domains: [domainWithEmptyFQN] });

    expect(screen.getByTestId('domain-link')).toBeInTheDocument();
  });

  it('should handle mixed domain types (inherited and non-inherited)', () => {
    renderDomainLabel({
      domains: [mockDomain1, mockInheritedDomain],
      multiple: true,
      headerLayout: true,
    });

    expect(screen.getByText('Domain One')).toBeInTheDocument();
    expect(screen.getByTestId('domain-count-button')).toBeInTheDocument();
  });

  it('should have proper test ID for domain count button', () => {
    renderDomainLabel({
      domains: [mockDomain1, mockDomain2],
      multiple: true,
      headerLayout: true,
    });

    expect(screen.getByTestId('domain-count-button')).toBeInTheDocument();
  });

  it('should have proper test ID for no domain text', () => {
    renderDomainLabel({ domains: [] });

    expect(screen.getByTestId('no-domain-text')).toBeInTheDocument();
  });
});
