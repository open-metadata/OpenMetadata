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
import WidgetCard from './WidgetCard';

const WIDGET_TEST_1 = 'widget-test-1';
const KNOWLEDGEPANEL_TESTWIDGET = 'KnowledgePanel.TestWidget';
const THIS_IS_A_TEST_WIDGET_DESCRIPTION = 'This is a test widget description';
const WIDGET_DESCRIPTION = 'widget-description';

const mockWidget: DocStoreDocument = {
  id: WIDGET_TEST_1,
  name: 'Test Widget',
  fullyQualifiedName: KNOWLEDGEPANEL_TESTWIDGET,
  description: THIS_IS_A_TEST_WIDGET_DESCRIPTION,
  entityType: 'KnowledgePanel',
  data: {},
};

const mockWidgetWithoutDescription: DocStoreDocument = {
  id: 'widget-test-2',
  name: 'Widget Without Description',
  fullyQualifiedName: 'KnowledgePanel.NoDesc',
  description: undefined,
  entityType: 'KnowledgePanel',
  data: {},
};

const mockWidgetWithoutId: DocStoreDocument = {
  id: undefined,
  name: 'Widget Without ID',
  fullyQualifiedName: 'KnowledgePanel.NoId',
  description: 'Widget without ID',
  entityType: 'KnowledgePanel',
  data: {},
};

jest.mock('../../../../utils/CustomizeMyDataPageClassBase', () => ({
  __esModule: true,
  default: {
    getWidgetImageFromKey: jest.fn().mockImplementation(() => ''),
  },
}));

describe('WidgetCard', () => {
  const mockOnSelectWidget = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render widget card with basic information', () => {
      render(
        <WidgetCard
          isSelected={false}
          widget={mockWidget}
          onSelectWidget={mockOnSelectWidget}
        />
      );

      expect(screen.getByTestId(KNOWLEDGEPANEL_TESTWIDGET)).toBeInTheDocument();
      expect(screen.getByText('Test Widget')).toBeInTheDocument();
      expect(
        screen.getByText(THIS_IS_A_TEST_WIDGET_DESCRIPTION)
      ).toBeInTheDocument();
    });

    it('should render widget description', () => {
      render(
        <WidgetCard
          isSelected={false}
          widget={mockWidget}
          onSelectWidget={mockOnSelectWidget}
        />
      );

      const description = screen.getByTestId(WIDGET_DESCRIPTION);

      expect(description).toHaveTextContent(THIS_IS_A_TEST_WIDGET_DESCRIPTION);
    });

    it('should render default description when description is undefined', () => {
      render(
        <WidgetCard
          isSelected={false}
          widget={mockWidgetWithoutDescription}
          onSelectWidget={mockOnSelectWidget}
        />
      );

      const description = screen.getByTestId(WIDGET_DESCRIPTION);

      expect(description).toHaveTextContent('message.no-description-available');
    });

    it('should render widget card content structure correctly', () => {
      const { container } = render(
        <WidgetCard
          isSelected={false}
          widget={mockWidget}
          onSelectWidget={mockOnSelectWidget}
        />
      );

      expect(screen.getByTestId(KNOWLEDGEPANEL_TESTWIDGET)).toBeInTheDocument();

      expect(screen.getByTestId(WIDGET_DESCRIPTION)).toBeInTheDocument();

      const contentDiv = container.querySelector('.widget-card-content');

      expect(contentDiv).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onSelectWidget with widget id when card is clicked', () => {
      render(
        <WidgetCard
          isSelected={false}
          widget={mockWidget}
          onSelectWidget={mockOnSelectWidget}
        />
      );

      fireEvent.click(screen.getByTestId(KNOWLEDGEPANEL_TESTWIDGET));

      expect(mockOnSelectWidget).toHaveBeenCalledWith(WIDGET_TEST_1);
      expect(mockOnSelectWidget).toHaveBeenCalledTimes(1);
    });

    it('should call onSelectWidget with empty string when widget id is undefined', () => {
      render(
        <WidgetCard
          isSelected={false}
          widget={mockWidgetWithoutId}
          onSelectWidget={mockOnSelectWidget}
        />
      );

      fireEvent.click(screen.getByTestId('KnowledgePanel.NoId'));

      expect(mockOnSelectWidget).toHaveBeenCalledWith('');
      expect(mockOnSelectWidget).toHaveBeenCalledTimes(1);
    });

    it('should not crash when onSelectWidget is undefined', () => {
      render(
        <WidgetCard
          isSelected={false}
          widget={mockWidget}
          onSelectWidget={undefined}
        />
      );

      expect(() => {
        fireEvent.click(screen.getByTestId(KNOWLEDGEPANEL_TESTWIDGET));
      }).not.toThrow();
    });

    it('should handle multiple clicks correctly', () => {
      render(
        <WidgetCard
          isSelected={false}
          widget={mockWidget}
          onSelectWidget={mockOnSelectWidget}
        />
      );

      const card = screen.getByTestId(KNOWLEDGEPANEL_TESTWIDGET);

      fireEvent.click(card);
      fireEvent.click(card);
      fireEvent.click(card);

      expect(mockOnSelectWidget).toHaveBeenCalledWith(WIDGET_TEST_1);
      expect(mockOnSelectWidget).toHaveBeenCalledTimes(3);
    });
  });
});
