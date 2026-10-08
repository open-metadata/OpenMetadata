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

jest.mock(
  '../assets/img/service-icon-clickzetta.svg',
  () => 'clickzetta-icon',
  { virtual: true }
);

import rill from '../assets/svg/service-icon-rill.svg';
import { getServiceIcon, getServiceLogoThemeClass } from './ServiceIconUtils';

describe('ServiceIconUtils', () => {
  it('resolves the Clickzetta service icon case-insensitively', () => {
    expect(getServiceIcon('Clickzetta')).toBe('clickzetta-icon');
  });

  it('should return the Rill service icon', () => {
    expect(getServiceIcon('Rill')).toBe(rill);
  });
});

describe('service logo dark theme', () => {
  it.each(['PowerBI', 'power-bi', 'POWER_BI', 'Kafka', 'KafkaConnect'])(
    'makes monochrome %s artwork legible only in dark mode',
    (serviceType) => {
      expect(
        getServiceLogoThemeClass(serviceType)
          .split(' ')
          .every((value) => value.startsWith('tw:dark:'))
      ).toBe(true);
      expect(getServiceLogoThemeClass(serviceType)).toContain('tw:dark:invert');
    }
  );

  it.each(['BigQuery', 'Snowflake', 'Superset', '', undefined])(
    'preserves the original artwork for %s',
    (serviceType) => {
      expect(getServiceLogoThemeClass(serviceType)).toBe('');
    }
  );
});
