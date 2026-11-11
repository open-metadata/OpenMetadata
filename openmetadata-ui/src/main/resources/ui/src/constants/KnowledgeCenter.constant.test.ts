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
import { EntityTabs } from '../enums/entity.enum';
import { isKnowledgePageFullWidthTab } from './KnowledgeCenter.constant';

describe('isKnowledgePageFullWidthTab', () => {
  it.each([EntityTabs.ACTIVITY_FEED, EntityTabs.CUSTOM_PROPERTIES])(
    'is true for the %s tab',
    (tab) => {
      expect(isKnowledgePageFullWidthTab(tab)).toBe(true);
    }
  );

  it.each([EntityTabs.OVERVIEW, undefined])('is false for %s', (tab) => {
    expect(isKnowledgePageFullWidthTab(tab)).toBe(false);
  });
});
