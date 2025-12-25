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
import { Spreadsheet } from '../../../generated/entity/data/spreadsheet';
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
import {
  getPrioritizedEditPermission,
  getPrioritizedViewPermission,
} from '../../../utils/PermissionsUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import spreadsheetClassBase from '../../../utils/SpreadsheetClassBase';
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
import { SpreadsheetDetailsProps } from './SpreadsheetDetails.interface';

const EntityLineageTab = lazy(() =>
  import('../../Lineage/EntityLineageTab/EntityLineageTab').then((module) => ({
    default: module.EntityLineageTab,
  }))
);

function SpreadsheetDetails({
  spreadsheetDetails,
  spreadsheetPermissions,
  fetchSpreadsheet,
  followSpreadsheetHandler,
  handleToggleDelete,
  unFollowSpreadsheetHandler,
  updateSpreadsheetDetailsState,
  versionHandler,
  onSpreadsheetUpdate,
  onUpdateVote,
}: Readonly<SpreadsheetDetailsProps>) {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { tab: activeTab = EntityTabs.WORKSHEETS } =
    useRequiredParams<{ tab: EntityTabs }>();
  const { fqn: decodedSpreadsheetFQN } = useFqn();
  const navigate = useNavigate();
  const { customizedPage, isLoading } = useCustomPages(PageType.Spreadsheet);
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
    spreadsheetTags,
    tier,
  } = useMemo(
    () => ({
      ...spreadsheetDetails,
      tier: getTierTags(spreadsheetDetails.tags ?? []),
      spreadsheetTags: getTagsWithoutTier(spreadsheetDetails.tags ?? []),
      entityName: getEntityName(spreadsheetDetails),
    }),
    [spreadsheetDetails]
  );

  const { isFollowing } = useMemo(
    () => ({
      isFollowing: followers?.some(({ id }) => id === currentUser?.id),
      followersCount: followers?.length ?? 0,
    }),
    [followers, currentUser]
  );

  const followSpreadsheet = async () =>
    isFollowing
      ? await unFollowSpreadsheetHandler()
      : await followSpreadsheetHandler();

  const handleUpdateDisplayName = async (data: EntityName) => {
    const updatedData = {
      ...spreadsheetDetails,
      displayName: data.displayName,
    };
    await onSpreadsheetUpdate(updatedData, 'displayName');
  };
  const onExtensionUpdate = async (updatedData: Spreadsheet) => {
    await onSpreadsheetUpdate(
      { ...spreadsheetDetails, extension: updatedData.extension },
      'extension'
    );
  };

  const handleRestoreSpreadsheet = async () => {
    try {
      const { version: newVersion } = await restoreDriveAsset<Spreadsheet>(
        spreadsheetDetails.id,
        EntityType.SPREADSHEET
      );
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.spreadsheet'),
        })
      );
      handleToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.spreadsheet'),
        })
      );
    }
  };

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      navigate(
        getEntityDetailsPath(
          EntityType.SPREADSHEET,
          decodedSpreadsheetFQN,
          activeKey
        ),
        { replace: true }
      );
    }
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (description !== updatedHTML) {
      const updatedSpreadsheetDetails = {
        ...spreadsheetDetails,
        description: updatedHTML,
      };
      try {
        await onSpreadsheetUpdate(updatedSpreadsheetDetails, 'description');
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };
  const onOwnerUpdate = useCallback(
    async (newOwners?: Spreadsheet['owners']) => {
      const updatedSpreadsheetDetails = {
        ...spreadsheetDetails,
        owners: newOwners,
      };
      await onSpreadsheetUpdate(updatedSpreadsheetDetails, 'owners');
    },
    [owners]
  );

  const onTierUpdate = (newTier?: Tag) => {
    const tierTag = updateTierTag(spreadsheetDetails?.tags ?? [], newTier);
    const updatedSpreadsheetDetails = {
      ...spreadsheetDetails,
      tags: tierTag,
    };

    return onSpreadsheetUpdate(updatedSpreadsheetDetails, 'tags');
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = createTagObject(selectedTags);

    if (updatedTags && spreadsheetDetails) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedSpreadsheet = { ...spreadsheetDetails, tags: updatedTags };
      await onSpreadsheetUpdate(updatedSpreadsheet, 'tags');
    }
  };

  const onDataProductsUpdate = async (updatedData: DataProduct[]) => {
    const dataProductsEntity = updatedData?.map((item) => {
      return getEntityReferenceFromEntity(item, EntityType.DATA_PRODUCT);
    });

    const updatedSpreadsheetDetails = {
      ...spreadsheetDetails,
      dataProducts: dataProductsEntity,
    };

    await onSpreadsheetUpdate(updatedSpreadsheetDetails, 'dataProducts');
  };

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () =>
    getFeedCounts(
      EntityType.SPREADSHEET,
      decodedSpreadsheetFQN,
      handleFeedCount
    );

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
        getPrioritizedEditPermission(
          spreadsheetPermissions,
          Operation.EditTags
        ) && !deleted,
      editGlossaryTermsPermission:
        getPrioritizedEditPermission(
          spreadsheetPermissions,
          Operation.EditGlossaryTerms
        ) && !deleted,
      editDescriptionPermission:
        getPrioritizedEditPermission(
          spreadsheetPermissions,
          Operation.EditDescription
        ) && !deleted,
      editCustomAttributePermission:
        getPrioritizedEditPermission(
          spreadsheetPermissions,
          Operation.EditCustomFields
        ) && !deleted,
      editAllPermission: spreadsheetPermissions.EditAll && !deleted,
      editLineagePermission:
        getPrioritizedEditPermission(
          spreadsheetPermissions,
          Operation.EditLineage
        ) && !deleted,
      viewAllPermission: spreadsheetPermissions.ViewAll,
      viewCustomPropertiesPermission: getPrioritizedViewPermission(
        spreadsheetPermissions,
        Operation.ViewCustomFields
      ),
    }),
    [spreadsheetPermissions, deleted]
  );

  useEffect(() => {
    getEntityFeedCount();
  }, [spreadsheetPermissions, decodedSpreadsheetFQN]);

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);

    const tabs = spreadsheetClassBase.getSpreadsheetDetailPageTabs({
      childrenCount: 0,
      activityFeedTab: (
        <ActivityFeedTab
          refetchFeed
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.SPREADSHEET}
          feedCount={feedCount}
          layoutType={ActivityFeedLayoutType.THREE_PANEL}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={fetchSpreadsheet}
          onUpdateFeedCount={handleFeedCount}
        />
      ),
      lineageTab: (
        <Suspense fallback={<Loader />}>
          <EntityLineageTab
            deleted={Boolean(deleted)}
            entity={spreadsheetDetails as SourceType}
            entityType={EntityType.SPREADSHEET}
            hasEditAccess={editLineagePermission}
          />
        </Suspense>
      ),
      customPropertiesTab: spreadsheetDetails && (
        <CustomPropertyTable<EntityType.SPREADSHEET>
          entityType={EntityType.SPREADSHEET}
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
    spreadsheetTags,
    entityName,
    spreadsheetDetails,
    decodedSpreadsheetFQN,
    fetchSpreadsheet,
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
      if (spreadsheetDetails) {
        const certificationTag: Spreadsheet['certification'] =
          updateCertificationTag(newCertification);
        const updatedSpreadsheetDetails = {
          ...spreadsheetDetails,
          certification: certificationTag,
        };

        await onSpreadsheetUpdate(updatedSpreadsheetDetails, 'certification');
      }
    },
    [spreadsheetDetails, onSpreadsheetUpdate]
  );

  const toggleTabExpanded = () => {
    setIsTabExpanded(!isTabExpanded);
  };

  const isExpandViewSupported = useMemo(
    () => checkIfExpandViewSupported(tabs[0], activeTab, PageType.Spreadsheet),
    [tabs[0], activeTab]
  );
  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.spreadsheet'),
      })}>
      <Row gutter={[0, 12]}>
        <Col span={24}>
          <DataAssetsHeader
            isDqAlertSupported
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={updateSpreadsheetDetailsState}
            dataAsset={spreadsheetDetails}
            entityType={EntityType.SPREADSHEET}
            openTaskCount={feedCount.openTaskCount}
            permissions={spreadsheetPermissions}
            onCertificationUpdate={onCertificationUpdate}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={followSpreadsheet}
            onOwnerUpdate={onOwnerUpdate}
            onRestoreDataAsset={handleRestoreSpreadsheet}
            onTierUpdate={onTierUpdate}
            onUpdateVote={onUpdateVote}
            onVersionClick={versionHandler}
          />
        </Col>
        <GenericProvider<Spreadsheet>
          customizedPage={customizedPage}
          data={spreadsheetDetails}
          isTabExpanded={isTabExpanded}
          permissions={spreadsheetPermissions}
          type={EntityType.SPREADSHEET}
          onUpdate={onSpreadsheetUpdate}>
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
      <LimitWrapper resource="spreadsheet">
        <></>
      </LimitWrapper>
    </PageLayoutV1>
  );
}

export default SpreadsheetDetails;
