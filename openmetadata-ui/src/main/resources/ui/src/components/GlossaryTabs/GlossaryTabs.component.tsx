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
import { Tabs } from 'antd';
import { EntityDetailsObjectInterface } from 'components/Explore/explore.interface';
import GlossaryTermTab from 'components/Glossary/GlossaryTermTab/GlossaryTermTab.component';
import AssetsTabs, {
  AssetsTabRef,
} from 'components/GlossaryTerms/tabs/AssetsTabs.component';
import GlossaryOverviewTab from 'components/GlossaryTerms/tabs/GlossaryOverviewTab.component';
import { OperationPermission } from 'components/PermissionProvider/PermissionProvider.interface';
import { getGlossaryTermDetailsPath } from 'constants/constants';
import { myDataSearchIndex } from 'constants/Mydata.constants';
import { Glossary } from 'generated/entity/data/glossary';
import { t } from 'i18next';
import React, { RefObject, useEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { searchData } from 'rest/miscAPI';
import { getGlossaryTermsVersionsPath } from 'utils/RouterUtils';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { getCountBadge } from '../../utils/CommonUtils';

type Props = {
  selectedData: Glossary | GlossaryTerm;
  childGlossaryTerms: GlossaryTerm[];
  permissions: OperationPermission;
  isGlossary: boolean;

  onUpdate: (data: GlossaryTerm | Glossary) => void;
  refreshGlossaryTerms: () => void;
  onAssetClick?: (asset?: EntityDetailsObjectInterface) => void;
  assetsRef: RefObject<AssetsTabRef>;
  isSummaryPanelOpen: boolean;
};

const GlossaryTabs = ({
  selectedData,
  childGlossaryTerms,
  isGlossary,
  onUpdate,
  permissions,
  refreshGlossaryTerms,
  onAssetClick,
  assetsRef,
  isSummaryPanelOpen,
}: Props) => {
  const {
    glossaryName: glossaryFqn,
    tab,
    version,
  } = useParams<{ glossaryName: string; tab: string; version: string }>();
  const history = useHistory();
  const [assetCount, setAssetCount] = useState<number>(0);

  const activeTabHandler = (tab: string) => {
    history.push({
      pathname: version
        ? getGlossaryTermsVersionsPath(glossaryFqn, version, tab)
        : getGlossaryTermDetailsPath(glossaryFqn, tab),
    });
  };

  const fetchGlossaryTermAssets = async () => {
    if (glossaryFqn) {
      try {
        const res = await searchData(
          '',
          1,
          0,
          `(tags.tagFQN:"${glossaryFqn}")`,
          '',
          '',
          myDataSearchIndex
        );

        setAssetCount(res.data.hits.total.value ?? 0);
      } catch (error) {
        setAssetCount(0);
      }
    }
  };

  useEffect(() => {
    fetchGlossaryTermAssets();
  }, [glossaryFqn]);

  const activeTab = useMemo(() => {
    return tab ?? 'overview';
  }, [tab]);

  const tabItems = useMemo(() => {
    const items = [
      {
        label: <div data-testid="overview">{t('label.overview')}</div>,
        key: 'overview',
        children: (
          <GlossaryOverviewTab
            isGlossary={isGlossary}
            permissions={permissions}
            selectedData={selectedData}
            onUpdate={onUpdate}
          />
        ),
      },
      {
        label: (
          <div data-testid="terms">
            {t('label.glossary-term-plural')}
            <span className="p-l-xs ">
              {getCountBadge(
                childGlossaryTerms.length,
                '',
                activeTab === 'terms'
              )}
            </span>
          </div>
        ),
        key: 'terms',
        children: (
          <GlossaryTermTab
            childGlossaryTerms={childGlossaryTerms}
            permissions={permissions}
            refreshGlossaryTerms={refreshGlossaryTerms}
            selectedGlossaryFqn={
              selectedData.fullyQualifiedName || selectedData.name
            }
          />
        ),
      },
    ];

    if (!isGlossary) {
      items.push({
        label: (
          <div data-testid="assets">
            {t('label.asset-plural')}
            <span className="p-l-xs ">
              {getCountBadge(assetCount, '', activeTab === 'assets')}
            </span>
          </div>
        ),
        key: 'assets',
        children: (
          <AssetsTabs
            isSummaryPanelOpen={isSummaryPanelOpen}
            permissions={permissions}
            ref={assetsRef}
            onAssetClick={onAssetClick}
          />
        ),
      });
    }

    return items;
  }, [selectedData, activeTab, assetCount, isSummaryPanelOpen]);

  return (
    <Tabs
      destroyInactiveTabPane
      activeKey={activeTab}
      className="glossary-tabs"
      items={tabItems}
      onChange={activeTabHandler}
    />
  );
};

export default GlossaryTabs;
