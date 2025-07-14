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
import { ReactComponent as ColumnProfileIcon } from '../../../../assets/svg/column-profile.svg';
import { ReactComponent as DataQualityIcon } from '../../../../assets/svg/data-quality.svg';
import { ReactComponent as IncidentIcon } from '../../../../assets/svg/incident-icon.svg';
import { ReactComponent as TableProfileIcon } from '../../../../assets/svg/table-profile.svg';
import i18n from '../../../../utils/i18next/LocalUtil';
import { TableProfilerTab } from '../ProfilerDashboard/profilerDashboard.interface';
import ColumnProfileTable from './ColumnProfileTable/ColumnProfileTable';
import IncidentsTab from './IncidentsTab/IncidentsTab.component';
import { QualityTab } from './QualityTab/QualityTab.component';
import { TableProfilerChartProps } from './TableProfiler.interface';
import TableProfilerChart from './TableProfilerChart/TableProfilerChart';

export type GetProfilerTabsType = Record<
  TableProfilerTab,
  ((data: TableProfilerChartProps) => JSX.Element) | (() => JSX.Element)
>;

export type GetProfilerTabOptionsType = {
  viewProfiler: boolean;
  viewTest: boolean;
};

class ProfilerClassBase {
  public getProfilerTabs(): GetProfilerTabsType {
    return {
      [TableProfilerTab.DATA_QUALITY]: QualityTab,
      [TableProfilerTab.COLUMN_PROFILE]: ColumnProfileTable,
      [TableProfilerTab.TABLE_PROFILE]: TableProfilerChart,
      [TableProfilerTab.INCIDENTS]: IncidentsTab,
    } as GetProfilerTabsType;
  }

  public getProfilerTabOptions() {
    return [
      {
        label: i18n.t('label.table-entity-text', {
          entityText: i18n.t('label.profile'),
        }),
        key: TableProfilerTab.TABLE_PROFILE,
        icon: TableProfileIcon,
      },
      {
        label: i18n.t('label.column-entity', {
          entity: i18n.t('label.profile'),
        }),
        key: TableProfilerTab.COLUMN_PROFILE,
        icon: ColumnProfileIcon,
      },
      {
        label: i18n.t('label.data-entity', {
          entity: i18n.t('label.quality'),
        }),
        key: TableProfilerTab.DATA_QUALITY,
        icon: DataQualityIcon,
      },
      {
        label: i18n.t('label.incident-plural'),
        key: TableProfilerTab.INCIDENTS,
        icon: IncidentIcon,
      },
    ];
  }

  public getDefaultTabKey(isTourOpen: boolean): TableProfilerTab {
    return isTourOpen
      ? TableProfilerTab.COLUMN_PROFILE
      : TableProfilerTab.TABLE_PROFILE;
  }
}

const profilerClassBase = new ProfilerClassBase();

export default profilerClassBase;
export { ProfilerClassBase };
