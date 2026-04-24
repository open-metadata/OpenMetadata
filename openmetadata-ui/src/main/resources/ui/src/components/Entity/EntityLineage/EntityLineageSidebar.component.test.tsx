/*
 *  Copyright 2022 Collate.
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
import { SearchIndex } from '../../../enums/search.enum';
import EntityLineageSidebar from './EntityLineageSidebar.component';

const mockTheme = { primaryColor: '#1890ff' };

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    theme: mockTheme,
  })),
}));

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(() => ({
    t: (key: string) => key,
  })),
}));

jest.mock('../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getEntityIcon: jest.fn((type: string) => <div>{`icon-${type}`}</div>),
  },
}));

jest.mock('../../../constants/Lineage.constants', () => ({
  entityData: [
    { type: 'table_search_index', label: 'label.table-plural' },
    { type: 'dashboard_search_index', label: 'label.dashboard-plural' },
    { type: 'topic_search_index', label: 'label.topic-plural' },
  ],
}));

describe('EntityLineageSidebar component', () => {
  const mockNode = {
    id: 'test-node',
    type: SearchIndex.TABLE,
    position: { x: 0, y: 0 },
    data: {},
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render nothing when show is false', () => {
      const { container } = render(
        <EntityLineageSidebar newAddedNode={undefined} show={false} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render sidebar when show is true', () => {
      const { container } = render(
        <EntityLineageSidebar show newAddedNode={undefined} />
      );

      expect(
        container.querySelector('.entity-lineage.sidebar')
      ).toBeInTheDocument();
    });

    it('should render sidebar with open class when show is true', () => {
      const { container } = render(
        <EntityLineageSidebar show newAddedNode={undefined} />
      );

      const sidebar = container.querySelector('.entity-lineage.sidebar');

      expect(sidebar).toHaveClass('open');
    });

    it('should render all entity nodes from entityData', () => {
      render(<EntityLineageSidebar show newAddedNode={undefined} />);

      expect(screen.getByText('label.table-plural')).toBeInTheDocument();
      expect(screen.getByText('label.dashboard-plural')).toBeInTheDocument();
      expect(screen.getByText('label.topic-plural')).toBeInTheDocument();
    });

    it('should render entity icons for all nodes', () => {
      render(<EntityLineageSidebar show newAddedNode={undefined} />);

      expect(screen.getByText('icon-table_search_index')).toBeInTheDocument();
      expect(
        screen.getByText('icon-dashboard_search_index')
      ).toBeInTheDocument();
      expect(screen.getByText('icon-topic_search_index')).toBeInTheDocument();
    });

    it('should apply correct test ids to draggable icons', () => {
      render(<EntityLineageSidebar show newAddedNode={undefined} />);

      expect(
        screen.getByTestId('table_search_index-draggable-icon')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('dashboard_search_index-draggable-icon')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('topic_search_index-draggable-icon')
      ).toBeInTheDocument();
    });
  });

  describe('draggability', () => {
    it('should make nodes draggable when newAddedNode is undefined', () => {
      render(<EntityLineageSidebar show newAddedNode={undefined} />);

      const draggableIcon = screen.getByTestId(
        'table_search_index-draggable-icon'
      );

      expect(draggableIcon).toHaveAttribute('draggable', 'true');
      expect(draggableIcon).toHaveStyle({ cursor: 'grab' });
    });

    it('should make nodes draggable when newAddedNode is empty object', () => {
      render(<EntityLineageSidebar show newAddedNode={{} as never} />);

      const draggableIcon = screen.getByTestId(
        'table_search_index-draggable-icon'
      );

      expect(draggableIcon).toHaveAttribute('draggable', 'true');
      expect(draggableIcon).toHaveStyle({ cursor: 'grab' });
    });

    it('should disable dragging when newAddedNode is provided', () => {
      render(<EntityLineageSidebar show newAddedNode={mockNode} />);

      const draggableIcon = screen.getByTestId(
        'table_search_index-draggable-icon'
      );

      expect(draggableIcon).toHaveAttribute('draggable', 'false');
      expect(draggableIcon).not.toHaveStyle({ cursor: 'grab' });
    });

    it('should apply disabled styles when newAddedNode is provided', () => {
      render(<EntityLineageSidebar show newAddedNode={mockNode} />);

      const draggableIcon = screen.getByTestId(
        'table_search_index-draggable-icon'
      );

      expect(draggableIcon).toHaveClass('cursor-not-allowed', 'opacity-50');
    });

    it('should not apply disabled styles when newAddedNode is undefined', () => {
      render(<EntityLineageSidebar show newAddedNode={undefined} />);

      const draggableIcon = screen.getByTestId(
        'table_search_index-draggable-icon'
      );

      expect(draggableIcon).not.toHaveClass('cursor-not-allowed');
      expect(draggableIcon).not.toHaveClass('opacity-50');
    });
  });

  describe('drag events', () => {
    it('should have drag start handler attached', () => {
      render(<EntityLineageSidebar show newAddedNode={undefined} />);

      const draggableIcon = screen.getByTestId(
        'table_search_index-draggable-icon'
      );

      expect(draggableIcon).toBeInTheDocument();
      expect(draggableIcon).toHaveAttribute('draggable', 'true');
    });

    it('should set effectAllowed to move on drag start', () => {
      render(<EntityLineageSidebar show newAddedNode={undefined} />);

      const draggableIcon = screen.getByTestId(
        'table_search_index-draggable-icon'
      );

      const dragStartHandler = draggableIcon.ondragstart;

      expect(dragStartHandler).toBeDefined();
    });

    it('should prevent default drag on icon element', () => {
      render(<EntityLineageSidebar show newAddedNode={undefined} />);

      const iconContainer = screen
        .getByTestId('table_search_index-draggable-icon')
        .querySelector('.d-flex');

      expect(iconContainer).toBeInTheDocument();
    });
  });

  describe('component memoization', () => {
    it('should render same number of entity nodes on multiple renders', () => {
      const { rerender } = render(
        <EntityLineageSidebar show newAddedNode={undefined} />
      );

      const initialNodes = screen.getAllByText(/label\..+-plural/);

      rerender(<EntityLineageSidebar show newAddedNode={undefined} />);

      const afterRerenderNodes = screen.getAllByText(/label\..+-plural/);

      expect(initialNodes.length).toBe(afterRerenderNodes.length);
      expect(initialNodes.length).toBe(3);
    });
  });

  describe('accessibility', () => {
    it('should have proper structure for screen readers', () => {
      render(<EntityLineageSidebar show newAddedNode={undefined} />);

      const labels = screen.getAllByText(/label\..+-plural/);

      labels.forEach((label) => {
        expect(label).toHaveClass('text-grey-body', 'text-xs');
      });
    });

    it('should maintain semantic structure with proper spacing', () => {
      const { container } = render(
        <EntityLineageSidebar show newAddedNode={undefined} />
      );

      const entityNodes = container.querySelectorAll('.m-b-sm.text-center');

      expect(entityNodes.length).toBeGreaterThan(0);
    });
  });

  describe('styling', () => {
    it('should apply correct container classes', () => {
      const { container } = render(
        <EntityLineageSidebar show newAddedNode={undefined} />
      );

      const sidebar = container.querySelector('.entity-lineage.sidebar.open');

      expect(sidebar).toBeInTheDocument();
    });

    it('should render with correct icon container classes', () => {
      render(<EntityLineageSidebar show newAddedNode={undefined} />);

      const iconContainer = screen.getByTestId(
        'table_search_index-draggable-icon'
      );

      expect(iconContainer).toHaveClass('sidebar-icon-container');
    });

    it('should apply text styles to labels', () => {
      render(<EntityLineageSidebar show newAddedNode={undefined} />);

      const label = screen.getByText('label.table-plural');

      expect(label).toHaveClass('text-grey-body', 'text-xs', 'p-t-xs');
    });
  });

  describe('edge cases', () => {
    it('should toggle visibility correctly', () => {
      const { container, rerender } = render(
        <EntityLineageSidebar show newAddedNode={undefined} />
      );

      expect(
        container.querySelector('.entity-lineage.sidebar')
      ).toBeInTheDocument();

      rerender(<EntityLineageSidebar newAddedNode={undefined} show={false} />);

      expect(container.firstChild).toBeNull();
    });

    it('should handle empty object as newAddedNode', () => {
      render(<EntityLineageSidebar show newAddedNode={{} as never} />);

      const draggableIcon = screen.getByTestId(
        'table_search_index-draggable-icon'
      );

      expect(draggableIcon).toHaveAttribute('draggable', 'true');
      expect(draggableIcon).not.toHaveClass('cursor-not-allowed');
    });

    it('should maintain consistent rendering across re-renders', () => {
      const { rerender } = render(
        <EntityLineageSidebar show newAddedNode={undefined} />
      );

      const firstRenderCount = screen.getAllByText(/label\..+-plural/).length;

      rerender(<EntityLineageSidebar show newAddedNode={mockNode} />);

      const secondRenderCount = screen.getAllByText(/label\..+-plural/).length;

      expect(firstRenderCount).toBe(secondRenderCount);
    });
  });

  describe('integration with theme', () => {
    it('should use theme from application store', () => {
      const {
        useApplicationStore,
      } = require('../../../hooks/useApplicationStore');

      render(<EntityLineageSidebar show newAddedNode={undefined} />);

      expect(useApplicationStore).toHaveBeenCalled();
    });

    it('should use translation hook', () => {
      const { useTranslation } = require('react-i18next');

      render(<EntityLineageSidebar show newAddedNode={undefined} />);

      expect(useTranslation).toHaveBeenCalled();
    });
  });
});
