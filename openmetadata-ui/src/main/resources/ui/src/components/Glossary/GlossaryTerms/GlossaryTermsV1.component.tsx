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
import { t } from 'i18next';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { getGlossaryTermDetailsPath } from '../../../constants/constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import {
  GlossaryTerm,
  Status,
} from '../../../generated/entity/data/glossaryTerm';
import { ChangeDescription } from '../../../generated/entity/type';
import { MOCK_GLOSSARY_NO_PERMISSIONS } from '../../../mocks/Glossary.mock';
import { searchData } from '../../../rest/miscAPI';
import { getCountBadge, getFeedCounts } from '../../../utils/CommonUtils';
import { getEntityVersionByField } from '../../../utils/EntityVersionUtils';
import { getQueryFilterToExcludeTerm } from '../../../utils/GlossaryUtils';
import { getGlossaryTermsVersionsPath } from '../../../utils/RouterUtils';
import { ActivityFeedTab } from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { AssetSelectionModal } from '../../Assets/AssetsSelectionModal/AssetSelectionModal';
import { CustomPropertyTable } from '../../common/CustomPropertyTable/CustomPropertyTable';
import TabsLabel from '../../TabsLabel/TabsLabel.component';
import { GlossaryTabs } from '../GlossaryDetails/GlossaryDetails.interface';
import GlossaryHeader from '../GlossaryHeader/GlossaryHeader.component';
import GlossaryTermTab from '../GlossaryTermTab/GlossaryTermTab.component';
import { GlossaryTermsV1Props } from './GlossaryTermsV1.interface';
import AssetsTabs, { AssetsTabRef } from './tabs/AssetsTabs.component';
import { AssetsOfEntity } from './tabs/AssetsTabs.interface';
import GlossaryOverviewTab from './tabs/GlossaryOverviewTab.component';

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
  updateVote,
  refreshActiveGlossaryTerm,
  isVersionView,
  onThreadLinkSelect,
}: GlossaryTermsV1Props) => {
  const {
    fqn: glossaryFqn,
    tab,
    version,
  } = useParams<{ fqn: string; tab: string; version: string }>();
  const history = useHistory();
  const assetTabRef = useRef<AssetsTabRef>(null);
  const [assetModalVisible, setAssetModelVisible] = useState(false);
  const [feedCount, setFeedCount] = useState<number>(0);
  const [assetCount, setAssetCount] = useState<number>(0);

  const assetPermissions = useMemo(() => {
    const glossaryTermStatus = glossaryTerm.status ?? Status.Approved;

    return glossaryTermStatus === Status.Approved
      ? permissions
      : MOCK_GLOSSARY_NO_PERMISSIONS;
  }, [glossaryTerm, permissions]);

  const activeTab = useMemo(() => {
    return tab ?? 'overview';
  }, [tab]);

  const activeTabHandler = (tab: string) => {
    history.push({
      pathname: version
        ? getGlossaryTermsVersionsPath(glossaryFqn, version, tab)
        : getGlossaryTermDetailsPath(decodeURIComponent(glossaryFqn), tab),
    });
  };

  const getEntityFeedCount = () => {
    getFeedCounts(
      EntityType.GLOSSARY_TERM,
      glossaryTerm.fullyQualifiedName ?? '',
      setFeedCount
    );
  };

  const handleAssetSave = useCallback(() => {
    fetchGlossaryTermAssets();
    assetTabRef.current?.refreshAssets();
    tab !== 'assets' && activeTabHandler('assets');
  }, [assetTabRef, tab]);

  const onExtensionUpdate = useCallback(
    async (updatedTable: GlossaryTerm) => {
      await handleGlossaryTermUpdate({
        ...glossaryTerm,
        extension: updatedTable.extension,
      });
    },
    [glossaryTerm, handleGlossaryTermUpdate]
  );

  const tabItems = useMemo(() => {
    const items = [
      {
        label: <div data-testid="overview">{t('label.overview')}</div>,
        key: 'overview',
        children: (
          <GlossaryOverviewTab
            isGlossary={false}
            isVersionView={isVersionView}
            permissions={permissions}
            selectedData={glossaryTerm}
            onThreadLinkSelect={onThreadLinkSelect}
            onUpdate={(data) => handleGlossaryTermUpdate(data as GlossaryTerm)}
          />
        ),
      },
      ...(!isVersionView
        ? [
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
                  className="p-md glossary-term-table-container"
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
                  assetCount={assetCount}
                  entityFqn={glossaryTerm.fullyQualifiedName ?? ''}
                  isSummaryPanelOpen={isSummaryPanelOpen}
                  permissions={assetPermissions}
                  ref={assetTabRef}
                  onAddAsset={() => setAssetModelVisible(true)}
                  onAssetClick={onAssetClick}
                  onRemoveAsset={handleAssetSave}
                />
              ),
            },
            {
              label: (
                <TabsLabel
                  count={feedCount}
                  id={GlossaryTabs.ACTIVITY_FEED}
                  isActive={activeTab === GlossaryTabs.ACTIVITY_FEED}
                  name={t('label.activity-feed-and-task-plural')}
                />
              ),
              key: GlossaryTabs.ACTIVITY_FEED,
              children: (
                <ActivityFeedTab
                  entityType={EntityType.GLOSSARY_TERM}
                  fqn={glossaryTerm.fullyQualifiedName ?? ''}
                  onFeedUpdate={getEntityFeedCount}
                  onUpdateEntityDetails={refreshActiveGlossaryTerm}
                />
              ),
            },
            {
              label: (
                <TabsLabel
                  id={EntityTabs.CUSTOM_PROPERTIES}
                  name={t('label.custom-property-plural')}
                />
              ),
              key: EntityTabs.CUSTOM_PROPERTIES,
              children: (
                <CustomPropertyTable
                  entityDetails={isVersionView ? glossaryTerm : undefined}
                  entityType={EntityType.GLOSSARY_TERM}
                  handleExtensionUpdate={onExtensionUpdate}
                  hasEditAccess={
                    !isVersionView &&
                    (permissions.EditAll || permissions.EditCustomFields)
                  }
                  hasPermission={permissions.ViewAll}
                  isVersionView={isVersionView}
                />
              ),
            },
          ]
        : []),
    ];

    return items;
  }, [
    glossaryTerm,
    permissions,
    termsLoading,
    activeTab,
    assetCount,
    feedCount,
    isSummaryPanelOpen,
    isVersionView,
    assetPermissions,
    handleAssetSave,
    onExtensionUpdate,
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
          SearchIndex.ALL
        );

        setAssetCount(res.data.hits.total.value ?? 0);
      } catch (error) {
        setAssetCount(0);
      }
    }
  };

  useEffect(() => {
    fetchGlossaryTermAssets();
    getEntityFeedCount();
  }, [glossaryFqn]);

  const name = useMemo(
    () =>
      isVersionView
        ? getEntityVersionByField(
            glossaryTerm.changeDescription as ChangeDescription,
            EntityField.NAME,
            glossaryTerm.name
          )
        : glossaryTerm.name,

    [glossaryTerm, isVersionView]
  );

  const displayName = useMemo(
    () =>
      isVersionView
        ? getEntityVersionByField(
            glossaryTerm.changeDescription as ChangeDescription,
            EntityField.DISPLAYNAME,
            glossaryTerm.displayName
          )
        : glossaryTerm.displayName,

    [glossaryTerm, isVersionView]
  );

  return (
    <>
      <Row data-testid="glossary-term" gutter={[0, 8]}>
        <Col className="p-x-md" span={24}>
          <GlossaryHeader
            isGlossary={false}
            isVersionView={isVersionView}
            permissions={permissions}
            selectedData={{ ...glossaryTerm, displayName, name }}
            updateVote={updateVote}
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
            className="glossary-tabs custom-tab-spacing"
            items={tabItems}
            onChange={activeTabHandler}
          />
        </Col>
      </Row>
      {glossaryTerm.fullyQualifiedName && assetModalVisible && (
        <AssetSelectionModal
          entityFqn={glossaryTerm.fullyQualifiedName}
          open={assetModalVisible}
          queryFilter={getQueryFilterToExcludeTerm(
            glossaryTerm.fullyQualifiedName
          )}
          type={AssetsOfEntity.GLOSSARY}
          onCancel={() => setAssetModelVisible(false)}
          onSave={handleAssetSave}
        />
      )}
    </>
  );
};

export default GlossaryTermsV1;
