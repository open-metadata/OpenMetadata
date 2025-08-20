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
import ColumnProfileIcon from '../../../../assets/svg/column-profile.svg?react';
import DataQualityIcon from '../../../../assets/svg/data-quality.svg?react';
import IncidentIcon from '../../../../assets/svg/ic-incident-manager.svg?react';
import TableProfilerIcon from '../../../../assets/svg/table-profile.svg?react';
import { TableProfilerTab } from '../ProfilerDashboard/profilerDashboard.interface';
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
        [TableProfilerTab.DATA_QUALITY]: QualityTab,
        [TableProfilerTab.COLUMN_PROFILE]: ColumnProfileTable,
        [TableProfilerTab.TABLE_PROFILE]: TableProfilerChart,
        [TableProfilerTab.INCIDENTS]: IncidentsTab,
      };

      const tabs = profilerClassBaseInstance.getProfilerTabs();

      expect(tabs).toEqual(expectedTabs);
    });
  });

  describe('getProfilerTabOptions', () => {
    it('should return the correct profiler tab options', () => {
      const expectedOptions = [
        {
          label: 'label.table-entity-text',
          key: TableProfilerTab.TABLE_PROFILE,
          icon: TableProfilerIcon,
        },
        {
          label: 'label.column-entity',
          key: TableProfilerTab.COLUMN_PROFILE,
          icon: ColumnProfileIcon,
        },
        {
          label: 'label.data-entity',
          key: TableProfilerTab.DATA_QUALITY,
          icon: DataQualityIcon,
        },
        {
          label: 'label.incident-plural',
          key: TableProfilerTab.INCIDENTS,
          icon: IncidentIcon,
        },
      ];

      const tabOptions = profilerClassBaseInstance.getProfilerTabOptions();

      expect(tabOptions).toEqual(expectedOptions);
    });
  });

  describe('getDefaultTabKey', () => {
    it('should return the default tab key when tour is open', () => {
      const isTourOpen = true;
      const expectedTabKey = TableProfilerTab.COLUMN_PROFILE;

      const tabKey = profilerClassBaseInstance.getDefaultTabKey(isTourOpen);

      expect(tabKey).toEqual(expectedTabKey);
    });

    it('should return the default tab key when tour is not open', () => {
      const isTourOpen = false;
      const expectedTabKey = TableProfilerTab.TABLE_PROFILE;

      const tabKey = profilerClassBaseInstance.getDefaultTabKey(isTourOpen);

      expect(tabKey).toEqual(expectedTabKey);
    });
  });
});
