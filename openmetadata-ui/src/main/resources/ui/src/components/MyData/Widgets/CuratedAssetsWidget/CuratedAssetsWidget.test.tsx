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
  Link: jest.fn().mockImplementation(({ children, to }) => (
    <a data-testid="entity-link" href={to}>
      {children}
    </a>
  )),
}));

// Mock SVG components
jest.mock(
  '../../../../assets/svg/curated-assets-no-data-placeholder.svg',
  () => ({
    ReactComponent: jest.fn().mockImplementation(({ height, width }) => (
      <div data-testid="curated-assets-empty-icon" style={{ height, width }}>
        Empty Icon
      </div>
    )),
  })
);

jest.mock(
  '../../../../assets/svg/curated-assets-not-found-placeholder.svg',
  () => ({
    ReactComponent: jest.fn().mockImplementation(({ height, width }) => (
      <div data-testid="curated-assets-no-data-icon" style={{ height, width }}>
        No Data Icon
      </div>
    )),
  })
);

jest.mock('../../../../assets/svg/edit-new.svg', () => ({
  ReactComponent: jest
    .fn()
    .mockImplementation(({ height, width, 'data-testid': dataTestId }) => (
      <div data-testid={dataTestId} style={{ height, width }}>
        Edit Icon
      </div>
    )),
}));

// Mock utility functions
jest.mock('../../../../utils/CuratedAssetsUtils', () => ({
  getExploreURLWithFilters: jest.fn().mockReturnValue('/explore?filter=test'),
  getModifiedQueryFilterWithSelectedAssets: jest.fn().mockReturnValue({}),
  getTotalResourceCount: jest.fn().mockReturnValue(15),
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

jest.mock('../../../../utils/EntityUtilClassBase', () => ({
  getEntityLink: jest.fn().mockReturnValue('/test-link'),
}));

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

jest.mock('../../../../utils/ServiceUtilClassBase', () => ({
  getServiceTypeLogo: jest.fn().mockReturnValue('test-logo.png'),
}));

jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(({ children, icon, type, className }) => (
    <div className={className} data-testid="error-placeholder" data-type={type}>
      {icon}
      {children}
    </div>
  ))
);

jest.mock(
  '../../../common/Skeleton/MyData/EntityListSkeleton/EntityListSkeleton.component',
  () =>
    jest.fn().mockImplementation(({ children, loading, dataLength }) => (
      <div
        data-length={dataLength}
        data-loading={loading}
        data-testid="loading-skeleton"
      >
        {children}
      </div>
    ))
);

jest.mock(
  '../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component',
  () => ({
    useAdvanceSearch: jest.fn().mockReturnValue({
      config: {},
    }),
  })
);

jest.mock('./CuratedAssetsModal/CuratedAssetsModal', () =>
  jest
    .fn()
    .mockImplementation(({ isOpen, onCancel, onSave, curatedAssetsData }) => {
      if (!isOpen) {
        return null;
      }

      return (
        <div data-testid="curated-assets-modal-container">
          <div data-testid="modal-title">
            {curatedAssetsData ? 'Edit Widget' : 'Create Widget'}
          </div>
          <div data-testid="modal-content">Modal Content</div>
          <button data-testid="cancelButton" onClick={onCancel}>
            Cancel
          </button>
          <button
            data-testid="saveButton"
            onClick={() => onSave({ title: 'Test Widget' })}
          >
            Save
          </button>
        </div>
      );
    })
);

const mockHandleRemoveWidget = jest.fn();
const mockHandleLayoutUpdate = jest.fn();

const mockEntityData = [
  {
    id: '1',
    name: 'Test Entity',
    type: 'table',
    fullyQualifiedName: 'test.entity',
    service: {
      displayName: 'Test Service',
    },
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
        title: 'Test Widget',
        resources: ['table'],
        queryFilter: '{}',
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
      aggregations: {
        entityType: {
          buckets: [{ key: 'table', doc_count: 10 }],
        },
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders entity icon when source icon is available', async () => {
    render(<CuratedAssetsWidget {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('entity-icon')).toBeInTheDocument();
    });
  });

  it('renders footer with view more button when data is available', async () => {
    render(<CuratedAssetsWidget {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('label.view-more-count')).toBeInTheDocument();
      expect(screen.getByTestId('arrow-right-icon')).toBeInTheDocument();
    });
  });

  it('renders empty state with create button when no data and no resources', () => {
    render(<CuratedAssetsWidget {...defaultProps} currentLayout={[]} />);

    expect(screen.getByText('message.no-curated-assets')).toBeInTheDocument();
    expect(screen.getByTestId('add-curated-asset-button')).toBeInTheDocument();
    expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
    expect(screen.getByTestId('curated-assets-empty-icon')).toBeInTheDocument();
  });

  it('renders no data state when resources selected but no data available', async () => {
    (searchQuery as jest.Mock).mockResolvedValueOnce({
      hits: { hits: [] },
      aggregations: { entityType: { buckets: [] } },
    });
    render(<CuratedAssetsWidget {...defaultProps} />);

    expect(
      screen.getByText('message.curated-assets-no-data-message')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('curated-assets-no-data-icon')
    ).toBeInTheDocument();
  });

  it('shows loading skeleton with correct data length', async () => {
    render(<CuratedAssetsWidget {...defaultProps} />);
    const skeleton = screen.getByTestId('loading-skeleton');

    expect(skeleton).toHaveAttribute('data-length', '5');
  });

  it('renders widget title from config', () => {
    render(<CuratedAssetsWidget {...defaultProps} />);

    expect(screen.getByText('Test Widget')).toBeInTheDocument();
  });

  it('renders default title when no title in config', () => {
    const propsWithoutTitle = {
      ...defaultProps,
      currentLayout: [
        {
          ...defaultProps.currentLayout[0],
          config: {
            resources: ['table'],
            queryFilter: '{}',
          },
        } as WidgetConfig,
      ],
    };
    render(<CuratedAssetsWidget {...propsWithoutTitle} />);

    expect(screen.getByText('label.curated-asset-plural')).toBeInTheDocument();
  });

  it('calls handleLayoutUpdate with correct data when saving new widget', () => {
    render(<CuratedAssetsWidget {...defaultProps} currentLayout={[]} />);
    fireEvent.click(screen.getByTestId('add-curated-asset-button'));
    fireEvent.click(screen.getByTestId('saveButton'));

    expect(mockHandleLayoutUpdate).toHaveBeenCalledWith([
      {
        i: 'test-widget',
        config: { title: 'Test Widget' },
      },
    ]);
  });

  it('calls handleLayoutUpdate with updated config when editing existing widget', () => {
    render(<CuratedAssetsWidget {...defaultProps} isEditView />);
    fireEvent.click(screen.getByTestId('edit-widget-button'));
    fireEvent.click(screen.getByTestId('saveButton'));

    expect(mockHandleLayoutUpdate).toHaveBeenCalledWith([
      {
        ...defaultProps.currentLayout[0],
        config: { title: 'Test Widget' },
      },
    ]);
  });

  it('closes modal and resets data when cancel is clicked', () => {
    render(<CuratedAssetsWidget {...defaultProps} currentLayout={[]} />);
    fireEvent.click(screen.getByTestId('add-curated-asset-button'));
    fireEvent.click(screen.getByTestId('cancelButton'));

    expect(
      screen.queryByTestId('curated-assets-modal-container')
    ).not.toBeInTheDocument();
  });

  it('renders edit modal with correct title when editing', () => {
    render(<CuratedAssetsWidget {...defaultProps} isEditView />);
    fireEvent.click(screen.getByTestId('edit-widget-button'));

    expect(screen.getByTestId('modal-title')).toHaveTextContent('Edit Widget');
  });

  it('renders create modal with correct title when creating', () => {
    render(<CuratedAssetsWidget {...defaultProps} currentLayout={[]} />);
    fireEvent.click(screen.getByTestId('add-curated-asset-button'));

    expect(screen.getByTestId('modal-title')).toHaveTextContent(
      'Create Widget'
    );
  });

  it('renders entity list with correct test IDs', async () => {
    render(<CuratedAssetsWidget {...defaultProps} />);
    await waitFor(() => {
      expect(
        screen.getByTestId('Recently Viewed-Test Entity')
      ).toBeInTheDocument();
    });
  });

  it('handles search query with correct parameters', async () => {
    render(<CuratedAssetsWidget {...defaultProps} />);
    await waitFor(() => {
      expect(searchQuery).toHaveBeenCalledWith({
        query: '',
        pageNumber: 1,
        pageSize: 10,
        searchIndex: 'table',
        includeDeleted: false,
        trackTotalHits: false,
        fetchSource: true,
        queryFilter: {},
      });
    });
  });
});
