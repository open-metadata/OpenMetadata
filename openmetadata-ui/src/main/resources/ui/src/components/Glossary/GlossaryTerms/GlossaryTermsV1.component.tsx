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

import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import {
  ChangeDescription,
  Glossary,
} from '../../../generated/entity/data/glossary';
import {
  GlossaryTerm,
  Status,
} from '../../../generated/entity/data/glossaryTerm';
import { PageType } from '../../../generated/system/ui/page';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { useFqn } from '../../../hooks/useFqn';
import { FeedCounts } from '../../../interface/feed.interface';
import { MOCK_GLOSSARY_NO_PERMISSIONS } from '../../../mocks/Glossary.mock';
import { searchData } from '../../../rest/miscAPI';
import { getCountBadge, getFeedCounts } from '../../../utils/CommonUtils';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
} from '../../../utils/CustomizePage/CustomizePageUtils';
import { getEntityVersionByField } from '../../../utils/EntityVersionUtils';
import { getQueryFilterToExcludeTerm } from '../../../utils/GlossaryUtils';
import {
  getGlossaryTermDetailsPath,
  getGlossaryTermsVersionsPath,
} from '../../../utils/RouterUtils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../../utils/StringsUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { ActivityFeedTab } from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { ActivityFeedLayoutType } from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { CustomPropertyTable } from '../../common/CustomPropertyTable/CustomPropertyTable';
import { AlignRightIconButton } from '../../common/IconButtons/EditIconButton';
import Loader from '../../common/Loader/Loader';
import TabsLabel from '../../common/TabsLabel/TabsLabel.component';
import {
  GenericProvider,
  useGenericContext,
} from '../../Customization/GenericProvider/GenericProvider';
import { GenericTab } from '../../Customization/GenericTab/GenericTab';
import { AssetSelectionModal } from '../../DataAssets/AssetsSelectionModal/AssetSelectionModal';
import GlossaryHeader from '../GlossaryHeader/GlossaryHeader.component';
import GlossaryTermTab from '../GlossaryTermTab/GlossaryTermTab.component';
import { useGlossaryStore } from '../useGlossary.store';
import { GlossaryTermsV1Props } from './GlossaryTermsV1.interface';
import AssetsTabs, { AssetsTabRef } from './tabs/AssetsTabs.component';
import { AssetsOfEntity } from './tabs/AssetsTabs.interface';

const GlossaryTermsV1 = ({
  glossaryTerm,
  handleGlossaryTermUpdate,
  handleGlossaryTermDelete,
  onAssetClick,
  isSummaryPanelOpen,
  updateVote,
  refreshActiveGlossaryTerm,
  isVersionView,
  isTabExpanded,
  toggleTabExpanded,
}: GlossaryTermsV1Props) => {
  const { tab: activeTab, version } = useRequiredParams<{
    tab: EntityTabs;
    version: string;
  }>();
  const { fqn: glossaryFqn } = useFqn();
  const navigate = useNavigate();
  const assetTabRef = useRef<AssetsTabRef>(null);
  const [assetModalVisible, setAssetModalVisible] = useState(false);
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const [assetCount, setAssetCount] = useState<number>(0);
  const { glossaryChildTerms, onAddGlossaryTerm } = useGlossaryStore();
  const { permissions } = useGenericContext<GlossaryTerm>();
  const childGlossaryTerms = glossaryChildTerms ?? [];
  const { customizedPage, isLoading } = useCustomPages(PageType.GlossaryTerm);
  const { t } = useTranslation();

  const assetPermissions = useMemo(() => {
    const glossaryTermStatus = glossaryTerm.status ?? Status.Approved;

    return glossaryTermStatus === Status.Approved
      ? permissions
      : MOCK_GLOSSARY_NO_PERMISSIONS;
  }, [glossaryTerm, permissions]);

  const activeTabHandler = (tab: string) => {
    navigate(
      {
        pathname: version
          ? getGlossaryTermsVersionsPath(glossaryFqn, version, tab)
          : getGlossaryTermDetailsPath(glossaryFqn, tab),
      },
      { replace: true }
    );
  };

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () => {
    getFeedCounts(
      EntityType.GLOSSARY_TERM,
      glossaryTerm.fullyQualifiedName ?? '',
      handleFeedCount
    );
  };

  const fetchGlossaryTermAssets = async () => {
    if (glossaryTerm) {
      try {
        const encodedFqn = getEncodedFqn(
          escapeESReservedCharacters(glossaryTerm.fullyQualifiedName)
        );
        const res = await searchData(
          '',
          1,
          0,
          `(tags.tagFQN:"${encodedFqn}")`,
          '',
          '',
          SearchIndex.ALL
        );

        setAssetCount(res.data.hits.total.value ?? 0);
      } catch {
        setAssetCount(0);
      }
    }
  };

  const handleAssetSave = useCallback(() => {
    fetchGlossaryTermAssets();
    assetTabRef.current?.refreshAssets();
    activeTab !== EntityTabs.ASSETS && activeTabHandler(EntityTabs.ASSETS);
  }, [assetTabRef, activeTab]);

  const onExtensionUpdate = useCallback(
    async (updatedTable: GlossaryTerm) => {
      await handleGlossaryTermUpdate({
        ...glossaryTerm,
        extension: updatedTable.extension,
      });
    },
    [glossaryTerm, handleGlossaryTermUpdate]
  );

  const onTermUpdate = async (data: GlossaryTerm | Glossary) => {
    await handleGlossaryTermUpdate(data as GlossaryTerm);
    // For name change, do not update the feed. It will be updated when the page is redirected to
    // have the new value.
    if (glossaryTerm.name === data.name) {
      getEntityFeedCount();
    }
  };

  const tabItems = useMemo(() => {
    const items = [
      {
        label: <div data-testid="overview">{t('label.overview')}</div>,
        key: EntityTabs.OVERVIEW,
        children: <GenericTab type={PageType.GlossaryTerm} />,
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
                      activeTab === EntityTabs.GLOSSARY_TERMS
                    )}
                  </span>
                </div>
              ),
              key: EntityTabs.GLOSSARY_TERMS,
              children: (
                <GlossaryTermTab
                  className="p-md glossary-term-table-container"
                  isGlossary={false}
                />
              ),
            },
            {
              label: (
                <div data-testid="assets">
                  {t('label.asset-plural')}
                  <span className="p-l-xs">
                    {getCountBadge(assetCount ?? 0, '', activeTab === 'assets')}
                  </span>
                </div>
              ),
              key: EntityTabs.ASSETS,
              children: (
                <AssetsTabs
                  assetCount={assetCount}
                  entityFqn={glossaryTerm.fullyQualifiedName ?? ''}
                  isSummaryPanelOpen={isSummaryPanelOpen}
                  permissions={assetPermissions}
                  ref={assetTabRef}
                  onAddAsset={() => setAssetModalVisible(true)}
                  onAssetClick={onAssetClick}
                  onRemoveAsset={handleAssetSave}
                />
              ),
            },
            {
              label: (
                <TabsLabel
                  count={feedCount.totalCount}
                  id={EntityTabs.ACTIVITY_FEED}
                  isActive={activeTab === EntityTabs.ACTIVITY_FEED}
                  name={t('label.activity-feed-and-task-plural')}
                />
              ),
              key: EntityTabs.ACTIVITY_FEED,
              children: (
                <ActivityFeedTab
                  entityType={EntityType.GLOSSARY_TERM}
                  feedCount={feedCount}
                  hasGlossaryReviewer={!isEmpty(glossaryTerm.reviewers)}
                  layoutType={ActivityFeedLayoutType.THREE_PANEL}
                  owners={glossaryTerm.owners}
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
              children: glossaryTerm && (
                <CustomPropertyTable<EntityType.GLOSSARY_TERM>
                  entityType={EntityType.GLOSSARY_TERM}
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

    return getDetailsTabWithNewLabel(
      items,
      customizedPage?.tabs,
      EntityTabs.OVERVIEW,
      isVersionView
    );
  }, [
    customizedPage?.tabs,
    glossaryTerm,
    permissions,
    activeTab,
    assetCount,
    feedCount.conversationCount,
    feedCount.totalTasksCount,
    isSummaryPanelOpen,
    isVersionView,
    assetPermissions,
    handleAssetSave,
    onExtensionUpdate,
  ]);

  useEffect(() => {
    // Adding manual wait for ES to update assets when glossary term is renamed
    setTimeout(() => {
      fetchGlossaryTermAssets();
    }, 500);
    if (!isVersionView) {
      getEntityFeedCount();
    }
  }, [glossaryFqn, isVersionView]);

  useEffect(() => {
    if (!activeTab && !isVersionView) {
      navigate(
        {
          pathname: getGlossaryTermDetailsPath(
            glossaryFqn,
            EntityTabs.OVERVIEW
          ),
        },
        { replace: true }
      );
    }
  }, [activeTab, isVersionView, glossaryFqn, navigate]);

  const updatedGlossaryTerm = useMemo(() => {
    const name = isVersionView
      ? getEntityVersionByField(
          glossaryTerm.changeDescription as ChangeDescription,
          EntityField.NAME,
          glossaryTerm.name
        )
      : glossaryTerm.name;

    const displayName = isVersionView
      ? getEntityVersionByField(
          glossaryTerm.changeDescription as ChangeDescription,
          EntityField.DISPLAYNAME,
          glossaryTerm.displayName
        )
      : glossaryTerm.displayName;

    return {
      ...glossaryTerm,
      name,
      displayName,
    };
  }, [glossaryTerm, isVersionView]);

  const isExpandViewSupported = useMemo(
    () =>
      checkIfExpandViewSupported(tabItems[0], activeTab, PageType.GlossaryTerm),
    [tabItems[0], activeTab]
  );

  if (isLoading) {
    return <Loader />;
  }

  return (
    <GenericProvider
      customizedPage={customizedPage}
      data={updatedGlossaryTerm}
      isTabExpanded={isTabExpanded}
      isVersionView={isVersionView}
      permissions={permissions}
      type={EntityType.GLOSSARY_TERM}
      onUpdate={onTermUpdate}>
      <Row data-testid="glossary-term" gutter={[0, 12]}>
        <Col span={24}>
          <GlossaryHeader
            updateVote={updateVote}
            onAddGlossaryTerm={onAddGlossaryTerm}
            onAssetAdd={() => setAssetModalVisible(true)}
            onDelete={handleGlossaryTermDelete}
          />
        </Col>

        <Col className="glossary-term-page-tabs" span={24}>
          <Tabs
            destroyInactiveTabPane
            activeKey={activeTab}
            className="tabs-new"
            items={tabItems}
            tabBarExtraContent={
              isExpandViewSupported && (
                <AlignRightIconButton
                  className={isTabExpanded ? 'rotate-180' : ''}
                  title={
                    isTabExpanded ? t('label.collapse') : t('label.expand')
                  }
                  onClick={toggleTabExpanded}
                />
              )
            }
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
          onCancel={() => setAssetModalVisible(false)}
          onSave={handleAssetSave}
        />
      )}
    </GenericProvider>
  );
};

export default GlossaryTermsV1;
