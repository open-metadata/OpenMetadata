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
import type { CommonWidgetType } from '../../constants/CustomizeWidgets.constants';
import { LandingPageWidgetKeys } from '../../enums/CustomizablePage.enum';
import { WidgetWidths } from '../../enums/CustomizeDetailPage.enum';
import { PageType } from '../../generated/system/ui/page';
import { getAddWidgetHandler } from './CustomizePageWidgetUtils';

jest.mock('./CustomizePageDispatchUtils', () => ({
  getDefaultWidgetForTab: jest.fn(),
  getWidgetHeight: jest.fn().mockReturnValue(2),
}));

const descriptionWidget = {
  fullyQualifiedName: 'KnowledgePanel.Description',
  name: 'Description',
  data: { gridSizes: ['small', 'large'] },
} as CommonWidgetType;

const addDescription = (width: number, placeholderKey: string) =>
  getAddWidgetHandler(
    descriptionWidget,
    placeholderKey,
    width,
    PageType.Table
  )([
    {
      i: LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    },
  ]).at(-1);

describe('getAddWidgetHandler', () => {
  it('records the picked large size on the new widget', () => {
    expect(
      addDescription(
        WidgetWidths.large,
        LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER
      )?.config
    ).toEqual({ size: 'large' });
  });

  it('records the picked small size on the new widget', () => {
    expect(addDescription(WidgetWidths.small, 'other-widget')?.config).toEqual({
      size: 'small',
    });
  });
});
