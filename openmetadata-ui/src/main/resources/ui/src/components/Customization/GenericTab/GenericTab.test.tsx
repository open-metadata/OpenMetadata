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
import React from 'react';
import { useParams } from 'react-router-dom';
import { EntityTabs } from '../../../enums/entity.enum';
import { PageType } from '../../../generated/system/ui/page';
import { useGridLayoutDirection } from '../../../hooks/useGridLayoutDirection';
import {
  getDefaultWidgetForTab,
  getWidgetsFromKey,
} from '../../../utils/CustomizePage/CustomizePageUtils';
import { GenericTab } from './GenericTab';

// Mock the required dependencies
const mockUseCustomizeStore = jest.fn().mockImplementation(() => {
  return {
    currentPersonaDocStore: {
      data: {
        pages: [],
      },
    },
  };
});
jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => ({ tab: EntityTabs.DETAILS })),
}));

jest.mock('../../../hooks/useGridLayoutDirection', () => ({
  useGridLayoutDirection: jest.fn(),
}));

jest.mock('../../../pages/CustomizablePage/CustomizeStore', () => ({
  useCustomizeStore: () => mockUseCustomizeStore(),
}));

jest.mock('../../../utils/CustomizePage/CustomizePageUtils', () => ({
  getDefaultWidgetForTab: jest.fn(),
  getWidgetsFromKey: jest.fn(),
}));

describe('GenericTab', () => {
  const mockLayout = [
    { i: 'widget1', x: 0, y: 0, w: 1, h: 1 },
    { i: 'widget2', x: 1, y: 0, w: 1, h: 1 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useParams as jest.Mock).mockReturnValue({ tab: EntityTabs.DETAILS });
    (useGridLayoutDirection as jest.Mock).mockImplementation(() => ({
      direction: 'ltr',
    }));
    (getDefaultWidgetForTab as jest.Mock).mockReturnValue(mockLayout);
    (getWidgetsFromKey as jest.Mock).mockReturnValue(<div>Mock Widget</div>);
  });

  it('should render with default layout when no persona doc store exists', () => {
    (mockUseCustomizeStore as jest.Mock).mockReturnValue({
      currentPersonaDocStore: null,
    });

    render(<GenericTab type={PageType.Table} />);

    expect(getDefaultWidgetForTab).toHaveBeenCalledWith(
      PageType.Table,
      EntityTabs.DETAILS
    );
    expect(screen.getAllByText('Mock Widget')).toHaveLength(2);
  });

  it('should render with custom layout from persona doc store', () => {
    const mockPersonaDoc = {
      data: {
        pages: [
          {
            pageType: PageType.Table,
            tabs: [
              {
                id: EntityTabs.DETAILS,
                layout: [{ i: 'customWidget', x: 0, y: 0, w: 1, h: 1 }],
              },
            ],
          },
        ],
      },
    };

    (mockUseCustomizeStore as jest.Mock).mockImplementationOnce(() => ({
      currentPersonaDocStore: mockPersonaDoc,
    }));

    render(<GenericTab type={PageType.Table} />);

    expect(screen.getAllByText('Mock Widget')).toHaveLength(1);
  });

  it('should fallback to default layout when page not found in persona doc', () => {
    const mockPersonaDoc = {
      data: {
        pages: [
          {
            pageType: 'DifferentPageType',
            tabs: [],
          },
        ],
      },
    };

    (mockUseCustomizeStore as jest.Mock).mockImplementationOnce(() => ({
      currentPersonaDocStore: mockPersonaDoc,
    }));

    render(<GenericTab type={PageType.Table} />);

    expect(getDefaultWidgetForTab).toHaveBeenCalledWith(
      PageType.Table,
      EntityTabs.DETAILS
    );
    expect(screen.getAllByText('Mock Widget')).toHaveLength(2);
  });

  it('should not render widget when getWidgetsFromKey returns null', () => {
    (getWidgetsFromKey as jest.Mock).mockReturnValue(null);

    render(<GenericTab type={PageType.Table} />);

    expect(screen.queryByText('Mock Widget')).not.toBeInTheDocument();
  });
});
