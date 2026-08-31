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
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  InfoCircle,
} from '@untitledui/icons';

const { getIconAndClassName } =
  jest.requireActual<typeof import('./ToastUtils')>('./ToastUtils');

describe('getIconAndClassName', () => {
  it.each([
    ['info', InfoCircle, 'info', 'info'],
    ['grey-info', InfoCircle, 'grey-info', 'info'],
    ['success', CheckCircle, 'success', 'success'],
    ['warning', AlertTriangle, 'warning', 'warning'],
    ['error', AlertCircle, 'error', 'error'],
  ] as const)(
    'uses the Untitled icon for %s alerts',
    (alertType, icon, className, toastType) => {
      expect(getIconAndClassName(alertType)).toEqual({
        icon,
        className,
        type: toastType,
      });
    }
  );
});
