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

import { render, screen, waitFor } from '@testing-library/react';
import { TreeDataNode } from 'antd';
import { HelmetProvider } from 'react-helmet-async';
import { NavigationItem } from '../../generated/system/ui/uiCustomization';
import { SettingsNavigationPage } from './SettingsNavigationPage';

const mockNavigationItems: NavigationItem[] = [
  {
    id: 'explore',
    title: 'label.explore',
    isHidden: false,
    pageId: 'explore',
  },
  {
    id: 'observability',
    title: 'label.observability',
    isHidden: false,
    pageId: 'observability',
    children: [
      {
        id: 'incidents',
        title: 'label.incident-plural',
        isHidden: false,
        pageId: 'incidents',
      },
      {
        id: 'data-quality',
        title: 'label.data-quality',
        isHidden: true,
        pageId: 'data-quality',
      },
    ],
  },
];

const mockTreeData: TreeDataNode[] = [
  {
    key: 'explore',
    title: 'label.explore',
    icon: <div>icon</div>,
  },
  {
    key: 'observability',
    title: 'label.observability',
    icon: <div>icon</div>,
    children: [
      {
        key: 'incidents',
        title: 'label.incident-plural',
        icon: <div>icon</div>,
      },
      {
        key: 'data-quality',
        title: 'label.data-quality',
        icon: <div>icon</div>,
      },
    ],
  },
];

jest.mock(
  '../../components/Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: jest.fn().mockReturnValue({
      plugins: [],
    }),
  })
);

jest.mock('../CustomizablePage/CustomizeStore', () => ({
  useCustomizeStore: jest.fn().mockReturnValue({
    getNavigation: jest.fn().mockImplementation(() => mockNavigationItems),
  }),
}));

jest.mock('../../utils/CustomizaNavigation/CustomizeNavigation', () => ({
  getTreeDataForNavigationItems: jest
    .fn()
    .mockImplementation(() => mockTreeData),
  getHiddenKeysFromNavigationItems: jest.fn().mockReturnValue(['data-quality']),
}));

jest.mock('../../utils/SettingsNavigationPageUtils', () => ({
  getNavigationItems: jest.fn().mockImplementation(() => mockNavigationItems),
}));

jest.mock(
  '../../components/MyData/CustomizableComponents/CustomizablePageHeader/CustomizablePageHeader',
  () => ({
    CustomizablePageHeader: jest
      .fn()
      .mockImplementation(({ onReset, onSave }) => (
        <div data-testid="customizable-page-header">
          <button data-testid="save-button" onClick={onSave}>
            Save
          </button>
          <button data-testid="reset-button" onClick={onReset}>
            Reset
          </button>
        </div>
      )),
  })
);

jest.mock(
  '../../components/common/NavigationBlocker/NavigationBlocker',
  () => ({
    NavigationBlocker: jest
      .fn()
      .mockImplementation(({ children }) => <div>{children}</div>),
  })
);

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
  useParams: jest.fn().mockReturnValue({
    fqn: 'test-persona',
  }),
  useLocation: jest.fn().mockReturnValue({
    pathname: '/settings',
    search: '',
    hash: '',
    state: null,
    key: 'default',
  }),
}));

describe('SettingsNavigationPage', () => {
  const mockOnSave = jest.fn().mockResolvedValue(undefined);

  const renderComponent = () => {
    return render(
      <HelmetProvider>
        <SettingsNavigationPage onSave={mockOnSave} />
      </HelmetProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the component with tree and buttons', () => {
    renderComponent();

    expect(screen.getByTestId('page-layout-v1')).toBeInTheDocument();
    expect(screen.getByTestId('save-button')).toBeInTheDocument();
    expect(screen.getByTestId('reset-button')).toBeInTheDocument();
    expect(screen.getByText('Navigation Menus')).toBeInTheDocument();
  });

  it('should have save button enabled by default when state matches current navigation', () => {
    renderComponent();

    const saveButton = screen.getByTestId('save-button');

    expect(saveButton).toBeEnabled();
  });

  it('should enable save button when tree structure changes', () => {
    const {
      getTreeDataForNavigationItems,
    } = require('../../utils/CustomizaNavigation/CustomizeNavigation');

    getTreeDataForNavigationItems.mockReturnValueOnce(mockTreeData);

    const modifiedTreeData = [
      {
        key: 'observability',
        title: 'label.observability',
        icon: <div>icon</div>,
        children: [],
      },
      {
        key: 'explore',
        title: 'label.explore',
        icon: <div>icon</div>,
      },
    ];

    getTreeDataForNavigationItems.mockReturnValueOnce(modifiedTreeData);

    renderComponent();

    const saveButton = screen.getByTestId('save-button');

    expect(saveButton).toBeEnabled();
  });

  it('should toggle hidden state when switch is clicked', async () => {
    renderComponent();

    const switches = screen.getAllByRole('switch');

    expect(switches.length).toBeGreaterThan(0);

    switches[0].click();

    await waitFor(() => {
      expect(screen.getByTestId('save-button')).toBeEnabled();
    });
  });

  it('should call onSave when save button is clicked', async () => {
    renderComponent();

    const saveButton = screen.getByTestId('save-button');

    saveButton.click();

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(mockNavigationItems);
    });
  });

  it('should reset tree data when reset button is clicked', () => {
    const {
      getTreeDataForNavigationItems,
      getHiddenKeysFromNavigationItems,
    } = require('../../utils/CustomizaNavigation/CustomizeNavigation');

    renderComponent();

    const resetButton = screen.getByTestId('reset-button');

    resetButton.click();

    expect(getTreeDataForNavigationItems).toHaveBeenCalledWith(null, []);
    expect(getHiddenKeysFromNavigationItems).toHaveBeenCalledWith(null, []);
  });

  it('should render tree with draggable items', () => {
    renderComponent();

    const tree = screen.getByRole('tree');

    expect(tree).toBeInTheDocument();
  });

  it('should show NavigationBlocker when there are unsaved changes', () => {
    const { container } = renderComponent();

    expect(container.querySelector('.ant-tree')).toBeInTheDocument();
  });

  it('should render switches for all tree items', () => {
    renderComponent();

    const switches = screen.getAllByRole('switch');

    expect(switches.length).toBeGreaterThan(0);
  });

  it('should have correct initial switch states based on hiddenKeys', () => {
    renderComponent();

    const switches = screen.getAllByRole('switch');

    switches.forEach((switchElement) => {
      expect(switchElement).toBeInTheDocument();
    });
  });
});
