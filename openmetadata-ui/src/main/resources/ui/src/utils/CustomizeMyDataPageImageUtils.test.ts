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

import {
  getMyDataWidgetImageFromKey,
  MY_DATA_WIDGET_IMAGE_KEYS,
} from './CustomizeMyDataPageImageUtils';
import { MY_DATA_WIDGET_KEYS } from './CustomizeMyDataPageWidgetUtils';

describe('the landing-page widget previews', () => {
  // A key with no entry is not an error — it resolves to '' and the picker
  // paints an empty tile — so a widget added without a screenshot, or a
  // mistyped key, goes unnoticed until someone opens the modal. Asserting
  // against the widget registry is what makes it loud.
  it('covers every widget the picker can offer', () => {
    const missing = MY_DATA_WIDGET_KEYS.filter(
      (widgetKey) => !MY_DATA_WIDGET_IMAGE_KEYS.includes(widgetKey)
    );

    expect(missing).toEqual([]);
  });

  it('names each key once', () => {
    expect(new Set(MY_DATA_WIDGET_IMAGE_KEYS).size).toBe(
      MY_DATA_WIDGET_IMAGE_KEYS.length
    );
  });

  // WidgetCard branches on the empty string to render a placeholder instead of
  // an <img> whose empty src would resolve against the page URL.
  it('resolves an unknown key to an empty string', () => {
    expect(getMyDataWidgetImageFromKey('nonsense')).toBe('');
  });
});
