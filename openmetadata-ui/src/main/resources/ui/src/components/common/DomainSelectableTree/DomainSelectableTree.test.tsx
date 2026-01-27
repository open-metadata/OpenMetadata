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
import { createTheme, ThemeProvider } from '@mui/material';
import { render, screen, waitFor } from '@testing-library/react';
import { DEFAULT_DOMAIN_VALUE } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { Domain, DomainType } from '../../../generated/entity/domains/domain';
import { EntityReference } from '../../../generated/entity/type';
import * as domainAPI from '../../../rest/domainAPI';
import DomainSelectableTree from './DomainSelectableTree';

const mockDomains: Domain[] = [
  {
    id: '1',
    name: 'Engineering',
    fullyQualifiedName: 'Engineering',
    displayName: 'Engineering',
    description: 'Engineering domain',
    domainType: DomainType.SourceAligned,
    childrenCount: 2,
  },
  {
    id: '2',
    name: 'Marketing',
    fullyQualifiedName: 'Marketing',
    displayName: 'Marketing',
    description: 'Marketing domain',
    domainType: DomainType.SourceAligned,
    childrenCount: 0,
  },
];

const mockChildDomains: Domain[] = [
  {
    id: '3',
    name: 'Backend',
    fullyQualifiedName: 'Engineering.Backend',
    displayName: 'Backend',
    description: 'Backend domain',
    domainType: DomainType.SourceAligned,
    childrenCount: 0,
  },
  {
    id: '4',
    name: 'Frontend',
    fullyQualifiedName: 'Engineering.Frontend',
    displayName: 'Frontend',
    description: 'Frontend domain',
    domainType: DomainType.SourceAligned,
    childrenCount: 0,
  },
];

const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
const mockOnCancel = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../utils/DomainUtils', () => ({
  convertDomainsToTreeOptions: jest.fn().mockImplementation((domains) =>
    domains.map((domain: Domain) => ({
      key: domain.fullyQualifiedName,
      value: domain.fullyQualifiedName,
      name: domain.name,
      label: domain.displayName,
      children: domain.children
        ? domain.children.map((child) => ({
            key: (child as EntityReference).fullyQualifiedName,
            value: (child as EntityReference).fullyQualifiedName,
            name: (child as EntityReference).name,
            label: (child as EntityReference).displayName,
          }))
        : undefined,
    }))
  ),
  isDomainExist: jest.fn().mockReturnValue(false),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityReferenceFromEntity: jest
    .fn()
    .mockImplementation((entity: Domain) => ({
      id: entity.id,
      name: entity.name,
      fullyQualifiedName: entity.fullyQualifiedName,
      displayName: entity.displayName,
      type: EntityType.DOMAIN,
    })),
}));

jest.mock('../../../utils/StringsUtils', () => ({
  escapeESReservedCharacters: jest.fn().mockImplementation((value) => value),
  getEncodedFqn: jest.fn().mockImplementation((value) => value),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../hooks/useDomainStore', () => ({
  useDomainStore: jest.fn(() => ({
    activeDomain: DEFAULT_DOMAIN_VALUE,
  })),
}));

jest.mock('../Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader</div>);
});

const mockTheme = createTheme({
  palette: {
    primary: {
      main: '#1890ff',
      dark: '#096dd9',
    },
  },
  typography: {
    fontWeightMedium: 500,
  },
});

const renderComponent = (props = {}) => {
  const defaultProps = {
    value: [],
    onSubmit: mockOnSubmit,
    visible: true,
    onCancel: mockOnCancel,
    isMultiple: false,
    showAllDomains: false,
    ...props,
  };

  return render(
    <ThemeProvider theme={mockTheme}>
      <DomainSelectableTree {...defaultProps} />
    </ThemeProvider>
  );
};

describe('DomainSelectableTree', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(domainAPI, 'getDomainChildrenPaginated')
      .mockImplementation((fqn) => {
        if (fqn === 'Engineering') {
          return Promise.resolve({
            data: mockChildDomains,
            paging: { total: 2, offset: 0 },
          });
        }

        return Promise.resolve({
          data: mockDomains,
          paging: { total: 2, offset: 0 },
        });
      });

    jest.spyOn(domainAPI, 'searchDomains').mockResolvedValue([mockDomains[0]]);
  });

  it('should render the component', async () => {
    renderComponent();

    expect(screen.getByTestId('domain-selectable-tree')).toBeInTheDocument();
    expect(screen.getByTestId('searchbar')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Loader')).not.toBeInTheDocument();
    });
  });

  it('should display search input', () => {
    renderComponent();

    const searchInput = screen.getByTestId('searchbar');

    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute('placeholder', 'label.search');
  });

  it('should show all domains selector when showAllDomains is true', () => {
    renderComponent({ showAllDomains: true });

    expect(screen.getByTestId('all-domains-selector')).toBeInTheDocument();
    expect(screen.getByText('label.all-domain-plural')).toBeInTheDocument();
  });

  it('should not show all domains selector when showAllDomains is false', () => {
    renderComponent({ showAllDomains: false });

    expect(
      screen.queryByTestId('all-domains-selector')
    ).not.toBeInTheDocument();
  });

  it('should render all domains selector with correct attributes', () => {
    renderComponent({ showAllDomains: true });

    const allDomainsButton = screen.getByTestId('all-domains-selector');

    expect(allDomainsButton).toHaveAttribute('tabIndex', '0');
  });

  it('should show update and cancel buttons in multiple select mode', async () => {
    renderComponent({ isMultiple: true });

    await waitFor(() => {
      expect(screen.getByTestId('saveAssociatedTag')).toBeInTheDocument();
      expect(screen.getByTestId('cancelAssociatedTag')).toBeInTheDocument();
    });
  });

  it('should not show update and cancel buttons in single select mode', async () => {
    renderComponent({ isMultiple: false });

    await waitFor(() => {
      expect(screen.queryByTestId('saveAssociatedTag')).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('cancelAssociatedTag')
      ).not.toBeInTheDocument();
    });
  });

  it('should render cancel button in multiple select mode', async () => {
    renderComponent({ isMultiple: true });

    await waitFor(() => {
      const cancelButton = screen.getByTestId('cancelAssociatedTag');

      expect(cancelButton).toBeInTheDocument();
    });
  });

  it('should load domains when visible is true', async () => {
    renderComponent({ visible: true });

    await waitFor(() => {
      expect(domainAPI.getDomainChildrenPaginated).toHaveBeenCalledWith(
        undefined,
        15,
        0
      );
    });
  });

  it('should have search input with correct placeholder', () => {
    renderComponent();

    const searchInput = screen.getByTestId('searchbar');

    expect(searchInput).toHaveAttribute('placeholder', 'label.search');
  });

  it('should handle initial domains prop', () => {
    const initialDomains: EntityReference[] = [
      {
        id: '1',
        name: 'Engineering',
        fullyQualifiedName: 'Engineering',
        displayName: 'Engineering',
        type: EntityType.DOMAIN,
      },
    ];

    renderComponent({ initialDomains });

    expect(screen.getByTestId('domain-selectable-tree')).toBeInTheDocument();
  });

  it('should display empty state when no domains are available', async () => {
    jest.spyOn(domainAPI, 'getDomainChildrenPaginated').mockResolvedValueOnce({
      data: [],
      paging: { total: 0, offset: 0 },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('label.no-entity-available')).toBeInTheDocument();
    });
  });

  it('should show loading state initially', () => {
    renderComponent();

    expect(screen.getByText('Loader')).toBeInTheDocument();
  });

  it('should handle single select mode correctly', async () => {
    renderComponent({ isMultiple: false, value: ['Engineering'] });

    await waitFor(() => {
      expect(screen.queryByText('Loader')).not.toBeInTheDocument();
    });
  });

  it('should handle multiple select mode correctly', async () => {
    renderComponent({
      isMultiple: true,
      value: ['Engineering', 'Marketing'],
    });

    await waitFor(() => {
      expect(screen.queryByText('Loader')).not.toBeInTheDocument();
    });
  });

  it('should render update button with correct attributes in multiple mode', async () => {
    renderComponent({
      isMultiple: true,
      value: ['Engineering'],
    });

    await waitFor(() => {
      expect(screen.queryByText('Loader')).not.toBeInTheDocument();
    });

    const updateButton = screen.getByTestId('saveAssociatedTag');

    expect(updateButton).toBeInTheDocument();
    expect(updateButton).toHaveAttribute('type', 'submit');
  });

  it('should fetch child domains when parent is expanded', async () => {
    renderComponent({ value: ['Engineering'] });

    await waitFor(() => {
      expect(domainAPI.getDomainChildrenPaginated).toHaveBeenCalled();
    });
  });

  it('should render tree when domains are loaded', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.queryByText('Loader')).not.toBeInTheDocument();
    });

    const domainSelectableTree = screen.getByTestId('domain-selectable-tree');

    expect(domainSelectableTree).toBeInTheDocument();
  });

  it('should maintain selected domains in multiple select mode', async () => {
    renderComponent({
      isMultiple: true,
      value: ['Engineering', 'Marketing'],
    });

    await waitFor(() => {
      expect(screen.queryByText('Loader')).not.toBeInTheDocument();
    });
  });

  it('should handle visible prop change', async () => {
    const { rerender } = render(
      <ThemeProvider theme={mockTheme}>
        <DomainSelectableTree
          isMultiple={false}
          value={[]}
          visible={false}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      </ThemeProvider>
    );

    rerender(
      <ThemeProvider theme={mockTheme}>
        <DomainSelectableTree
          visible
          isMultiple={false}
          value={[]}
          onCancel={mockOnCancel}
          onSubmit={mockOnSubmit}
        />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('domain-selectable-tree')).toBeInTheDocument();
    });
  });

  it('should handle load more functionality for child domains', async () => {
    jest.spyOn(domainAPI, 'getDomainChildrenPaginated').mockResolvedValueOnce({
      data: mockDomains,
      paging: { total: 20, offset: 0 },
    });

    renderComponent();

    await waitFor(() => {
      expect(domainAPI.getDomainChildrenPaginated).toHaveBeenCalled();
    });
  });
});
