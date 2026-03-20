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
  EntityStatus,
  GlossaryTerm,
} from '../../../generated/entity/data/glossaryTerm';
import { Operation } from '../../../generated/entity/policies/policy';
import { PageType } from '../../../generated/system/ui/page';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { useFqn } from '../../../hooks/useFqn';
import { FeedCounts } from '../../../interface/feed.interface';
import { MOCK_GLOSSARY_NO_PERMISSIONS } from '../../../mocks/Glossary.mock';
import { searchQuery } from '../../../rest/searchAPI';
import { getFeedCounts } from '../../../utils/CommonUtils';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../../utils/CustomizePage/CustomizePageUtils';
import { getEntityVersionByField } from '../../../utils/EntityVersionUtils';
import glossaryTermClassBase from '../../../utils/Glossary/GlossaryTermClassBase';
import { getQueryFilterToExcludeTerm } from '../../../utils/GlossaryUtils';
import { getPrioritizedViewPermission } from '../../../utils/PermissionsUtils';
import {
  getGlossaryTermDetailsPath,
  getGlossaryTermsVersionsPath,
} from '../../../utils/RouterUtils';
import { getTermQuery } from '../../../utils/SearchUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { AlignRightIconButton } from '../../common/IconButtons/EditIconButton';
import Loader from '../../common/Loader/Loader';
import {
  GenericProvider,
  useGenericContext,
} from '../../Customization/GenericProvider/GenericProvider';
import { AssetSelectionModal } from '../../DataAssets/AssetsSelectionModal/AssetSelectionModal';
import { EntityDetailsObjectInterface } from '../../Explore/ExplorePage.interface';
import GlossaryHeader from '../GlossaryHeader/GlossaryHeader.component';
import { useGlossaryStore } from '../useGlossary.store';
import { GlossaryTermsV1Props } from './GlossaryTermsV1.interface';
import { AssetsTabRef } from './tabs/AssetsTabs.component';
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
  const [previewAsset, setPreviewAsset] =
    useState<EntityDetailsObjectInterface>();
  const { onAddGlossaryTerm } = useGlossaryStore();
  const { permissions } = useGenericContext<GlossaryTerm>();
  const { customizedPage, isLoading } = useCustomPages(PageType.GlossaryTerm);
  const { t } = useTranslation();

  const assetPermissions = useMemo(() => {
    const glossaryTermStatus =
      glossaryTerm.entityStatus ?? EntityStatus.Approved;

    return glossaryTermStatus === EntityStatus.Approved
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
        const res = await searchQuery({
          query: '',
          pageNumber: 1,
          pageSize: 0,
          queryFilter: getTermQuery({
            'tags.tagFQN': glossaryTerm.fullyQualifiedName ?? '',
          }),
          searchIndex: SearchIndex.ALL,
        });

        setAssetCount(res.hits.total.value ?? 0);
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

  const onTermUpdate = async (data: GlossaryTerm | Glossary) => {
    await handleGlossaryTermUpdate(data as GlossaryTerm);
    // For name change, do not update the feed. It will be updated when the page is redirected to
    // have the new value.
    if (glossaryTerm.name === data.name) {
      getEntityFeedCount();
    }
  };

  const handleAssetClick = useCallback(
    (asset?: EntityDetailsObjectInterface) => {
      setPreviewAsset(asset);
      onAssetClick?.(asset);
    },
    [onAssetClick]
  );

  const viewCustomPropertiesPermission = useMemo(
    () => getPrioritizedViewPermission(permissions, Operation.ViewCustomFields),
    [permissions]
  );

  const tabItems = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);

    const items = glossaryTermClassBase.getGlossaryTermDetailPageTabs({
      glossaryTerm,
      activeTab,
      isVersionView: isVersionView ?? false,
      assetCount,
      feedCount,
      permissions,
      assetPermissions,
      viewCustomPropertiesPermission,
      previewAsset,
      assetTabRef,
      tabLabelMap,
      handleAssetClick,
      handleAssetSave,
      getEntityFeedCount,
      refreshActiveGlossaryTerm,
      setAssetModalVisible,
      setPreviewAsset,
    });

    return getDetailsTabWithNewLabel(
      items,
      customizedPage?.tabs,
      EntityTabs.OVERVIEW,
      isVersionView
    );
  }, [
    customizedPage?.tabs,
    glossaryTerm,
    viewCustomPropertiesPermission,
    activeTab,
    assetCount,
    feedCount.conversationCount,
    feedCount.totalTasksCount,
    isSummaryPanelOpen,
    isVersionView,
    assetPermissions,
    handleAssetSave,
    previewAsset,
    handleAssetClick,
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
