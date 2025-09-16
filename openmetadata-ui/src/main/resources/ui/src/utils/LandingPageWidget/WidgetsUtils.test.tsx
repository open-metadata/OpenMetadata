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
import { ActivityFeedTabs } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import {
  ACTIVITY_FEED_FILTER_LIST,
  TASK_FEED_FILTER_LIST,
} from '../../constants/Widgets.constant';
import { FeedFilter } from '../../enums/mydata.enum';
import i18n from '../i18next/LocalUtil';
import { getFeedFilterWidgets, getVisiblePopupContainer } from './WidgetsUtils';

describe('Widgets Utils', () => {
  describe('getFeedFilterWidgets', () => {
    it('should return list for Feed Filters', () => {
      const response = getFeedFilterWidgets(ActivityFeedTabs.ALL);

      expect(response).toEqual([
        {
          title: i18n.t('label.all'),
          key: FeedFilter.OWNER_OR_FOLLOWS,
          description: i18n.t('message.feed-filter-all'),
        },
        ...ACTIVITY_FEED_FILTER_LIST,
      ]);
    });

    it('should return list for Feed Filters for Admin', () => {
      const response = getFeedFilterWidgets(ActivityFeedTabs.ALL, true);

      expect(response).toEqual([
        {
          title: i18n.t('label.all'),
          key: FeedFilter.ALL,
          description: i18n.t('message.feed-filter-all'),
        },
        ...ACTIVITY_FEED_FILTER_LIST,
      ]);
    });

    it('should return list for Task Filters', () => {
      const response = getFeedFilterWidgets(ActivityFeedTabs.TASKS);

      expect(response).toEqual(TASK_FEED_FILTER_LIST);
    });
  });

  describe('getVisiblePopupContainer', () => {
    let mockBody: HTMLElement;
    let mockParentElement: HTMLElement;

    beforeEach(() => {
      // Mock document.body
      mockBody = {
        scrollHeight: 1000,
        clientHeight: 800,
      } as HTMLElement;

      // Mock document.body property
      Object.defineProperty(document, 'body', {
        value: mockBody,
        writable: true,
      });

      mockParentElement = {
        scrollHeight: 800,
        clientHeight: 500,
        parentElement: mockBody,
      } as HTMLElement;

      // Mock window.getComputedStyle
      Object.defineProperty(window, 'getComputedStyle', {
        value: jest.fn(),
        writable: true,
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should return document.body when no trigger is provided', () => {
      expect(getVisiblePopupContainer()).toBe(mockBody);
    });

    it('should find suitable container with auto overflow', () => {
      const mockGetComputedStyle = window.getComputedStyle as jest.Mock;

      // Set up element hierarchy for this test
      const testElement = {
        scrollHeight: 500,
        clientHeight: 400,
        parentElement: mockParentElement,
      } as HTMLElement;

      mockGetComputedStyle
        .mockReturnValueOnce({ overflow: 'visible', overflowY: 'visible' }) // testElement
        .mockReturnValueOnce({ overflow: 'auto', overflowY: 'auto' }); // mockParentElement

      expect(getVisiblePopupContainer(testElement)).toBe(mockParentElement);
    });

    it('should fallback to document.body when no suitable container found', () => {
      const mockGetComputedStyle = window.getComputedStyle as jest.Mock;

      // Set up element hierarchy for this test
      const testElement = {
        scrollHeight: 500,
        clientHeight: 400,
        parentElement: mockParentElement,
      } as HTMLElement;

      mockGetComputedStyle
        .mockReturnValueOnce({ overflow: 'visible', overflowY: 'visible' }) // testElement
        .mockReturnValueOnce({ overflow: 'visible', overflowY: 'visible' }); // mockParentElement

      expect(getVisiblePopupContainer(testElement)).toBe(mockBody);
    });

    it('should not return container with hidden overflow', () => {
      const mockGetComputedStyle = window.getComputedStyle as jest.Mock;

      // Set up element hierarchy for this test
      const testElement = {
        scrollHeight: 500,
        clientHeight: 400,
        parentElement: mockParentElement,
      } as HTMLElement;

      mockGetComputedStyle
        .mockReturnValueOnce({ overflow: 'visible', overflowY: 'visible' }) // testElement
        .mockReturnValueOnce({ overflow: 'hidden', overflowY: 'hidden' }); // mockParentElement

      expect(getVisiblePopupContainer(testElement)).toBe(mockBody);
    });

    it('should handle null parentElement', () => {
      const mockGetComputedStyle = window.getComputedStyle as jest.Mock;

      const elementWithNullParent = {
        scrollHeight: 500,
        clientHeight: 400,
        parentElement: null,
      } as HTMLElement;

      mockGetComputedStyle.mockReturnValue({
        overflow: 'visible',
        overflowY: 'visible',
      });

      expect(getVisiblePopupContainer(elementWithNullParent)).toBe(mockBody);
    });
  });
});
