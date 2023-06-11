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

import { Col, Row, Tabs } from 'antd';
import { AssetSelectionModal } from 'components/Assets/AssetsSelectionModal/AssetSelectionModal';
import { EntityDetailsObjectInterface } from 'components/Explore/explore.interface';
import GlossaryHeader from 'components/Glossary/GlossaryHeader/GlossaryHeader.component';
import GlossaryTermTab from 'components/Glossary/GlossaryTermTab/GlossaryTermTab.component';
import { getGlossaryTermDetailsPath } from 'constants/constants';
import { myDataSearchIndex } from 'constants/Mydata.constants';
import { t } from 'i18next';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { searchData } from 'rest/miscAPI';
import { getCountBadge } from 'utils/CommonUtils';
import { getGlossaryTermsVersionsPath } from 'utils/RouterUtils';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { OperationPermission } from '../PermissionProvider/PermissionProvider.interface';
import AssetsTabs, { AssetsTabRef } from './tabs/AssetsTabs.component';
import GlossaryOverviewTab from './tabs/GlossaryOverviewTab.component';

type Props = {
  permissions: OperationPermission;
  glossaryTerm: GlossaryTerm;
  childGlossaryTerms: GlossaryTerm[];
  handleGlossaryTermUpdate: (data: GlossaryTerm) => Promise<void>;
  handleGlossaryTermDelete: (id: string) => void;
  refreshGlossaryTerms: () => void;
  onAssetClick?: (asset?: EntityDetailsObjectInterface) => void;
  isSummaryPanelOpen: boolean;
  termsLoading: boolean;
  onAddGlossaryTerm: (glossaryTerm: GlossaryTerm | undefined) => void;
  onEditGlossaryTerm: (glossaryTerm: GlossaryTerm) => void;
};

const GlossaryTermsV1 = ({
  glossaryTerm,
  childGlossaryTerms,
  handleGlossaryTermUpdate,
  handleGlossaryTermDelete,
  permissions,
  refreshGlossaryTerms,
  onAssetClick,
  isSummaryPanelOpen,
  termsLoading,
  onAddGlossaryTerm,
  onEditGlossaryTerm,
}: Props) => {
  const {
    glossaryName: glossaryFqn,
    tab,
    version,
  } = useParams<{ glossaryName: string; tab: string; version: string }>();
  const history = useHistory();
  const assetTabRef = useRef<AssetsTabRef>(null);
  const [assetModalVisible, setAssetModelVisible] = useState(false);
  const [assetCount, setAssetCount] = useState<number>(0);

  const activeTab = useMemo(() => {
    return tab ?? 'overview';
  }, [tab]);

  const activeTabHandler = (tab: string) => {
    history.push({
      pathname: version
        ? getGlossaryTermsVersionsPath(glossaryFqn, version, tab)
        : getGlossaryTermDetailsPath(glossaryFqn, tab),
    });
  };

  const tabItems = useMemo(() => {
    const items = [
      {
        label: <div data-testid="overview">{t('label.overview')}</div>,
        key: 'overview',
        children: (
          <GlossaryOverviewTab
            isGlossary={false}
            permissions={permissions}
            selectedData={glossaryTerm}
            onUpdate={(data) => handleGlossaryTermUpdate(data as GlossaryTerm)}
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
            isGlossary={false}
            permissions={permissions}
            refreshGlossaryTerms={refreshGlossaryTerms}
            selectedData={glossaryTerm}
            termsLoading={termsLoading}
            onAddGlossaryTerm={onAddGlossaryTerm}
            onEditGlossaryTerm={onEditGlossaryTerm}
          />
        ),
      },
      {
        label: (
          <div data-testid="assets">
            {t('label.asset-plural')}
            <span className="p-l-xs ">
              {getCountBadge(assetCount ?? 0, '', activeTab === 'assets')}
            </span>
          </div>
        ),
        key: 'assets',
        children: (
          <AssetsTabs
            isSummaryPanelOpen={isSummaryPanelOpen}
            permissions={permissions}
            ref={assetTabRef}
            onAddAsset={() => setAssetModelVisible(true)}
            onAssetClick={onAssetClick}
          />
        ),
      },
    ];

    return items;
  }, [
    glossaryTerm,
    permissions,
    termsLoading,
    activeTab,
    assetCount,
    isSummaryPanelOpen,
  ]);

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

  const handleAssetSave = () => {
    fetchGlossaryTermAssets();
    assetTabRef.current?.refreshAssets();
    tab !== 'assets' && activeTabHandler('assets');
  };

  return (
    <>
      <Row data-testid="glossary-term" gutter={[0, 8]}>
        <Col span={24}>
          <GlossaryHeader
            isGlossary={false}
            permissions={permissions}
            selectedData={glossaryTerm}
            onAddGlossaryTerm={onAddGlossaryTerm}
            onAssetAdd={() => setAssetModelVisible(true)}
            onDelete={handleGlossaryTermDelete}
            onUpdate={(data) => handleGlossaryTermUpdate(data as GlossaryTerm)}
          />
        </Col>

        <Col span={24}>
          <Tabs
            destroyInactiveTabPane
            activeKey={activeTab}
            className="glossary-tabs"
            items={tabItems}
            onChange={activeTabHandler}
          />
        </Col>
      </Row>
      {glossaryTerm.fullyQualifiedName && (
        <AssetSelectionModal
          glossaryFQN={glossaryTerm.fullyQualifiedName}
          open={assetModalVisible}
          onCancel={() => setAssetModelVisible(false)}
          onSave={handleAssetSave}
        />
      )}
    </>
  );
};

export default GlossaryTermsV1;
