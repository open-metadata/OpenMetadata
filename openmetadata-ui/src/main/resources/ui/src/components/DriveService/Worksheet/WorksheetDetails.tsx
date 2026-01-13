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
import { Worksheet } from '../../../generated/entity/data/worksheet';
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
import {
  getFeedCounts,
} from '../../../utils/CommonUtils';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../../utils/CustomizePage/CustomizePageUtils';
import {
  getEntityName,
  getEntityReferenceFromEntity,
} from '../../../utils/EntityUtils';
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
import worksheetClassBase from '../../../utils/WorksheetClassBase';
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
import { WorksheetDetailsProps } from './WorksheetDetails.interface';

const EntityLineageTab = lazy(() =>
  import('../../Lineage/EntityLineageTab/EntityLineageTab').then((module) => ({
    default: module.EntityLineageTab,
  }))
);

function WorksheetDetails({
  worksheetDetails,
  worksheetPermissions,
  fetchWorksheet,
  followWorksheetHandler,
  handleToggleDelete,
  unFollowWorksheetHandler,
  updateWorksheetDetailsState,
  versionHandler,
  onWorksheetUpdate,
  onUpdateVote,
}: Readonly<WorksheetDetailsProps>) {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { tab: activeTab = EntityTabs.SCHEMA } =
    useRequiredParams<{ tab: EntityTabs }>();

  const navigate = useNavigate();
  const { customizedPage, isLoading } = useCustomPages(PageType.Worksheet);
  const [isTabExpanded, setIsTabExpanded] = useState(false);

  const { entityFqn: decodedWorksheetFQN } = useFqn({
    type: EntityType.WORKSHEET,
  });

  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );

  const {
    owners,
    deleted,
    description,
    followers = [],
    entityName,
    worksheetTags,
    tier,
  } = useMemo(
    () => ({
      ...worksheetDetails,
      tier: getTierTags(worksheetDetails.tags ?? []),
      worksheetTags: getTagsWithoutTier(worksheetDetails.tags ?? []),
      entityName: getEntityName(worksheetDetails),
    }),
    [worksheetDetails]
  );

  const { isFollowing } = useMemo(
    () => ({
      isFollowing: followers?.some(({ id }) => id === currentUser?.id),
      followersCount: followers?.length ?? 0,
    }),
    [followers, currentUser]
  );

  const followWorksheet = async () =>
    isFollowing
      ? await unFollowWorksheetHandler()
      : await followWorksheetHandler();

  const handleUpdateDisplayName = async (data: EntityName) => {
    const updatedData = {
      ...worksheetDetails,
      displayName: data.displayName,
    };
    await onWorksheetUpdate(updatedData, 'displayName');
  };
  const onExtensionUpdate = async (updatedData: Worksheet) => {
    await onWorksheetUpdate(
      { ...worksheetDetails, extension: updatedData.extension },
      'extension'
    );
  };

  const handleRestoreWorksheet = async () => {
    try {
      const { version: newVersion } = await restoreDriveAsset<Worksheet>(
        worksheetDetails.id,
        EntityType.WORKSHEET
      );
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.worksheet'),
        })
      );
      handleToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.worksheet'),
        })
      );
    }
  };

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      navigate(
        getEntityDetailsPath(
          EntityType.WORKSHEET,
          decodedWorksheetFQN,
          activeKey
        ),
        { replace: true }
      );
    }
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (description !== updatedHTML) {
      const updatedWorksheetDetails = {
        ...worksheetDetails,
        description: updatedHTML,
      };
      try {
        await onWorksheetUpdate(updatedWorksheetDetails, 'description');
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };
  const onOwnerUpdate = useCallback(
    async (newOwners?: Worksheet['owners']) => {
      const updatedWorksheetDetails = {
        ...worksheetDetails,
        owners: newOwners,
      };
      await onWorksheetUpdate(updatedWorksheetDetails, 'owners');
    },
    [owners]
  );

  const onTierUpdate = (newTier?: Tag) => {
    const tierTag = updateTierTag(worksheetDetails?.tags ?? [], newTier);
    const updatedWorksheetDetails = {
      ...worksheetDetails,
      tags: tierTag,
    };

    return onWorksheetUpdate(updatedWorksheetDetails, 'tags');
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = createTagObject(selectedTags);

    if (updatedTags && worksheetDetails) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedWorksheet = { ...worksheetDetails, tags: updatedTags };
      await onWorksheetUpdate(updatedWorksheet, 'tags');
    }
  };

  const onDataProductsUpdate = async (updatedData: DataProduct[]) => {
    const dataProductsEntity = updatedData?.map((item) => {
      return getEntityReferenceFromEntity(item, EntityType.DATA_PRODUCT);
    });

    const updatedWorksheetDetails = {
      ...worksheetDetails,
      dataProducts: dataProductsEntity,
    };

    await onWorksheetUpdate(updatedWorksheetDetails, 'dataProducts');
  };

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = useCallback(
    () => getFeedCounts(EntityType.WORKSHEET, decodedWorksheetFQN, handleFeedCount),
    [decodedWorksheetFQN, handleFeedCount]
  );

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) => !isSoftDelete && navigate('/'),
    [navigate]
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
        getPrioritizedEditPermission(
          worksheetPermissions,
          Operation.EditTags
        ) && !deleted,
      editGlossaryTermsPermission:
        getPrioritizedEditPermission(
          worksheetPermissions,
          Operation.EditGlossaryTerms
        ) && !deleted,
      editDescriptionPermission:
        getPrioritizedEditPermission(
          worksheetPermissions,
          Operation.EditDescription
        ) && !deleted,
      editCustomAttributePermission:
        getPrioritizedEditPermission(
          worksheetPermissions,
          Operation.EditCustomFields
        ) && !deleted,
      editAllPermission: worksheetPermissions.EditAll && !deleted,
      editLineagePermission:
        getPrioritizedEditPermission(
          worksheetPermissions,
          Operation.EditLineage
        ) && !deleted,
      viewAllPermission: worksheetPermissions.ViewAll,
      viewCustomPropertiesPermission: getPrioritizedViewPermission(
        worksheetPermissions,
        Operation.ViewCustomFields
      ),
    }),
    [worksheetPermissions, deleted]
  );

  useEffect(() => {
    getEntityFeedCount();
  }, [worksheetPermissions, decodedWorksheetFQN]);

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);

    const tabs = worksheetClassBase.getWorksheetDetailPageTabs({
      activityFeedTab: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.WORKSHEET}
          feedCount={feedCount}
          layoutType={ActivityFeedLayoutType.THREE_PANEL}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={fetchWorksheet}
          onUpdateFeedCount={handleFeedCount}
        />
      ),
      lineageTab: (
        <Suspense fallback={<Loader />}>
          <EntityLineageTab
            deleted={Boolean(deleted)}
            entity={worksheetDetails as SourceType}
            entityType={EntityType.WORKSHEET}
            hasEditAccess={editLineagePermission}
          />
        </Suspense>
      ),
      customPropertiesTab: worksheetDetails && (
        <CustomPropertyTable<EntityType.WORKSHEET>
          entityType={EntityType.WORKSHEET}
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
    worksheetTags,
    entityName,
    worksheetDetails,
    decodedWorksheetFQN,
    fetchWorksheet,
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
      if (worksheetDetails) {
        const certificationTag: Worksheet['certification'] =
          updateCertificationTag(newCertification);
        const updatedWorksheetDetails = {
          ...worksheetDetails,
          certification: certificationTag,
        };

        await onWorksheetUpdate(updatedWorksheetDetails, 'certification');
      }
    },
    [worksheetDetails, onWorksheetUpdate]
  );

  const toggleTabExpanded = () => {
    setIsTabExpanded(!isTabExpanded);
  };

  const isExpandViewSupported = useMemo(
    () => checkIfExpandViewSupported(tabs[0], activeTab, PageType.Worksheet),
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
            afterDomainUpdateAction={updateWorksheetDetailsState}
            dataAsset={worksheetDetails}
            entityType={EntityType.WORKSHEET}
            openTaskCount={feedCount.openTaskCount}
            permissions={worksheetPermissions}
            onCertificationUpdate={onCertificationUpdate}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={followWorksheet}
            onOwnerUpdate={onOwnerUpdate}
            onRestoreDataAsset={handleRestoreWorksheet}
            onTierUpdate={onTierUpdate}
            onUpdateVote={onUpdateVote}
            onVersionClick={versionHandler}
          />
        </Col>
        <GenericProvider<Worksheet>
          customizedPage={customizedPage}
          data={worksheetDetails}
          isTabExpanded={isTabExpanded}
          permissions={worksheetPermissions}
          type={EntityType.WORKSHEET}
          onUpdate={onWorksheetUpdate}>
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
      <LimitWrapper resource="worksheet">
        <></>
      </LimitWrapper>
    </PageLayoutV1>
  );
}

export default WorksheetDetails;
