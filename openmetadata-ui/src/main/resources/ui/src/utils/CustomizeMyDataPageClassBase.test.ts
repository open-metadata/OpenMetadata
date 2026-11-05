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

import { LANDING_PAGE_DEFAULT_WIDGET_HEIGHT } from '../constants/CustomizeMyDataPage.constants';
import { LandingPageWidgetKeys } from '../enums/CustomizablePage.enum';
import customizeMyDataPageClassBase from './CustomizeMyDataPageClassBase';
import {
  isAvailableMyDataWidgetKey,
  MY_DATA_WIDGET_KEYS,
} from './CustomizeMyDataPageWidgetUtils';

describe('CustomizeMyDataPageClassBase', () => {
  // `MyTask` and `TotalAssets` were retired and excluded, then reused for the
  // My tasks and Total data assets cards. Exclusion matches by prefix, so a
  // stale entry would hide the cards that replaced them from the picker.
  it('excludes nothing the registry renders', () => {
    const excluded = customizeMyDataPageClassBase.getExcludedWidgetFqns();

    expect(
      MY_DATA_WIDGET_KEYS.filter(
        (key) => !isAvailableMyDataWidgetKey(key, excluded)
      )
    ).toEqual([]);
  });

  it('still excludes the widgets that stayed retired', () => {
    expect(customizeMyDataPageClassBase.getExcludedWidgetFqns()).toEqual(
      expect.arrayContaining([
        LandingPageWidgetKeys.MY_DATA,
        LandingPageWidgetKeys.FOLLOWING,
        LandingPageWidgetKeys.DATA_ASSETS,
      ])
    );
  });

  it.each(['TotalAssets', 'MyTask', 'PipelineStatus'])(
    'sizes the %s panel like the other topic cards',
    (name) => {
      expect(customizeMyDataPageClassBase.getWidgetHeight(name)).toBe(
        LANDING_PAGE_DEFAULT_WIDGET_HEIGHT
      );
    }
  );

  // OSS has no pipeline overview page; the card falls back to Explore.
  it('names no pipeline page of its own', () => {
    expect(
      customizeMyDataPageClassBase.getPipelineStatusActionPath()
    ).toBeUndefined();
  });
});
