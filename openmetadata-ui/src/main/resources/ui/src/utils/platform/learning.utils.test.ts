/*
 *  Copyright 2026 Collate.
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

import { ResourceType } from '../../generated/entity/learning/learningResource';
import {
  getDurationUnitLabelKey,
  opensInNewTab,
  openUrlInNewTab,
} from './learning.utils';

describe('learning.utils', () => {
  describe('opensInNewTab', () => {
    it('should open Link resources in a new tab', () => {
      expect(opensInNewTab(ResourceType.Link)).toBe(true);
    });

    it.each([
      ResourceType.PDF,
      ResourceType.Video,
      ResourceType.Storylane,
      ResourceType.Article,
    ])('should play %s resources in the resource player', (resourceType) => {
      expect(opensInNewTab(resourceType)).toBe(false);
    });
  });

  describe('getDurationUnitLabelKey', () => {
    it.each([ResourceType.Article, ResourceType.Link, ResourceType.PDF])(
      'should describe %s duration as reading time',
      (resourceType) => {
        expect(getDurationUnitLabelKey(resourceType)).toBe('label.min-read');
      }
    );

    it.each([ResourceType.Video, ResourceType.Storylane])(
      'should describe %s duration as watching time',
      (resourceType) => {
        expect(getDurationUnitLabelKey(resourceType)).toBe('label.min-watch');
      }
    );
  });

  describe('openUrlInNewTab', () => {
    let openSpy: jest.SpyInstance;

    beforeEach(() => {
      openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    });

    afterEach(() => {
      openSpy.mockRestore();
    });

    it('should open a web URL in a new tab without exposing the opener', () => {
      openUrlInNewTab('https://sharepoint.example.com/sites/guide');

      expect(openSpy).toHaveBeenCalledWith(
        'https://sharepoint.example.com/sites/guide',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it.each([
      'javascript:alert(1)',
      ' javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      '/relative/guide.pdf',
    ])('should not open non-web URL %p', (url) => {
      openUrlInNewTab(url);

      expect(openSpy).not.toHaveBeenCalled();
    });
  });
});
