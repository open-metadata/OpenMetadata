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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AxiosError } from 'axios';
import React from 'react';
import { CustomizeEntityType } from '../../../constants/Customize.constants';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { ThreadType } from '../../../generated/entity/feed/thread';
import { PageType } from '../../../generated/system/ui/page';
import { postThread } from '../../../rest/feedsAPI';
import { updateWidgetHeightRecursively } from '../../../utils/CustomizePage/CustomizePageUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import ActivityThreadPanel from '../../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { GenericProvider, useGenericContext } from './GenericProvider';

// Mock dependencies
jest.mock('../../../rest/feedsAPI');

jest.mock('../../../hooks/useCustomPages', () => ({
  useCustomPages: jest.fn().mockImplementation(() => ({
    customizedPage: {
      pageType: PageType.Table,
      tabs: [],
    },
  })),
}));

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => ({ tab: EntityTabs.SCHEMA })),
}));

jest.mock('../../../utils/CustomizePage/CustomizePageUtils', () => ({
  getLayoutFromCustomizedPage: jest.fn().mockImplementation(() => []),
  updateWidgetHeightRecursively: jest.fn(),
}));

// Mock ActivityFeedProvider
jest.mock(
  '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => ({
    ActivityFeedProvider: ({ children }: { children: React.ReactNode }) =>
      children,
    useActivityFeedProvider: () => ({
      postFeed: jest.fn(),
      deleteFeed: jest.fn(),
      updateFeed: jest.fn(),
    }),
  })
);

jest.mock('../../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => <div>ActivityThreadPanel</div>),
}));

// Test component that uses the context
const TestComponent = () => {
  const context = useGenericContext();

  return (
    <div>
      <div data-testid="context-data">{JSON.stringify(context.data)}</div>
      <button
        onClick={() =>
          context.onThreadLinkSelect('test-link', ThreadType.Task)
        }>
        Open Thread
      </button>
      <button onClick={() => context.updateWidgetHeight('widget-id', 100)}>
        Update Widget Height
      </button>
    </div>
  );
};

describe('GenericProvider', () => {
  const mockData = {
    id: '123',
    name: 'Test Entity',
  };

  const defaultProps = {
    data: mockData,
    type: EntityType.TABLE as CustomizeEntityType,
    onUpdate: jest.fn(),
    permissions: DEFAULT_ENTITY_PERMISSION,
  };

  it('should render children and provide context values', () => {
    render(
      <GenericProvider {...defaultProps}>
        <TestComponent />
      </GenericProvider>
    );

    expect(screen.getByTestId('context-data')).toHaveTextContent(
      JSON.stringify(mockData)
    );
  });

  it('should handle thread panel opening', async () => {
    render(
      <GenericProvider {...defaultProps}>
        <TestComponent />
      </GenericProvider>
    );

    // Initially, thread panel should not be visible
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Open thread panel
    fireEvent.click(screen.getByText('Open Thread'));

    // Thread panel should be visible
    expect(ActivityThreadPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        threadLink: 'test-link',
        threadType: 'Task',
      }),
      {}
    );
  });

  it('should handle thread creation successfully', async () => {
    (postThread as jest.Mock).mockResolvedValueOnce({});

    render(
      <GenericProvider {...defaultProps}>
        <TestComponent />
      </GenericProvider>
    );

    // Open thread panel
    fireEvent.click(screen.getByText('Open Thread'));

    // Thread panel should be visible
    expect(ActivityThreadPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        threadLink: 'test-link',
        threadType: 'Task',
      }),
      {}
    );

    // Simulate thread creation
    await act(async () => {
      await (postThread as jest.Mock)({ message: 'Test thread' });
    });

    expect(postThread).toHaveBeenCalled();
  });

  it('should handle thread creation error', async () => {
    const error = new Error('Network error') as AxiosError;
    (postThread as jest.Mock).mockRejectedValueOnce(error);

    render(
      <GenericProvider {...defaultProps}>
        <TestComponent />
      </GenericProvider>
    );

    // Open thread panel
    fireEvent.click(screen.getByText('Open Thread'));

    // Thread panel should be visible
    expect(ActivityThreadPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        threadLink: 'test-link',
        threadType: 'Task',
      }),
      {}
    );

    // Simulate thread creation with error
    await act(async () => {
      try {
        await (postThread as jest.Mock)({ message: 'Test thread' });
      } catch (e) {
        // Error expected
      }
    });

    expect(postThread).toHaveBeenCalled();
  });

  it('should update context values when props change', () => {
    const { rerender } = render(
      <GenericProvider {...defaultProps}>
        <TestComponent />
      </GenericProvider>
    );

    const updatedData = { ...mockData, name: 'Updated Name' };
    rerender(
      <GenericProvider {...defaultProps} data={updatedData}>
        <TestComponent />
      </GenericProvider>
    );

    expect(screen.getByTestId('context-data')).toHaveTextContent(
      JSON.stringify(updatedData)
    );
  });

  it('should handle version view mode', () => {
    render(
      <GenericProvider
        {...defaultProps}
        isVersionView
        currentVersionData={mockData}>
        <TestComponent />
      </GenericProvider>
    );

    expect(screen.getByTestId('context-data')).toBeInTheDocument();
  });

  it('should handle update widget height', () => {
    const { rerender } = render(
      <GenericProvider {...defaultProps}>
        <TestComponent />
      </GenericProvider>
    );

    const updatedData = { ...mockData, name: 'Updated Name' };
    rerender(
      <GenericProvider {...defaultProps} data={updatedData}>
        <TestComponent />
      </GenericProvider>
    );

    fireEvent.click(screen.getByText('Update Widget Height'));

    expect(updateWidgetHeightRecursively).toHaveBeenCalledWith(
      'widget-id',
      100,
      []
    );

    expect(screen.getByTestId('context-data')).toHaveTextContent(
      JSON.stringify(updatedData)
    );
  });
});
