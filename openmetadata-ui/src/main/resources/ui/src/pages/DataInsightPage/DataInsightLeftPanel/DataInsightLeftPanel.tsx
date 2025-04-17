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
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import LeftPanelCard from '../../../components/common/LeftPanelCard/LeftPanelCard';
import { DataInsightTabs } from '../../../interface/data-insight.interface';
import { getDataInsightPathWithFqn } from '../../../utils/DataInsightUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import DataInsightClassBase from '../DataInsightClassBase';

const DataInsightLeftPanel = () => {
  const { tab } = useRequiredParams<{ tab: DataInsightTabs }>();

  const navigate = useNavigate();

  const menuItems: MenuProps['items'] = useMemo(() => {
    const data = DataInsightClassBase.getLeftSideBar();

    return data.map((value) => {
      const SvgIcon = value.icon;

      return {
        key: value.key,
        label: value.label,
        icon: <SvgIcon {...value.iconProps} />,
      };
    });
  }, []);

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    navigate(getDataInsightPathWithFqn(e.key as DataInsightTabs));
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
