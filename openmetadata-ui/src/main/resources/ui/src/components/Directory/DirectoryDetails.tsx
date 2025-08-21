/*
 *  Copyright 2025 Collate.
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
import { AxiosError } from 'axios';
import { EntityTags } from 'Models';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FEED_COUNT_INITIAL_DATA } from '../../constants/entity.constants';
import LineageProvider from '../../context/LineageProvider/LineageProvider';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { Tag } from '../../generated/entity/classification/tag';
import { Directory } from '../../generated/entity/data/directory';
import { DataProduct } from '../../generated/entity/domains/dataProduct';
import { Operation } from '../../generated/entity/policies/policy';
import { PageType } from '../../generated/system/ui/uiCustomization';
import { TagLabel } from '../../generated/type/tagLabel';
import LimitWrapper from '../../hoc/LimitWrapper';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useCustomPages } from '../../hooks/useCustomPages';
import { useFqn } from '../../hooks/useFqn';
import { FeedCounts } from '../../interface/feed.interface';
import { restoreDirectory } from '../../rest/driveAPI';
import { getFeedCounts } from '../../utils/CommonUtils';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../utils/CustomizePage/CustomizePageUtils';
import directoryClassBase from '../../utils/DirectoryClassBase';
import {
  getEntityName,
  getEntityReferenceFromEntity,
} from '../../utils/EntityUtils';
import { getPrioritizedEditPermission } from '../../utils/PermissionsUtils';
import { getEntityDetailsPath } from '../../utils/RouterUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import {
  createTagObject,
  updateCertificationTag,
  updateTierTag,
} from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import { ActivityFeedTab } from '../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { ActivityFeedLayoutType } from '../ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { withActivityFeed } from '../AppRouter/withActivityFeed';
import { CustomPropertyTable } from '../common/CustomPropertyTable/CustomPropertyTable';
import { AlignRightIconButton } from '../common/IconButtons/EditIconButton';
import Loader from '../common/Loader/Loader';
import { GenericProvider } from '../Customization/GenericProvider/GenericProvider';
import { DataAssetsHeader } from '../DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import Lineage from '../Lineage/Lineage.component';
import { EntityName } from '../Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../PageLayoutV1/PageLayoutV1';
import { SourceType } from '../SearchedData/SearchedData.interface';
import { DirectoryDetailsProps } from './DirectoryDetails.interface';

function DirectoryDetails({
  directoryDetails,
  directoryPermissions,
  fetchDirectory,
  followDirectoryHandler,
  handleToggleDelete,
  unFollowDirectoryHandler,
  updateDirectoryDetailsState,
  versionHandler,
  onDirectoryUpdate,
  onUpdateVote,
}: DirectoryDetailsProps) {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { tab: activeTab = EntityTabs.CHILDREN } =
    useRequiredParams<{ tab: EntityTabs.DIRECTORIES }>();
  const { fqn: decodedDirectoryFQN } = useFqn();
  const navigate = useNavigate();
  const { customizedPage, isLoading } = useCustomPages(PageType.Directory);
  const [isTabExpanded, setIsTabExpanded] = useState(false);

  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );

  const {
    owners,
    deleted,
    description,
    followers = [],
    entityName,
    directoryTags,
    tier,
  } = useMemo(
    () => ({
      ...directoryDetails,
      tier: getTierTags(directoryDetails.tags ?? []),
      directoryTags: getTagsWithoutTier(directoryDetails.tags ?? []),
      entityName: getEntityName(directoryDetails),
    }),
    [directoryDetails]
  );

  const { isFollowing } = useMemo(
    () => ({
      isFollowing: followers?.some(({ id }) => id === currentUser?.id),
      followersCount: followers?.length ?? 0,
    }),
    [followers, currentUser]
  );

  const followDirectory = async () =>
    isFollowing
      ? await unFollowDirectoryHandler()
      : await followDirectoryHandler();

  const handleUpdateDisplayName = async (data: EntityName) => {
    const updatedData = {
      ...directoryDetails,
      displayName: data.displayName,
    };
    await onDirectoryUpdate(updatedData, 'displayName');
  };
  const onExtensionUpdate = async (updatedData: Directory) => {
    await onDirectoryUpdate(
      { ...directoryDetails, extension: updatedData.extension },
      'extension'
    );
  };

  const handleChildrenFieldUpdate = async (
    updatedChildren: Directory['children']
  ) => {
    try {
      await onDirectoryUpdate(
        {
          ...directoryDetails,
          children: updatedChildren,
        },
        'children'
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleRestoreDirectory = async () => {
    try {
      const { version: newVersion } = await restoreDirectory(
        directoryDetails.id
      );
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.directory'),
        })
      );
      handleToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.directory'),
        })
      );
    }
  };

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      navigate(
        getEntityDetailsPath(
          EntityType.DIRECTORY,
          decodedDirectoryFQN,
          activeKey
        ),
        { replace: true }
      );
    }
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (description !== updatedHTML) {
      const updatedDirectoryDetails = {
        ...directoryDetails,
        description: updatedHTML,
      };
      try {
        await onDirectoryUpdate(updatedDirectoryDetails, 'description');
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };
  const onOwnerUpdate = useCallback(
    async (newOwners?: Directory['owners']) => {
      const updatedDirectoryDetails = {
        ...directoryDetails,
        owners: newOwners,
      };
      await onDirectoryUpdate(updatedDirectoryDetails, 'owners');
    },
    [owners]
  );

  const onTierUpdate = (newTier?: Tag) => {
    const tierTag = updateTierTag(directoryDetails?.tags ?? [], newTier);
    const updatedDirectoryDetails = {
      ...directoryDetails,
      tags: tierTag,
    };

    return onDirectoryUpdate(updatedDirectoryDetails, 'tags');
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = createTagObject(selectedTags);

    if (updatedTags && directoryDetails) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedDirectory = { ...directoryDetails, tags: updatedTags };
      await onDirectoryUpdate(updatedDirectory, 'tags');
    }
  };

  const onDataProductsUpdate = async (updatedData: DataProduct[]) => {
    const dataProductsEntity = updatedData?.map((item) => {
      return getEntityReferenceFromEntity(item, EntityType.DATA_PRODUCT);
    });

    const updatedDirectoryDetails = {
      ...directoryDetails,
      dataProducts: dataProductsEntity,
    };

    await onDirectoryUpdate(updatedDirectoryDetails, 'dataProducts');
  };

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () =>
    getFeedCounts(EntityType.DIRECTORY, decodedDirectoryFQN, handleFeedCount);

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) => !isSoftDelete && navigate('/'),
    []
  );

  const {
    editTagsPermission,
    editGlossaryTermsPermission,
    editDescriptionPermission,
    editCustomAttributePermission,
    editAllPermission,
    editLineagePermission,
    viewAllPermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        getPrioritizedEditPermission(
          directoryPermissions,
          Operation.EditTags
        ) && !deleted,
      editGlossaryTermsPermission:
        getPrioritizedEditPermission(
          directoryPermissions,
          Operation.EditGlossaryTerms
        ) && !deleted,
      editDescriptionPermission:
        getPrioritizedEditPermission(
          directoryPermissions,
          Operation.EditDescription
        ) && !deleted,
      editCustomAttributePermission:
        getPrioritizedEditPermission(
          directoryPermissions,
          Operation.EditCustomFields
        ) && !deleted,
      editAllPermission: directoryPermissions.EditAll && !deleted,
      editLineagePermission:
        getPrioritizedEditPermission(
          directoryPermissions,
          Operation.EditLineage
        ) && !deleted,
      viewAllPermission: directoryPermissions.ViewAll,
    }),
    [directoryPermissions, deleted]
  );

  useEffect(() => {
    getEntityFeedCount();
  }, [directoryPermissions, decodedDirectoryFQN]);

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);

    const tabs = directoryClassBase.getDirectoryDetailPageTabs({
      childrenCount: directoryDetails.children?.length ?? 0,
      activityFeedTab: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.DIRECTORY}
          feedCount={feedCount}
          layoutType={ActivityFeedLayoutType.THREE_PANEL}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={fetchDirectory}
          onUpdateFeedCount={handleFeedCount}
        />
      ),
      lineageTab: (
        <LineageProvider>
          <Lineage
            deleted={directoryDetails.deleted}
            entity={directoryDetails as SourceType}
            entityType={EntityType.DIRECTORY}
            hasEditAccess={editLineagePermission}
          />
        </LineageProvider>
      ),
      customPropertiesTab: directoryDetails && (
        <CustomPropertyTable<EntityType.DIRECTORY>
          entityType={EntityType.DIRECTORY}
          hasEditAccess={editCustomAttributePermission}
          hasPermission={viewAllPermission}
        />
      ),
      activeTab,
      feedCount,
      labelMap: tabLabelMap,
    });

    return getDetailsTabWithNewLabel(
      tabs,
      customizedPage?.tabs,
      EntityTabs.CHILDREN
    );
  }, [
    activeTab,
    feedCount.totalCount,
    directoryTags,
    entityName,
    directoryDetails,
    decodedDirectoryFQN,
    fetchDirectory,
    deleted,
    handleFeedCount,
    onExtensionUpdate,
    handleTagSelection,
    onDescriptionUpdate,
    onDataProductsUpdate,
    handleChildrenFieldUpdate,
    editTagsPermission,
    editGlossaryTermsPermission,
    editDescriptionPermission,
    editCustomAttributePermission,
    editLineagePermission,
    editAllPermission,
    viewAllPermission,
  ]);
  const onCertificationUpdate = useCallback(
    async (newCertification?: Tag) => {
      if (directoryDetails) {
        const certificationTag: Directory['certification'] =
          updateCertificationTag(newCertification);
        const updatedDirectoryDetails = {
          ...directoryDetails,
          certification: certificationTag,
        };

        await onDirectoryUpdate(updatedDirectoryDetails, 'certification');
      }
    },
    [directoryDetails, onDirectoryUpdate]
  );

  const toggleTabExpanded = () => {
    setIsTabExpanded(!isTabExpanded);
  };

  const isExpandViewSupported = useMemo(
    () => checkIfExpandViewSupported(tabs[0], activeTab, PageType.Directory),
    [tabs[0], activeTab]
  );
  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.directory'),
      })}>
      <Row gutter={[0, 12]}>
        <Col span={24}>
          <DataAssetsHeader
            isDqAlertSupported
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={updateDirectoryDetailsState}
            dataAsset={directoryDetails}
            entityType={EntityType.DIRECTORY}
            openTaskCount={feedCount.openTaskCount}
            permissions={directoryPermissions}
            onCertificationUpdate={onCertificationUpdate}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={followDirectory}
            onOwnerUpdate={onOwnerUpdate}
            onRestoreDataAsset={handleRestoreDirectory}
            onTierUpdate={onTierUpdate}
            onUpdateVote={onUpdateVote}
            onVersionClick={versionHandler}
          />
        </Col>
        <GenericProvider<Directory>
          customizedPage={customizedPage}
          data={directoryDetails}
          isTabExpanded={isTabExpanded}
          permissions={directoryPermissions}
          type={EntityType.DIRECTORY}
          onUpdate={onDirectoryUpdate}>
          <Col className="entity-details-page-tabs" span={24}>
            <Tabs
              activeKey={activeTab}
              className="tabs-new"
              data-testid="tabs"
              items={tabs}
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
              onChange={handleTabChange}
            />
          </Col>
        </GenericProvider>
      </Row>
      <LimitWrapper resource="directory">
        <></>
      </LimitWrapper>
    </PageLayoutV1>
  );
}

export default withActivityFeed<DirectoryDetailsProps>(DirectoryDetails);
