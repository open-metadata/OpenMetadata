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
const { getIconAndClassName } =
  jest.requireActual<typeof import('./ToastUtils')>('./ToastUtils');

describe('getIconAndClassName', () => {
  it.each([
    ['info', 'info', 'info'],
    ['grey-info', 'grey-info', 'info'],
    ['success', 'success', 'success'],
    ['warning', 'warning', 'warning'],
    ['error', 'error', 'error'],
  ] as const)(
    'maps %s alerts to their className and toast type',
    (alertType, className, toastType) => {
      expect(getIconAndClassName(alertType)).toMatchObject({
        className,
        type: toastType,
      });
    }
  );

  it('shares one icon across info variants and uses a distinct icon per severity', () => {
    const icons = (
      ['info', 'grey-info', 'success', 'warning', 'error'] as const
    ).map((alertType) => getIconAndClassName(alertType).icon);

    expect(getIconAndClassName('info').icon).toBe(
      getIconAndClassName('grey-info').icon
    );
    expect(new Set(icons).size).toBe(4);
  });
});
