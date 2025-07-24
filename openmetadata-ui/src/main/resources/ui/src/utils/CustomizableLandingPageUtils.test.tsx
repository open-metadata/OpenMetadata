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
import {
  mockAddWidgetReturnValues,
  mockAddWidgetReturnValues2,
  mockCurrentAddWidget,
} from '../mocks/CustomizablePage.mock';
import { getAddWidgetHandler } from './CustomizableLandingPageUtils';

describe('getAddWidgetHandler function', () => {
  it('should add new widget at the bottom if not fit in the grid row', () => {
    const result = getAddWidgetHandler(
      mockWidget,
      'ExtraWidget.EmptyWidgetPlaceholder',
      1,
      3
    )(mockCurrentAddWidget);

    expect(result).toEqual(mockAddWidgetReturnValues);
  });

  it('should add new widget at the same line if new widget can fit', () => {
    const result = getAddWidgetHandler(
      mockWidget,
      'ExtraWidget.EmptyWidgetPlaceholder',
      1,
      3
    )([
      ...mockCurrentAddWidget,
      {
        h: 3,
        i: 'KnowledgePanel.dataAsset',
        w: 1,
        x: 0,
        y: 4,
        static: false,
      },
    ]);

    expect(result).toEqual(mockAddWidgetReturnValues2);
  });
});
