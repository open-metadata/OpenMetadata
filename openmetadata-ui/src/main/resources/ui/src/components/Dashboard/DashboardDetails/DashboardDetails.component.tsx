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
import { AxiosError } from 'axios';
import { EntityTags } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { getEntityDetailsPath } from '../../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { Tag } from '../../../generated/entity/classification/tag';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { ThreadType } from '../../../generated/entity/feed/thread';
import { Page } from '../../../generated/system/ui/page';
import { PageType } from '../../../generated/system/ui/uiCustomization';
import { TagLabel } from '../../../generated/type/tagLabel';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useFqn } from '../../../hooks/useFqn';
import { FeedCounts } from '../../../interface/feed.interface';
import { restoreDashboard } from '../../../rest/dashboardAPI';
import { getDocumentByFQN } from '../../../rest/DocStoreAPI';
import { getFeedCounts } from '../../../utils/CommonUtils';
import dashboardDetailsClassBase from '../../../utils/DashboardDetailsClassBase';
import { getEntityName } from '../../../utils/EntityUtils';
import {
  getGlossaryTermDetailTabs,
  getTabLabelMap,
} from '../../../utils/GlossaryTerm/GlossaryTermUtil';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { getTagsWithoutTier, getTierTags } from '../../../utils/TableUtils';
import { createTagObject, updateTierTag } from '../../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useActivityFeedProvider } from '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import ActivityThreadPanel from '../../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { withActivityFeed } from '../../AppRouter/withActivityFeed';
import { DataAssetsHeader } from '../../DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { GenericProvider } from '../../GenericProvider/GenericProvider';
import { EntityName } from '../../Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import { DashboardDetailsProps } from './DashboardDetails.interface';

const DashboardDetails = ({
  updateDashboardDetailsState,
  charts,
  dashboardDetails,
  fetchDashboard,
  followDashboardHandler,
  unFollowDashboardHandler,
  versionHandler,
  createThread,
  onUpdateVote,
  onDashboardUpdate,
  handleToggleDelete,
}: DashboardDetailsProps) => {
  const { t } = useTranslation();
  const { currentUser, selectedPersona } = useApplicationStore();
  const history = useHistory();
  const { tab: activeTab = EntityTabs.DETAILS } =
    useParams<{ tab: EntityTabs }>();
  const [customizedPage, setCustomizedPage] = useState<Page | null>(null);
  const { fqn: decodedDashboardFQN } = useFqn();

  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const [isEdit, setIsEdit] = useState(false);

  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const [threadLink, setThreadLink] = useState<string>('');

  const [threadType, setThreadType] = useState<ThreadType>(
    ThreadType.Conversation
  );
  const [dashboardPermissions, setDashboardPermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const {
    owners,
    description,
    entityName,
    followers = [],
    deleted,
    dashboardTags,
    tier,
  } = useMemo(() => {
    const { tags = [] } = dashboardDetails;

    return {
      ...dashboardDetails,
      tier: getTierTags(tags),
      dashboardTags: getTagsWithoutTier(tags),
      entityName: getEntityName(dashboardDetails),
    };
  }, [dashboardDetails]);

  const { isFollowing } = useMemo(() => {
    return {
      isFollowing: followers?.some(({ id }) => id === currentUser?.id),
    };
  }, [followers, currentUser]);

  const { getEntityPermission } = usePermissionProvider();

  const fetchResourcePermission = useCallback(async () => {
    try {
      const entityPermission = await getEntityPermission(
        ResourceEntity.DASHBOARD,
        dashboardDetails.id
      );
      setDashboardPermissions(entityPermission);
    } catch (error) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.dashboard'),
        })
      );
    }
  }, [dashboardDetails.id, getEntityPermission, setDashboardPermissions]);

  useEffect(() => {
    if (dashboardDetails.id) {
      fetchResourcePermission();
    }
  }, [dashboardDetails.id]);

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () =>
    getFeedCounts(EntityType.DASHBOARD, decodedDashboardFQN, handleFeedCount);

  useEffect(() => {
    getEntityFeedCount();
  }, [decodedDashboardFQN]);

  const handleTabChange = (activeKey: string) => {
    if (activeKey !== activeTab) {
      history.push(
        getEntityDetailsPath(
          EntityType.DASHBOARD,
          decodedDashboardFQN,
          activeKey
        )
      );
    }
  };

  const onDescriptionEdit = (): void => {
    setIsEdit(true);
  };
  const onCancel = () => {
    setIsEdit(false);
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (description !== updatedHTML) {
      const updatedDashboard = {
        ...dashboardDetails,
        description: updatedHTML,
      };
      try {
        await onDashboardUpdate(updatedDashboard, 'description');
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsEdit(false);
      }
    } else {
      setIsEdit(false);
    }
  };

  const onOwnerUpdate = useCallback(
    async (newOwners?: Dashboard['owners']) => {
      const updatedDashboard = {
        ...dashboardDetails,
        owners: newOwners,
      };
      await onDashboardUpdate(updatedDashboard, 'owners');
    },
    [owners]
  );

  const onTierUpdate = async (newTier?: Tag) => {
    const tierTag = updateTierTag(dashboardDetails?.tags ?? [], newTier);
    const updatedDashboard = {
      ...dashboardDetails,
      tags: tierTag,
    };
    await onDashboardUpdate(updatedDashboard, 'tags');
  };

  const onUpdateDisplayName = async (data: EntityName) => {
    const updatedData = {
      ...dashboardDetails,
      displayName: data.displayName,
    };
    await onDashboardUpdate(updatedData, 'displayName');
  };
  const onExtensionUpdate = async (updatedData: Dashboard) => {
    await onDashboardUpdate(
      { ...dashboardDetails, extension: updatedData.extension },
      'extension'
    );
  };

  const handleRestoreDashboard = async () => {
    try {
      const { version: newVersion } = await restoreDashboard(
        dashboardDetails.id
      );
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.dashboard'),
        }),
        2000
      );
      handleToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.dashboard'),
        })
      );
    }
  };

  const followDashboard = async () => {
    isFollowing
      ? await unFollowDashboardHandler()
      : await followDashboardHandler();
  };

  const onThreadLinkSelect = (link: string, threadType?: ThreadType) => {
    setThreadLink(link);
    if (threadType) {
      setThreadType(threadType);
    }
  };

  const onThreadPanelClose = () => {
    setThreadLink('');
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = createTagObject(selectedTags);

    if (updatedTags && dashboardDetails) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedDashboard = { ...dashboardDetails, tags: updatedTags };
      await onDashboardUpdate(updatedDashboard, 'tags');
    }
  };

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean, version?: number) =>
      isSoftDelete ? handleToggleDelete(version) : history.push('/'),
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
        (dashboardPermissions.EditTags || dashboardPermissions.EditAll) &&
        !deleted,
      editGlossaryTermsPermission:
        (dashboardPermissions.EditGlossaryTerms ||
          dashboardPermissions.EditAll) &&
        !deleted,
      editDescriptionPermission:
        (dashboardPermissions.EditDescription ||
          dashboardPermissions.EditAll) &&
        !deleted,
      editCustomAttributePermission:
        (dashboardPermissions.EditAll ||
          dashboardPermissions.EditCustomFields) &&
        !deleted,
      editAllPermission: dashboardPermissions.EditAll && !deleted,
      editLineagePermission:
        (dashboardPermissions.EditAll || dashboardPermissions.EditLineage) &&
        !deleted,
      viewAllPermission: dashboardPermissions.ViewAll,
    }),
    [dashboardPermissions, deleted]
  );

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMap(customizedPage?.tabs);

    const tabs = dashboardDetailsClassBase.getDashboardDetailPageTabs({
      entityName,
      editDescriptionPermission,
      editTagsPermission,
      editGlossaryTermsPermission,
      editLineagePermission,
      editCustomAttributePermission,
      viewAllPermission,
      dashboardDetails,
      charts: charts ?? [],
      deleted: deleted ?? false,
      dashboardTags,
      handleFeedCount,
      onThreadLinkSelect,
      handleTagSelection,
      onDescriptionUpdate,
      onExtensionUpdate,
      feedCount,
      activeTab,
      getEntityFeedCount,
      fetchDashboard,
      labelMap: tabLabelMap,
    });

    return getGlossaryTermDetailTabs(
      tabs,
      customizedPage?.tabs,
      EntityTabs.DETAILS
    );
  }, [
    feedCount.totalCount,
    activeTab,
    isEdit,
    dashboardDetails,
    charts,
    deleted,
    entityName,
    dashboardTags,
    onCancel,
    handleFeedCount,
    onDescriptionEdit,
    onDescriptionUpdate,
    onThreadLinkSelect,
    handleTagSelection,
    editTagsPermission,
    editGlossaryTermsPermission,
    editLineagePermission,
    editDescriptionPermission,
    editCustomAttributePermission,
    editAllPermission,
    viewAllPermission,
    onExtensionUpdate,
  ]);

  const fetchDocument = useCallback(async () => {
    const pageFQN = `${EntityType.PERSONA}${FQN_SEPARATOR_CHAR}${selectedPersona.fullyQualifiedName}`;
    try {
      const doc = await getDocumentByFQN(pageFQN);
      setCustomizedPage(
        doc.data?.pages?.find((p: Page) => p.pageType === PageType.Dashboard)
      );
    } catch (error) {
      // fail silent
    }
  }, [selectedPersona.fullyQualifiedName]);

  useEffect(() => {
    if (selectedPersona?.fullyQualifiedName) {
      fetchDocument();
    }
  }, [selectedPersona]);

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.dashboard'),
      })}
      title="Table details">
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" span={24}>
          <DataAssetsHeader
            isDqAlertSupported
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={updateDashboardDetailsState}
            dataAsset={dashboardDetails}
            entityType={EntityType.DASHBOARD}
            openTaskCount={feedCount.openTaskCount}
            permissions={dashboardPermissions}
            onDisplayNameUpdate={onUpdateDisplayName}
            onFollowClick={followDashboard}
            onOwnerUpdate={onOwnerUpdate}
            onRestoreDataAsset={handleRestoreDashboard}
            onTierUpdate={onTierUpdate}
            onUpdateVote={onUpdateVote}
            onVersionClick={versionHandler}
          />
        </Col>
        <GenericProvider<Dashboard>
          data={dashboardDetails}
          permissions={dashboardPermissions}
          type={EntityType.DASHBOARD}
          onUpdate={onDashboardUpdate}>
          <Col span={24}>
            <Tabs
              activeKey={activeTab ?? EntityTabs.SCHEMA}
              className="entity-details-page-tabs"
              data-testid="tabs"
              items={tabs}
              onChange={handleTabChange}
            />
          </Col>
        </GenericProvider>
      </Row>

      <LimitWrapper resource="dashboard">
        <></>
      </LimitWrapper>
      {threadLink ? (
        <ActivityThreadPanel
          createThread={createThread}
          deletePostHandler={deleteFeed}
          open={Boolean(threadLink)}
          postFeedHandler={postFeed}
          threadLink={threadLink}
          threadType={threadType}
          updateThreadHandler={updateFeed}
          onCancel={onThreadPanelClose}
        />
      ) : null}
    </PageLayoutV1>
  );
};

export default withActivityFeed<DashboardDetailsProps>(DashboardDetails);
