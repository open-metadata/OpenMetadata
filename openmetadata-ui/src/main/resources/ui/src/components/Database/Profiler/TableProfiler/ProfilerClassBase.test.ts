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
import i18n from '../../../../utils/i18next/LocalUtil';
import { ProfilerTabPath } from '../ProfilerDashboard/profilerDashboard.interface';
import ColumnProfileTable from './ColumnProfileTable/ColumnProfileTable';
import IncidentsTab from './IncidentsTab/IncidentsTab.component';
import { ProfilerClassBase } from './ProfilerClassBase';
import { QualityTab } from './QualityTab/QualityTab.component';
import TableProfilerChart from './TableProfilerChart/TableProfilerChart';

describe('ProfilerClassBase', () => {
  let profilerClassBaseInstance: ProfilerClassBase;

  beforeEach(() => {
    profilerClassBaseInstance = new ProfilerClassBase();
  });

  describe('getProfilerTabs', () => {
    it('should return the correct profiler tabs', () => {
      const expectedTabs = {
        [ProfilerTabPath.DATA_QUALITY]: QualityTab,
        [ProfilerTabPath.COLUMN_PROFILE]: ColumnProfileTable,
        [ProfilerTabPath.TABLE_PROFILE]: TableProfilerChart,
        [ProfilerTabPath.INCIDENTS]: IncidentsTab,
      };

      const tabs = profilerClassBaseInstance.getProfilerTabs();

      expect(tabs).toEqual(expectedTabs);
    });
  });

  describe('getProfilerTabOptions', () => {
    it('should return the correct profiler tab options', () => {
      const expectedOptions = [
        {
          label: i18n.t('label.table-entity-text', {
            entityText: i18n.t('label.profile'),
          }),
          key: ProfilerTabPath.TABLE_PROFILE,
        },
        {
          label: i18n.t('label.column-entity', {
            entity: i18n.t('label.profile'),
          }),
          key: ProfilerTabPath.COLUMN_PROFILE,
        },
        {
          label: i18n.t('label.data-entity', {
            entity: i18n.t('label.quality'),
          }),
          key: ProfilerTabPath.DATA_QUALITY,
        },
        {
          label: i18n.t('label.incident-plural'),
          key: ProfilerTabPath.INCIDENTS,
        },
      ];

      const tabOptions = profilerClassBaseInstance.getProfilerTabOptions();

      expect(tabOptions).toEqual(expectedOptions);
    });
  });

  describe('getDefaultTabKey', () => {
    it('should return the default tab key when tour is open', () => {
      const isTourOpen = true;
      const expectedTabKey = ProfilerTabPath.COLUMN_PROFILE;

      const tabKey = profilerClassBaseInstance.getDefaultTabKey(isTourOpen);

      expect(tabKey).toEqual(expectedTabKey);
    });

    it('should return the default tab key when tour is not open', () => {
      const isTourOpen = false;
      const expectedTabKey = ProfilerTabPath.TABLE_PROFILE;

      const tabKey = profilerClassBaseInstance.getDefaultTabKey(isTourOpen);

      expect(tabKey).toEqual(expectedTabKey);
    });
  });
});
