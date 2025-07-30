/*
 *  Copyright 2024 Collate.
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
import { mockWidget } from '../mocks/AddWidgetTabContent.mock';
import { mockCurrentAddWidget } from '../mocks/CustomizablePage.mock';
import {
  getAddWidgetHandler,
  getLandingPageLayoutWithEmptyWidgetPlaceholder,
  getLayoutUpdateHandler,
  getLayoutWithEmptyWidgetPlaceholder,
  getNewWidgetPlacement,
  getRemoveWidgetHandler,
  getUniqueFilteredLayout,
  getWidgetWidthLabelFromKey,
} from './CustomizableLandingPageUtils';

describe('CustomizableLandingPageUtils', () => {
  describe('getNewWidgetPlacement', () => {
    it('should place widget in same row if space available', () => {
      const currentLayout = [
        { w: 1, h: 3, x: 0, y: 0, i: 'widget1', static: false },
        { w: 1, h: 3, x: 1, y: 0, i: 'widget2', static: false },
      ];

      const result = getNewWidgetPlacement(currentLayout, 1);

      expect(result).toEqual({ x: 2, y: 0 });
    });

    it('should place widget in next row if no space in current row', () => {
      const currentLayout = [
        { w: 1, h: 3, x: 0, y: 0, i: 'widget1', static: false },
        { w: 1, h: 3, x: 1, y: 0, i: 'widget2', static: false },
        { w: 1, h: 3, x: 2, y: 0, i: 'widget3', static: false },
      ];

      const result = getNewWidgetPlacement(currentLayout, 1);

      expect(result).toEqual({ x: 0, y: 1 });
    });

    it('should handle empty layout', () => {
      const result = getNewWidgetPlacement([], 1);

      expect(result).toEqual({ x: 0, y: 0 });
    });
  });

  describe('getAddWidgetHandler', () => {
    it('should handle empty layout', () => {
      const result = getAddWidgetHandler(
        mockWidget,
        'ExtraWidget.EmptyWidgetPlaceholder',
        1,
        3
      )([]);

      expect(result).toHaveLength(2);
      expect(result[0].i).toContain('KnowledgePanel.Following');
      expect(result[1].i).toBe('ExtraWidget.EmptyWidgetPlaceholder');
    });

    it('should handle null widget data', () => {
      const result = getAddWidgetHandler(
        null as any,
        'ExtraWidget.EmptyWidgetPlaceholder',
        1,
        3
      )(mockCurrentAddWidget);

      expect(result).toHaveLength(1);
      expect(result[0].i).toBe('ExtraWidget.EmptyWidgetPlaceholder');
    });

    it('should replace placeholder with new widget', () => {
      const result = getAddWidgetHandler(
        mockWidget,
        'ExtraWidget.EmptyWidgetPlaceholder',
        1,
        3
      )(mockCurrentAddWidget);

      expect(result).toHaveLength(4);
      expect(result[0].i).toBe('KnowledgePanel.ActivityFeed');
      expect(result[1].i).toBe('KnowledgePanel.Following-2');
      expect(result[2].i).toBe('KnowledgePanel.RecentlyViewed');
      expect(result[3].i).toBe('ExtraWidget.EmptyWidgetPlaceholder');
    });
  });

  describe('getLayoutUpdateHandler', () => {
    it('should handle empty updated layout', () => {
      const result = getLayoutUpdateHandler([])(mockCurrentAddWidget);

      expect(result).toHaveLength(1);
      expect(result[0].i).toBe('ExtraWidget.EmptyWidgetPlaceholder');
    });

    it('should preserve widget properties during update', () => {
      const currentLayout = [
        { w: 2, h: 3, x: 0, y: 0, i: 'widget1', static: false },
      ];

      const updatedLayout = [
        { w: 2, h: 3, x: 1, y: 0, i: 'widget1', static: false },
      ];

      const result = getLayoutUpdateHandler(updatedLayout)(currentLayout);

      expect(result).toHaveLength(2); // widget + placeholder
      expect(result[0].w).toBe(2);
      expect(result[0].h).toBe(3);
    });

    it('should handle layout with placeholder widgets', () => {
      const currentLayout = [
        { w: 1, h: 3, x: 0, y: 0, i: 'widget1', static: false },
        {
          w: 1,
          h: 3,
          x: 0,
          y: 3,
          i: 'ExtraWidget.EmptyWidgetPlaceholder',
          static: false,
        },
      ];

      const updatedLayout = [
        { w: 1, h: 3, x: 1, y: 0, i: 'widget1', static: false },
        {
          w: 1,
          h: 3,
          x: 0,
          y: 3,
          i: 'ExtraWidget.EmptyWidgetPlaceholder',
          static: false,
        },
      ];

      const result = getLayoutUpdateHandler(updatedLayout)(currentLayout);

      expect(result).toHaveLength(2);
      expect(result[0].i).toBe('widget1');
      expect(result[1].i).toBe('ExtraWidget.EmptyWidgetPlaceholder');
    });
  });

  describe('getRemoveWidgetHandler', () => {
    it('should remove specified widget from layout', () => {
      const currentLayout = [
        { w: 1, h: 3, x: 0, y: 0, i: 'widget1', static: false },
        { w: 1, h: 3, x: 1, y: 0, i: 'widget2', static: false },
      ];

      const result = getRemoveWidgetHandler('widget1')(currentLayout);

      expect(result).toHaveLength(2); // 1 widget + placeholder
      expect(result[0].i).toBe('widget2');
    });

    it('should handle empty layout', () => {
      const result = getRemoveWidgetHandler('widget1')([]);

      expect(result).toHaveLength(1);
      expect(result[0].i).toBe('ExtraWidget.EmptyWidgetPlaceholder');
    });
  });

  describe('getWidgetWidthLabelFromKey', () => {
    it('should return correct label for large size', () => {
      const result = getWidgetWidthLabelFromKey('large');

      expect(result).toBe('label.large');
    });

    it('should return correct label for medium size', () => {
      const result = getWidgetWidthLabelFromKey('medium');

      expect(result).toBe('label.medium');
    });

    it('should return correct label for small size', () => {
      const result = getWidgetWidthLabelFromKey('small');

      expect(result).toBe('label.small');
    });
  });

  describe('getUniqueFilteredLayout', () => {
    it('should filter out non-knowledge panel widgets', () => {
      const layout = [
        { w: 1, h: 3, x: 0, y: 0, i: 'KnowledgePanel.widget1', static: false },
        { w: 1, h: 3, x: 1, y: 0, i: 'OtherWidget.widget2', static: false },
        { w: 1, h: 3, x: 2, y: 0, i: 'KnowledgePanel.widget3', static: false },
      ];

      const result = getUniqueFilteredLayout(layout);

      expect(result).toHaveLength(2);
      expect(result[0].i).toBe('KnowledgePanel.widget1');
      expect(result[1].i).toBe('KnowledgePanel.widget3');
    });

    it('should remove duplicate widgets', () => {
      const layout = [
        { w: 1, h: 3, x: 0, y: 0, i: 'KnowledgePanel.widget1', static: false },
        { w: 1, h: 3, x: 1, y: 0, i: 'KnowledgePanel.widget1', static: false },
      ];

      const result = getUniqueFilteredLayout(layout);

      expect(result).toHaveLength(1);
      expect(result[0].i).toBe('KnowledgePanel.widget1');
    });
  });

  describe('getLayoutWithEmptyWidgetPlaceholder', () => {
    it('should add placeholder to empty layout', () => {
      const result = getLayoutWithEmptyWidgetPlaceholder([]);

      expect(result).toHaveLength(1);
      expect(result[0].i).toBe('ExtraWidget.EmptyWidgetPlaceholder');
      expect(result[0].h).toBe(4);
    });

    it('should add placeholder to existing layout', () => {
      const layout = [{ w: 1, h: 3, x: 0, y: 0, i: 'widget1', static: false }];

      const result = getLayoutWithEmptyWidgetPlaceholder(layout);

      expect(result).toHaveLength(2);
      expect(result[1].i).toBe('ExtraWidget.EmptyWidgetPlaceholder');
    });
  });

  describe('getLandingPageLayoutWithEmptyWidgetPlaceholder', () => {
    it('should add placeholder to empty layout', () => {
      const result = getLandingPageLayoutWithEmptyWidgetPlaceholder([]);

      expect(result).toHaveLength(1);
      expect(result[0].i).toBe('ExtraWidget.EmptyWidgetPlaceholder');
      expect(result[0].h).toBe(3);
    });

    it('should add placeholder to existing layout', () => {
      const layout = [{ w: 1, h: 3, x: 0, y: 0, i: 'widget1', static: false }];

      const result = getLandingPageLayoutWithEmptyWidgetPlaceholder(layout);

      expect(result).toHaveLength(2);
      expect(result[1].i).toBe('ExtraWidget.EmptyWidgetPlaceholder');
    });
  });
});
