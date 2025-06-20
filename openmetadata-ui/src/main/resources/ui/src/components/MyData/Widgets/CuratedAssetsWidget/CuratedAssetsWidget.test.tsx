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
// /*
//  *  Copyright 2024 Collate.
//  *  Licensed under the Apache License, Version 2.0 (the "License");
//  *  you may not use this file except in compliance with the License.
//  *  You may obtain a copy of the License at
//  *  http://www.apache.org/licenses/LICENSE-2.0
//  *  Unless required by applicable law or agreed to in writing, software
//  *  distributed under the License is distributed on an "AS IS" BASIS,
//  *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  *  See the License for the specific language governing permissions and
//  *  limitations under the License.
//  */
// import { act, fireEvent, render, screen } from '@testing-library/react';
// import React from 'react';
// import { getRecentlyViewedData } from '../../../../utils/CommonUtils';
// import RecentlyViewed from './CuratedAsset';

// const mockProp = {
//   widgetKey: 'testKey',
// };

// jest.mock(
//   '../../../common/Skeleton/MyData/EntityListSkeleton/EntityListSkeleton.component',
//   () => {
//     return jest
//       .fn()
//       .mockImplementation(({ children }) => <div>{children}</div>);
//   }
// );
// jest.mock('../../../../hooks/useCustomLocation/useCustomLocation', () => {
//   return jest.fn().mockImplementation(() => ({ pathname: '' }));
// });

// jest.mock('react-router-dom', () => ({
//   Link: jest.fn().mockImplementation(() => <div>Link</div>),
// }));

// jest.mock('../../../../utils/CommonUtils', () => ({
//   getRecentlyViewedData: jest.fn().mockReturnValue([
//     {
//       displayName: 'test',
//       entityType: 'table',
//       fqn: 'test',
//       id: '1',
//       serviceType: 'BigQuery',
//       name: 'Test Item',
//       fullyQualifiedName: 'test.item',
//       type: 'test',
//       timestamp: 1706533046620,
//     },
//   ]),
//   prepareLabel: jest.fn(),
// }));

// describe('RecentlyViewed', () => {
//   it('should render RecentlyViewed', async () => {
//     await act(async () => {
//       render(<RecentlyViewed widgetKey={mockProp.widgetKey} />);
//     });

//     expect(screen.getByTestId('recently-viewed-widget')).toBeInTheDocument();
//   });

//   it('should call handleCloseClick when close button is clicked', async () => {
//     const handleRemoveWidget = jest.fn();
//     const { getByTestId } = render(
//       <RecentlyViewed
//         isEditView
//         handleRemoveWidget={handleRemoveWidget}
//         widgetKey="testKey"
//       />
//     );
//     fireEvent.click(getByTestId('remove-widget-button'));

//     expect(handleRemoveWidget).toHaveBeenCalled();
//   });

//   it('renders list item when data is not empty', async () => {
//     await act(async () => {
//       render(<RecentlyViewed widgetKey={mockProp.widgetKey} />);
//     });

//     expect(screen.getByTestId('Recently Viewed-test')).toBeInTheDocument();
//   });

//   it('should render no data placeholder when data is  empty', async () => {
//     (getRecentlyViewedData as jest.Mock).mockReturnValue([]),
//       await act(async () => {
//         render(<RecentlyViewed widgetKey={mockProp.widgetKey} />);
//       });

//     expect(screen.getByTestId('no-data-placeholder')).toBeInTheDocument();
//   });
// });

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { WidgetConfig } from '../../../../pages/CustomizablePage/CustomizablePage.interface';
import { searchQuery } from '../../../../rest/searchAPI';
import CuratedAssetsWidget from './CuratedAssetsWidget';

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
}));

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
}));

jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="error-placeholder">Error Placeholder</div>
    ))
);

jest.mock(
  '../../../common/Skeleton/MyData/EntityListSkeleton/EntityListSkeleton.component',
  () =>
    jest.fn().mockImplementation(({ children, loading }) => (
      <div data-loading={loading} data-testid="loading-skeleton">
        {children}
      </div>
    ))
);

jest.mock('../../../../utils/EntityUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity.name || 'Test Entity'),
}));

jest.mock('../../../../utils/SearchClassBase', () => ({
  getEntityIcon: jest
    .fn()
    .mockImplementation(() => <div data-testid="entity-icon">Icon</div>),
}));

jest.mock('../../../../utils/EntityUtilClassBase', () => ({
  getEntityLink: jest.fn().mockReturnValue('/test-link'),
}));

jest.mock('../../../../utils/CustomizeMyDataPageClassBase', () => ({
  default: {
    curatedAssetsWidgetDefaultValues: {
      x: 0,
      y: 0,
      w: 2,
      h: 2,
    },
  },
}));

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Card: jest.fn().mockImplementation(({ children, className, dataTestId }) => (
    <div className={className} data-testid={dataTestId}>
      {children}
    </div>
  )),
  Button: jest
    .fn()
    .mockImplementation(({ children, onClick, icon, type, dataTestId }) => (
      <button data-testid={dataTestId} type={type} onClick={onClick}>
        {icon}
        {children}
      </button>
    )),
  Typography: {
    Paragraph: jest
      .fn()
      .mockImplementation(({ children, className }) => (
        <p className={className}>{children}</p>
      )),
    Text: jest.fn().mockImplementation(({ children, ellipsis }) => (
      <span
        data-testid="entity-name"
        title={ellipsis?.tooltip ? children : undefined}>
        {children}
      </span>
    )),
  },
  Row: jest.fn().mockImplementation(({ children, justify }) => (
    <div data-justify={justify} data-testid="row">
      {children}
    </div>
  )),
  Col: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  Space: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
}));

const mockHandleRemoveWidget = jest.fn();
const mockHandleLayoutUpdate = jest.fn();

const mockEntityData = [
  {
    id: '1',
    name: 'Test Entity',
    type: 'table',
    fullyQualifiedName: 'test.entity',
  },
];

const defaultProps = {
  isEditView: false,
  handleRemoveWidget: mockHandleRemoveWidget,
  widgetKey: 'test-widget',
  handleLayoutUpdate: mockHandleLayoutUpdate,
  currentLayout: [
    {
      i: 'test-widget',
      x: 0,
      y: 0,
      w: 2,
      h: 2,
      static: false,
      isDraggable: true,
      config: {
        sourceConfig: {
          config: {
            appConfig: {
              resources: {
                type: ['table'],
                queryFilter: '{}',
              },
            },
          },
        },
      },
    } as WidgetConfig,
  ],
};

describe('CuratedAssetsWidget', () => {
  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({
      t: (key: string) => key,
    });
    (searchQuery as jest.Mock).mockResolvedValue({
      hits: {
        hits: mockEntityData.map((entity) => ({ _source: entity })),
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders widget with correct title', () => {
    render(<CuratedAssetsWidget {...defaultProps} />);

    expect(screen.getByText('label.curated-asset-plural')).toBeInTheDocument();
  });

  it('shows edit button when in edit mode', () => {
    render(<CuratedAssetsWidget {...defaultProps} isEditView />);
    const editButton = screen.getByTestId('drag-widget-button');

    expect(editButton).toBeInTheDocument();
  });

  it('shows remove button when in edit mode', () => {
    render(<CuratedAssetsWidget {...defaultProps} isEditView />);
    const removeButton = screen.getByTestId('remove-widget-button');

    expect(removeButton).toBeInTheDocument();
  });

  it('calls handleRemoveWidget when remove button is clicked', () => {
    render(<CuratedAssetsWidget {...defaultProps} isEditView />);
    const removeButton = screen.getByTestId('remove-widget-button');
    fireEvent.click(removeButton);

    expect(mockHandleRemoveWidget).toHaveBeenCalledWith(defaultProps.widgetKey);
  });

  it('opens modal when add button is clicked', () => {
    render(<CuratedAssetsWidget {...defaultProps} currentLayout={[]} />);
    const addButton = screen.getByTestId('add-curated-asset-button');
    fireEvent.click(addButton);

    expect(
      screen.getByTestId('curated-assets-modal-container')
    ).toBeInTheDocument();
  });

  it('displays empty state when no assets are curated', () => {
    render(<CuratedAssetsWidget {...defaultProps} currentLayout={[]} />);

    expect(screen.getByText('message.no-curated-assets')).toBeInTheDocument();
  });

  it('displays loading state when data is being fetched', async () => {
    render(<CuratedAssetsWidget {...defaultProps} />);

    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('displays curated assets when data is available', async () => {
    render(<CuratedAssetsWidget {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test Entity')).toBeInTheDocument();
    });
  });

  it('handles search query error gracefully', async () => {
    (searchQuery as jest.Mock).mockRejectedValueOnce(
      new Error('Search failed')
    );
    render(<CuratedAssetsWidget {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('message.no-curated-assets')).toBeInTheDocument();
    });
  });

  it('updates layout when save is called from modal', async () => {
    render(<CuratedAssetsWidget {...defaultProps} currentLayout={[]} />);

    const addButton = screen.getByTestId('add-curated-asset-button');
    fireEvent.click(addButton);

    const saveButton = screen.getByTestId('saveButton');
    fireEvent.click(saveButton);

    expect(mockHandleLayoutUpdate).toHaveBeenCalled();
  });

  it('closes modal and resets data when cancel is clicked', () => {
    render(<CuratedAssetsWidget {...defaultProps} currentLayout={[]} />);

    const addButton = screen.getByTestId('add-curated-asset-button');
    fireEvent.click(addButton);

    const cancelButton = screen.getByTestId('cancelButton');
    fireEvent.click(cancelButton);

    expect(
      screen.queryByTestId('curated-assets-modal-container')
    ).not.toBeInTheDocument();
  });

  it('displays drag handle in edit mode', () => {
    render(<CuratedAssetsWidget {...defaultProps} isEditView />);

    expect(screen.getByTestId('drag-widget-button')).toBeInTheDocument();
  });

  it('renders entity links correctly', async () => {
    render(<CuratedAssetsWidget {...defaultProps} />);

    await waitFor(() => {
      const entityLink = screen.getByText('Test Entity');

      expect(entityLink).toBeInTheDocument();
    });
  });

  it('handles empty selected resource gracefully', async () => {
    const propsWithEmptyResource = {
      ...defaultProps,
      currentLayout: [
        {
          ...defaultProps.currentLayout[0],
          config: {
            sourceConfig: {
              config: {
                appConfig: {
                  resources: {
                    type: [],
                    queryFilter: '{}',
                  },
                },
              },
            },
          },
        } as WidgetConfig,
      ],
    };

    render(<CuratedAssetsWidget {...propsWithEmptyResource} />);

    await waitFor(() => {
      expect(screen.getByText('message.no-curated-assets')).toBeInTheDocument();
    });
  });

  it('handles invalid query filter gracefully', async () => {
    const propsWithInvalidFilter = {
      ...defaultProps,
      currentLayout: [
        {
          ...defaultProps.currentLayout[0],
          config: {
            sourceConfig: {
              config: {
                appConfig: {
                  resources: {
                    type: ['table'],
                    queryFilter: 'invalid-json',
                  },
                },
              },
            },
          },
        } as WidgetConfig,
      ],
    };

    render(<CuratedAssetsWidget {...propsWithInvalidFilter} />);

    await waitFor(() => {
      expect(screen.getByText('message.no-curated-assets')).toBeInTheDocument();
    });
  });

  it('opens popover when filter button is clicked', () => {
    render(<CuratedAssetsWidget {...defaultProps} isEditView />);
    const filterButton = screen.getByTestId('filter-button');
    fireEvent.click(filterButton);

    expect(screen.getByText('label.edit-widget')).toBeInTheDocument();
    expect(screen.getByText('label.refresh')).toBeInTheDocument();
    expect(screen.getByText('label.view-all')).toBeInTheDocument();
  });

  it('closes popover when clicking outside', () => {
    render(<CuratedAssetsWidget {...defaultProps} isEditView />);
    const filterButton = screen.getByTestId('filter-button');
    fireEvent.click(filterButton);

    expect(screen.getByText('label.edit-widget')).toBeInTheDocument();

    // Click outside to close
    fireEvent.click(document.body);

    expect(screen.queryByText('label.edit-widget')).not.toBeInTheDocument();
  });

  it('opens edit modal when edit option is clicked in popover', () => {
    render(<CuratedAssetsWidget {...defaultProps} isEditView />);
    const filterButton = screen.getByTestId('filter-button');
    fireEvent.click(filterButton);

    const editOption = screen.getByText('label.edit-widget');
    fireEvent.click(editOption);

    expect(
      screen.getByTestId('curated-assets-modal-container')
    ).toBeInTheDocument();
  });

  it('refreshes data when refresh option is clicked in popover', async () => {
    render(<CuratedAssetsWidget {...defaultProps} isEditView />);
    const filterButton = screen.getByTestId('filter-button');
    fireEvent.click(filterButton);

    const refreshOption = screen.getByText('label.refresh');
    fireEvent.click(refreshOption);

    // Verify that searchQuery was called (data refresh)
    expect(searchQuery).toHaveBeenCalled();
  });

  it('handles view-all option click in popover', () => {
    render(<CuratedAssetsWidget {...defaultProps} isEditView />);
    const filterButton = screen.getByTestId('filter-button');
    fireEvent.click(filterButton);

    const viewAllOption = screen.getByText('label.view-all');
    fireEvent.click(viewAllOption);

    // Popover should close after clicking view-all
    expect(screen.queryByText('label.view-all')).not.toBeInTheDocument();
  });
});
