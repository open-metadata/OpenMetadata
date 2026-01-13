/*
 *  Copyright 2023 Collate.
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
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { ReactComponent as AppAnalyticsIcon } from '../../assets/svg/app-analytics.svg';
import { ReactComponent as DataAssetsIcon } from '../../assets/svg/data-asset.svg';
import { ReactComponent as KPIIcon } from '../../assets/svg/kpi.svg';
import AppAnalyticsTab from '../../components/DataInsight/AppAnalyticsTab/AppAnalyticsTab.component';
import DataAssetsTab from '../../components/DataInsight/DataAssetsTab/DataAssetsTab.component';
import { DataInsightTabs } from '../../interface/data-insight.interface';
import { getDataInsightPathWithFqn } from '../../utils/DataInsightUtils';
import i18n from '../../utils/i18next/LocalUtil';
import DataInsightLeftPanel from './DataInsightLeftPanel/DataInsightLeftPanel';
import KPIList from './KPIList';

type LeftSideBarType = {
  key: DataInsightTabs;
  label: string;
  icon: SvgComponent;
  iconProps: React.SVGProps<SVGSVGElement>;
};

class DataInsightClassBase {
  public getLeftPanel() {
    return DataInsightLeftPanel;
  }

  public getLeftSideBar(): LeftSideBarType[] {
    return [
      {
        key: DataInsightTabs.DATA_ASSETS,
        label: i18n.t('label.data-asset-plural'),
        icon: AppAnalyticsIcon,
        iconProps: {
          className: 'side-panel-icons',
        },
      },
      {
        key: DataInsightTabs.APP_ANALYTICS,
        label: i18n.t('label.app-analytic-plural'),
        icon: DataAssetsIcon,
        iconProps: {
          className: 'side-panel-icons',
        },
      },
      {
        key: DataInsightTabs.KPIS,
        label: i18n.t('label.kpi-uppercase-plural'),
        icon: KPIIcon,
        iconProps: {
          className: 'side-panel-icons',
        },
      },
    ];
  }

  public getDataInsightTab() {
    return [
      {
        key: DataInsightTabs.DATA_ASSETS,
        path: getDataInsightPathWithFqn(DataInsightTabs.DATA_ASSETS),
        component: DataAssetsTab,
      },
      {
        key: DataInsightTabs.APP_ANALYTICS,
        path: getDataInsightPathWithFqn(DataInsightTabs.APP_ANALYTICS),
        component: AppAnalyticsTab,
      },
      {
        key: DataInsightTabs.KPIS,
        path: getDataInsightPathWithFqn(DataInsightTabs.KPIS),
        component: KPIList,
      },
    ];
  }

  public getDataInsightTabComponent(tab: DataInsightTabs) {
    const currentTab = this.getDataInsightTab().find(
      (tabItem) => tabItem.key === tab
    );

    return currentTab?.component;
  }

  public getManageExtraOptions(): ItemType[] {
    return [];
  }
}

const dataInsightClassBase = new DataInsightClassBase();

export default dataInsightClassBase;
export { DataInsightClassBase };
