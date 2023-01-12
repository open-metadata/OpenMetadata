/*
 *  Copyright 2022 Collate.
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

import { Menu, MenuProps } from 'antd';
import LeftPanelCard from 'components/common/LeftPanelCard/LeftPanelCard';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { ReactComponent as AppAnalyticsIcon } from '../../assets/svg/app-analytics.svg';
import { ReactComponent as DataAssetsIcon } from '../../assets/svg/data-asset.svg';
import { ReactComponent as KPIIcon } from '../../assets/svg/kpi.svg';
import { DataInsightTabs } from '../../interface/data-insight.interface';
import { getDataInsightPathWithFqn } from '../../utils/DataInsightUtils';

const DataInsightLeftPanel = () => {
  const { tab } = useParams<{ tab: DataInsightTabs }>();

  const history = useHistory();
  const { t } = useTranslation();

  const menuItems: MenuProps['items'] = [
    {
      key: DataInsightTabs.DATA_ASSETS,
      label: t('label.data-asset-plural'),
      icon: <AppAnalyticsIcon className="side-panel-icons" />,
    },
    {
      key: DataInsightTabs.APP_ANALYTICS,
      label: t('label.app-analytic-plural'),
      icon: <DataAssetsIcon className="side-panel-icons" />,
    },
    {
      key: DataInsightTabs.KPIS,
      label: `${t('label.kpi-uppercase')}s`,
      icon: <KPIIcon className="side-panel-icons" />,
    },
  ];

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    history.push(getDataInsightPathWithFqn(e.key));
  };

  return (
    <LeftPanelCard id="data-insight">
      <Menu
        className="data-insight-left-panel"
        data-testid="data-insight-left-panel"
        items={menuItems}
        mode="inline"
        selectedKeys={[tab ?? DataInsightTabs.DATA_ASSETS]}
        onClick={handleMenuClick}
      />
    </LeftPanelCard>
  );
};

export default DataInsightLeftPanel;
