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
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { Tag } from '../../../generated/entity/classification/tag';
import { File } from '../../../generated/entity/data/file';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { Operation } from '../../../generated/entity/policies/policy';
import { PageType } from '../../../generated/system/ui/page';
import { TagLabel } from '../../../generated/type/tagLabel';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { useFqn } from '../../../hooks/useFqn';
import { FeedCounts } from '../../../interface/feed.interface';
import { restoreDriveAsset } from '../../../rest/driveAPI';
import { getFeedCounts } from '../../../utils/CommonUtils';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../../utils/CustomizePage/CustomizePageUtils';
import {
  getEntityName,
  getEntityReferenceFromEntity,
} from '../../../utils/EntityUtils';
import fileClassBase from '../../../utils/FileClassBase';
import {
  getPrioritizedEditPermission,
  getPrioritizedViewPermission,
} from '../../../utils/PermissionsUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { getTagsWithoutTier, getTierTags } from '../../../utils/TableUtils';
import {
  createTagObject,
  updateCertificationTag,
  updateTierTag,
} from '../../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { ActivityFeedTab } from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { ActivityFeedLayoutType } from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { CustomPropertyTable } from '../../common/CustomPropertyTable/CustomPropertyTable';
import { AlignRightIconButton } from '../../common/IconButtons/EditIconButton';
import Loader from '../../common/Loader/Loader';
import { GenericProvider } from '../../Customization/GenericProvider/GenericProvider';
import { DataAssetsHeader } from '../../DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { EntityName } from '../../Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import { FileDetailsProps } from './FileDetails.interface';

const EntityLineageTab = lazy(() =>
  import('../../Lineage/EntityLineageTab/EntityLineageTab').then((module) => ({
    default: module.EntityLineageTab,
  }))
);

function FileDetails({
  fileDetails,
  filePermissions,
  fetchFile,
  followFileHandler,
  handleToggleDelete,
  unFollowFileHandler,
  updateFileDetailsState,
  versionHandler,
  onFileUpdate,
  onUpdateVote,
}: Readonly<FileDetailsProps>) {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { tab: activeTab = EntityTabs.OVERVIEW } =
    useRequiredParams<{ tab: EntityTabs }>();
  const { fqn: decodedFileFQN } = useFqn();
  const navigate = useNavigate();
  const { customizedPage, isLoading } = useCustomPages(PageType.File);
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
    fileTags,
    tier,
  } = useMemo(
    () => ({
      ...fileDetails,
      tier: getTierTags(fileDetails.tags ?? []),
      fileTags: getTagsWithoutTier(fileDetails.tags ?? []),
      entityName: getEntityName(fileDetails),
    }),
    [fileDetails]
  );

  const { isFollowing } = useMemo(
    () => ({
      isFollowing: followers?.some(({ id }) => id === currentUser?.id),
      followersCount: followers?.length ?? 0,
    }),
    [followers, currentUser]
  );

  const followFile = async () =>
    isFollowing ? await unFollowFileHandler() : await followFileHandler();

  const handleUpdateDisplayName = async (data: EntityName) => {
    const updatedData = {
      ...fileDetails,
      displayName: data.displayName,
    };
    await onFileUpdate(updatedData, 'displayName');
  };
  const onExtensionUpdate = async (updatedData: File) => {
    await onFileUpdate(
      { ...fileDetails, extension: updatedData.extension },
      'extension'
    );
  };

  const handleRestoreFile = async () => {
    try {
      const { version: newVersion } = await restoreDriveAsset<File>(
        fileDetails.id,
        EntityType.FILE
      );
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.file'),
        })
      );
      handleToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.file'),
        })
      );
    }
  };

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      navigate(
        getEntityDetailsPath(EntityType.FILE, decodedFileFQN, activeKey),
        { replace: true }
      );
    }
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (description !== updatedHTML) {
      const updatedFileDetails = {
        ...fileDetails,
        description: updatedHTML,
      };
      try {
        await onFileUpdate(updatedFileDetails, 'description');
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };
  const onOwnerUpdate = useCallback(
    async (newOwners?: File['owners']) => {
      const updatedFileDetails = {
        ...fileDetails,
        owners: newOwners,
      };
      await onFileUpdate(updatedFileDetails, 'owners');
    },
    [owners]
  );

  const onTierUpdate = (newTier?: Tag) => {
    const tierTag = updateTierTag(fileDetails?.tags ?? [], newTier);
    const updatedFileDetails = {
      ...fileDetails,
      tags: tierTag,
    };

    return onFileUpdate(updatedFileDetails, 'tags');
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = createTagObject(selectedTags);

    if (updatedTags && fileDetails) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedFile = { ...fileDetails, tags: updatedTags };
      await onFileUpdate(updatedFile, 'tags');
    }
  };

  const onDataProductsUpdate = async (updatedData: DataProduct[]) => {
    const dataProductsEntity = updatedData?.map((item) => {
      return getEntityReferenceFromEntity(item, EntityType.DATA_PRODUCT);
    });

    const updatedFileDetails = {
      ...fileDetails,
      dataProducts: dataProductsEntity,
    };

    await onFileUpdate(updatedFileDetails, 'dataProducts');
  };

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () =>
    getFeedCounts(EntityType.FILE, decodedFileFQN, handleFeedCount);

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
    viewCustomPropertiesPermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        getPrioritizedEditPermission(filePermissions, Operation.EditTags) &&
        !deleted,
      editGlossaryTermsPermission:
        getPrioritizedEditPermission(
          filePermissions,
          Operation.EditGlossaryTerms
        ) && !deleted,
      editDescriptionPermission:
        getPrioritizedEditPermission(
          filePermissions,
          Operation.EditDescription
        ) && !deleted,
      editCustomAttributePermission:
        getPrioritizedEditPermission(
          filePermissions,
          Operation.EditCustomFields
        ) && !deleted,
      editAllPermission: filePermissions.EditAll && !deleted,
      editLineagePermission:
        getPrioritizedEditPermission(filePermissions, Operation.EditLineage) &&
        !deleted,
      viewAllPermission: filePermissions.ViewAll,
      viewCustomPropertiesPermission: getPrioritizedViewPermission(
        filePermissions,
        Operation.ViewCustomFields
      ),
    }),
    [filePermissions, deleted]
  );

  useEffect(() => {
    getEntityFeedCount();
  }, [filePermissions, decodedFileFQN]);

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);

    const tabs = fileClassBase.getFileDetailPageTabs({
      activityFeedTab: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.FILE}
          feedCount={feedCount}
          layoutType={ActivityFeedLayoutType.THREE_PANEL}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={fetchFile}
          onUpdateFeedCount={handleFeedCount}
        />
      ),
      lineageTab: (
        <Suspense fallback={<Loader />}>
          <EntityLineageTab
            deleted={Boolean(deleted)}
            entity={fileDetails as SourceType}
            entityType={EntityType.FILE}
            hasEditAccess={editLineagePermission}
          />
        </Suspense>
      ),
      customPropertiesTab: fileDetails && (
        <CustomPropertyTable<EntityType.FILE>
          entityType={EntityType.FILE}
          hasEditAccess={editCustomAttributePermission}
          hasPermission={viewCustomPropertiesPermission}
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
    fileTags,
    entityName,
    fileDetails,
    decodedFileFQN,
    fetchFile,
    deleted,
    handleFeedCount,
    onExtensionUpdate,
    handleTagSelection,
    onDescriptionUpdate,
    onDataProductsUpdate,
    editTagsPermission,
    editGlossaryTermsPermission,
    editDescriptionPermission,
    editCustomAttributePermission,
    editLineagePermission,
    editAllPermission,
    viewAllPermission,
    viewCustomPropertiesPermission,
  ]);
  const onCertificationUpdate = useCallback(
    async (newCertification?: Tag) => {
      if (fileDetails) {
        const certificationTag: File['certification'] =
          updateCertificationTag(newCertification);
        const updatedFileDetails = {
          ...fileDetails,
          certification: certificationTag,
        };

        await onFileUpdate(updatedFileDetails, 'certification');
      }
    },
    [fileDetails, onFileUpdate]
  );

  const toggleTabExpanded = () => {
    setIsTabExpanded(!isTabExpanded);
  };

  const isExpandViewSupported = useMemo(
    () => checkIfExpandViewSupported(tabs[0], activeTab, PageType.File),
    [tabs[0], activeTab]
  );
  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1 pageTitle={entityName}>
      <Row gutter={[0, 12]}>
        <Col span={24}>
          <DataAssetsHeader
            isDqAlertSupported
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={updateFileDetailsState}
            dataAsset={fileDetails}
            entityType={EntityType.FILE}
            openTaskCount={feedCount.openTaskCount}
            permissions={filePermissions}
            onCertificationUpdate={onCertificationUpdate}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={followFile}
            onOwnerUpdate={onOwnerUpdate}
            onRestoreDataAsset={handleRestoreFile}
            onTierUpdate={onTierUpdate}
            onUpdateVote={onUpdateVote}
            onVersionClick={versionHandler}
          />
        </Col>
        <GenericProvider<File>
          customizedPage={customizedPage}
          data={fileDetails}
          isTabExpanded={isTabExpanded}
          permissions={filePermissions}
          type={EntityType.FILE}
          onUpdate={onFileUpdate}>
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
      <LimitWrapper resource="file">
        <></>
      </LimitWrapper>
    </PageLayoutV1>
  );
}

export default FileDetails;
