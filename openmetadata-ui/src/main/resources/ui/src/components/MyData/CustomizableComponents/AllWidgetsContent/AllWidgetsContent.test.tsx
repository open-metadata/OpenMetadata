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
import { fireEvent, render, screen } from '@testing-library/react';
import { Document as DocStoreDocument } from '../../../../generated/entity/docStore/document';
import AllWidgetsContent from './AllWidgetsContent';

const NOT_SELECTED = 'not-selected';
const ACTIVITY_FEED_WIDGET = 'Activity Feed Widget';
const WIDGET_CARD_WIDGET_1 = 'widget-card-widget-1';
const SELECTED_WIDGET_1 = 'selected-widget-1';
const SELECTED_WIDGET_2 = 'selected-widget-2';
const SELECTED_WIDGET_3 = 'selected-widget-3';

// Mock WidgetCard component
jest.mock('../WidgetCard/WidgetCard', () => {
  return function MockWidgetCard({
    widget,
    isSelected,
    onSelectWidget,
  }: {
    widget: DocStoreDocument;
    isSelected: boolean;
    onSelectWidget?: (id: string) => void;
  }) {
    return (
      <div
        className={`widget-card ${isSelected ? 'selected' : ''}`}
        data-testid={`widget-card-${widget.id}`}
        role="presentation"
        onClick={() => onSelectWidget?.(widget.id ?? '')}>
        <span>{widget.name}</span>
        <span data-testid={`selected-${widget.id}`}>
          {isSelected ? 'selected' : NOT_SELECTED}
        </span>
      </div>
    );
  };
});

const mockWidgets: DocStoreDocument[] = [
  {
    id: 'widget-1',
    name: ACTIVITY_FEED_WIDGET,
    fullyQualifiedName: 'KnowledgePanel.ActivityFeed',
    description: 'Shows recent activity feed',
    entityType: 'KnowledgePanel',
    data: {},
  },
  {
    id: 'widget-2',
    name: 'Data Insights Widget',
    fullyQualifiedName: 'KnowledgePanel.DataInsights',
    description: 'Shows data insights',
    entityType: 'KnowledgePanel',
    data: {},
  },
  {
    id: 'widget-3',
    name: 'My Data Widget',
    fullyQualifiedName: 'KnowledgePanel.MyData',
    description: 'Shows my data',
    entityType: 'KnowledgePanel',
    data: {},
  },
];

const defaultProps = {
  widgets: mockWidgets,
  addedWidgetsList: [],
  selectedWidgets: [],
  onSelectWidget: jest.fn(),
};

describe('AllWidgetsContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all widgets', () => {
      render(<AllWidgetsContent {...defaultProps} />);

      expect(screen.getByTestId(WIDGET_CARD_WIDGET_1)).toBeInTheDocument();
      expect(screen.getByTestId('widget-card-widget-2')).toBeInTheDocument();
      expect(screen.getByTestId('widget-card-widget-3')).toBeInTheDocument();
    });

    it('should render widget names correctly', () => {
      render(<AllWidgetsContent {...defaultProps} />);

      expect(screen.getByText(ACTIVITY_FEED_WIDGET)).toBeInTheDocument();
      expect(screen.getByText('Data Insights Widget')).toBeInTheDocument();
      expect(screen.getByText('My Data Widget')).toBeInTheDocument();
    });

    it('should render empty list when no widgets provided', () => {
      render(<AllWidgetsContent {...defaultProps} widgets={[]} />);

      expect(screen.queryByTestId(/widget-card-/)).not.toBeInTheDocument();
    });

    it('should have correct data attributes for widget keys', () => {
      const { container } = render(<AllWidgetsContent {...defaultProps} />);

      const widget1Col = container.querySelector(
        '[data-widget-key="KnowledgePanel.ActivityFeed"]'
      );
      const widget2Col = container.querySelector(
        '[data-widget-key="KnowledgePanel.DataInsights"]'
      );
      const widget3Col = container.querySelector(
        '[data-widget-key="KnowledgePanel.MyData"]'
      );

      expect(widget1Col).toBeInTheDocument();
      expect(widget2Col).toBeInTheDocument();
      expect(widget3Col).toBeInTheDocument();
    });
  });

  describe('Widget Selection States', () => {
    it('should show widgets as not selected by default', () => {
      render(<AllWidgetsContent {...defaultProps} />);

      expect(screen.getByTestId(SELECTED_WIDGET_1)).toHaveTextContent(
        NOT_SELECTED
      );
      expect(screen.getByTestId(SELECTED_WIDGET_2)).toHaveTextContent(
        NOT_SELECTED
      );
      expect(screen.getByTestId(SELECTED_WIDGET_3)).toHaveTextContent(
        NOT_SELECTED
      );
    });

    it('should show widgets as selected when in selectedWidgets array', () => {
      const props = {
        ...defaultProps,
        selectedWidgets: ['widget-1', 'widget-3'],
      };

      render(<AllWidgetsContent {...props} />);

      expect(screen.getByTestId(SELECTED_WIDGET_1)).toHaveTextContent(
        'selected'
      );
      expect(screen.getByTestId(SELECTED_WIDGET_2)).toHaveTextContent(
        NOT_SELECTED
      );
      expect(screen.getByTestId(SELECTED_WIDGET_3)).toHaveTextContent(
        'selected'
      );
    });

    it('should show widgets as selected when already added (using fullyQualifiedName prefix)', () => {
      const props = {
        ...defaultProps,
        addedWidgetsList: [
          'KnowledgePanel.ActivityFeed-abc123',
          'KnowledgePanel.DataInsights-def456',
        ],
      };

      render(<AllWidgetsContent {...props} />);

      expect(screen.getByTestId(SELECTED_WIDGET_1)).toHaveTextContent(
        'selected'
      );
      expect(screen.getByTestId(SELECTED_WIDGET_2)).toHaveTextContent(
        'selected'
      );
      expect(screen.getByTestId(SELECTED_WIDGET_3)).toHaveTextContent(
        NOT_SELECTED
      );
    });

    it('should show widgets as selected when both already added and newly selected', () => {
      const props = {
        ...defaultProps,
        addedWidgetsList: ['KnowledgePanel.ActivityFeed-abc123'],
        selectedWidgets: ['widget-2'],
      };

      render(<AllWidgetsContent {...props} />);

      expect(screen.getByTestId(SELECTED_WIDGET_1)).toHaveTextContent(
        'selected'
      ); // already added
      expect(screen.getByTestId(SELECTED_WIDGET_2)).toHaveTextContent(
        'selected'
      ); // newly selected
      expect(screen.getByTestId(SELECTED_WIDGET_3)).toHaveTextContent(
        NOT_SELECTED
      );
    });

    it('should handle widgets with undefined id', () => {
      const widgetsWithUndefinedId = [
        {
          ...mockWidgets[0],
          id: undefined,
        },
      ];

      const props = {
        ...defaultProps,
        widgets: widgetsWithUndefinedId,
        selectedWidgets: ['widget-1'],
      };

      render(<AllWidgetsContent {...props} />);

      // Should not crash and should handle gracefully
      expect(screen.getByText(ACTIVITY_FEED_WIDGET)).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onSelectWidget when a widget is clicked', () => {
      const mockOnSelectWidget = jest.fn();
      const props = {
        ...defaultProps,
        onSelectWidget: mockOnSelectWidget,
      };

      render(<AllWidgetsContent {...props} />);

      fireEvent.click(screen.getByTestId(WIDGET_CARD_WIDGET_1));

      expect(mockOnSelectWidget).toHaveBeenCalledWith('widget-1');
      expect(mockOnSelectWidget).toHaveBeenCalledTimes(1);
    });

    it('should call onSelectWidget for multiple widget clicks', () => {
      const mockOnSelectWidget = jest.fn();
      const props = {
        ...defaultProps,
        onSelectWidget: mockOnSelectWidget,
      };

      render(<AllWidgetsContent {...props} />);

      fireEvent.click(screen.getByTestId(WIDGET_CARD_WIDGET_1));
      fireEvent.click(screen.getByTestId('widget-card-widget-2'));
      fireEvent.click(screen.getByTestId('widget-card-widget-3'));

      expect(mockOnSelectWidget).toHaveBeenCalledWith('widget-1');
      expect(mockOnSelectWidget).toHaveBeenCalledWith('widget-2');
      expect(mockOnSelectWidget).toHaveBeenCalledWith('widget-3');
      expect(mockOnSelectWidget).toHaveBeenCalledTimes(3);
    });

    it('should not crash when onSelectWidget is undefined', () => {
      const props = {
        ...defaultProps,
        onSelectWidget: undefined,
      };

      render(<AllWidgetsContent {...props} />);

      expect(() => {
        fireEvent.click(screen.getByTestId(WIDGET_CARD_WIDGET_1));
      }).not.toThrow();
    });
  });

  describe('Props Handling', () => {
    it('should handle undefined addedWidgetsList', () => {
      const props = {
        ...defaultProps,
        addedWidgetsList: undefined,
      };

      render(<AllWidgetsContent {...props} />);

      expect(screen.getByTestId(SELECTED_WIDGET_1)).toHaveTextContent(
        NOT_SELECTED
      );
      expect(screen.getByTestId(SELECTED_WIDGET_2)).toHaveTextContent(
        NOT_SELECTED
      );
      expect(screen.getByTestId(SELECTED_WIDGET_3)).toHaveTextContent(
        NOT_SELECTED
      );
    });

    it('should handle empty addedWidgetsList', () => {
      const props = {
        ...defaultProps,
        addedWidgetsList: [],
      };

      render(<AllWidgetsContent {...props} />);

      expect(screen.getByTestId(SELECTED_WIDGET_1)).toHaveTextContent(
        NOT_SELECTED
      );
      expect(screen.getByTestId(SELECTED_WIDGET_2)).toHaveTextContent(
        NOT_SELECTED
      );
      expect(screen.getByTestId(SELECTED_WIDGET_3)).toHaveTextContent(
        NOT_SELECTED
      );
    });

    it('should handle empty selectedWidgets', () => {
      const props = {
        ...defaultProps,
        selectedWidgets: [],
      };

      render(<AllWidgetsContent {...props} />);

      expect(screen.getByTestId(SELECTED_WIDGET_1)).toHaveTextContent(
        NOT_SELECTED
      );
      expect(screen.getByTestId(SELECTED_WIDGET_2)).toHaveTextContent(
        NOT_SELECTED
      );
      expect(screen.getByTestId(SELECTED_WIDGET_3)).toHaveTextContent(
        NOT_SELECTED
      );
    });
  });

  describe('Layout and Structure', () => {
    it('should render widgets in correct grid structure', () => {
      const { container } = render(<AllWidgetsContent {...defaultProps} />);

      const row = container.querySelector('.all-widgets-grid');
      const cols = container.querySelectorAll('.ant-col');

      expect(row).toBeInTheDocument();
      expect(row).toHaveClass('p-r-xs', 'overflow-y-auto');
      expect(cols).toHaveLength(3); // One for each widget
    });

    it('should pass ref correctly', () => {
      const ref = { current: null };
      render(<AllWidgetsContent {...defaultProps} ref={ref} />);

      expect(ref.current).toBeTruthy();
    });
  });
});
