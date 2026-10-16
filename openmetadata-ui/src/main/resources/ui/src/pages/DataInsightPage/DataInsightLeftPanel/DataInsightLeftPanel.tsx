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

import { NavItemBase } from '@openmetadata/ui-core-components';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import LeftPanelCard from '../../../components/common/LeftPanelCard/LeftPanelCard';
import { DataInsightTabs } from '../../../interface/data-insight.interface';
import { getDataInsightPathWithFqn } from '../../../utils/DataInsightPureUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import DataInsightClassBase from '../DataInsightClassBase';

const DataInsightLeftPanel = () => {
  const { t } = useTranslation();
  const { tab } = useRequiredParams<{ tab: DataInsightTabs }>();
  const menuItems = useMemo(() => DataInsightClassBase.getLeftSideBar(), []);

  return (
    <LeftPanelCard id="data-insight">
      <nav
        aria-label={t('label.data-insight')}
        className="data-insight-left-panel"
        data-testid="data-insight-left-panel">
        <ul className="tw:m-0 tw:list-none tw:p-0">
          {menuItems.map((item) => (
            <li key={item.key}>
              <NavItemBase
                current={item.key === (tab ?? DataInsightTabs.DATA_ASSETS)}
                href={getDataInsightPathWithFqn(item.key)}
                icon={item.icon}
                size="sm"
                type="link">
                {item.label}
              </NavItemBase>
            </li>
          ))}
        </ul>
      </nav>
    </LeftPanelCard>
  );
};

export default DataInsightLeftPanel;
