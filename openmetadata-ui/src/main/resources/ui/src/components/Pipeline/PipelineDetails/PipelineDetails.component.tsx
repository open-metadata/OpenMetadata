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
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { Tag } from '../../../generated/entity/classification/tag';
import { Pipeline, TagLabel } from '../../../generated/entity/data/pipeline';
import { PageType } from '../../../generated/system/ui/uiCustomization';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { FeedCounts } from '../../../interface/feed.interface';
import { restorePipeline } from '../../../rest/pipelineAPI';
import { getFeedCounts } from '../../../utils/CommonUtils';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../../utils/CustomizePage/CustomizePageUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import pipelineClassBase from '../../../utils/PipelineClassBase';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { getTagsWithoutTier, getTierTags } from '../../../utils/TableUtils';
import { createTagObject, updateTierTag } from '../../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { withActivityFeed } from '../../AppRouter/withActivityFeed';
import { AlignRightIconButton } from '../../common/IconButtons/EditIconButton';
import Loader from '../../common/Loader/Loader';
import { GenericProvider } from '../../Customization/GenericProvider/GenericProvider';
import { DataAssetsHeader } from '../../DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { EntityName } from '../../Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import './pipeline-details.style.less';
import { PipeLineDetailsProp } from './PipelineDetails.interface';

const PipelineDetails = ({
  updatePipelineDetailsState,
  pipelineDetails,
  fetchPipeline,
  descriptionUpdateHandler,
  followPipelineHandler,
  unFollowPipelineHandler,
  settingsUpdateHandler,
  versionHandler,
  pipelineFQN,
  onUpdateVote,
  onExtensionUpdate,
  handleToggleDelete,
}: PipeLineDetailsProp) => {
  const history = useHistory();
  const { tab } = useParams<{ tab: EntityTabs }>();
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const userID = currentUser?.id ?? '';
  const [isTabExpanded, setIsTabExpanded] = useState(false);
  const { deleted, owners, description, entityName, tier, followers } =
    useMemo(() => {
      return {
        deleted: pipelineDetails.deleted,
        owners: pipelineDetails.owners,
        serviceType: pipelineDetails.serviceType,
        description: pipelineDetails.description,
        version: pipelineDetails.version,
        pipelineStatus: pipelineDetails.pipelineStatus,
        tier: getTierTags(pipelineDetails.tags ?? []),
        tags: getTagsWithoutTier(pipelineDetails.tags ?? []),
        entityName: getEntityName(pipelineDetails),
        followers: pipelineDetails.followers ?? [],
      };
    }, [pipelineDetails]);

  // local state variables
  const { customizedPage, isLoading } = useCustomPages(PageType.Pipeline);

  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );

  const [pipelinePermissions, setPipelinePermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const { getEntityPermission } = usePermissionProvider();

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () =>
    getFeedCounts(EntityType.PIPELINE, pipelineFQN, handleFeedCount);

  const fetchResourcePermission = useCallback(async () => {
    try {
      const entityPermission = await getEntityPermission(
        ResourceEntity.PIPELINE,
        pipelineDetails.id
      );
      setPipelinePermissions(entityPermission);
    } catch {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.asset-lowercase'),
        })
      );
    }
  }, [pipelineDetails.id, getEntityPermission, setPipelinePermissions]);

  useEffect(() => {
    if (pipelineDetails.id) {
      fetchResourcePermission();
    }
  }, [pipelineDetails.id]);

  const isFollowing = useMemo(
    () => followers.some(({ id }: { id: string }) => id === userID),
    [followers, userID]
  );

  const onOwnerUpdate = useCallback(
    async (newOwners?: Pipeline['owners']) => {
      const updatedPipelineDetails = {
        ...pipelineDetails,
        owners: newOwners,
      };
      await settingsUpdateHandler(updatedPipelineDetails);
    },
    [owners]
  );

  const onTierUpdate = async (newTier?: Tag) => {
    const tierTag = updateTierTag(pipelineDetails?.tags ?? [], newTier);
    const updatedPipelineDetails = {
      ...pipelineDetails,
      tags: tierTag,
    };
    await settingsUpdateHandler(updatedPipelineDetails);
  };

  const handleUpdateDisplayName = async (data: EntityName) => {
    const updatedPipelineDetails = {
      ...pipelineDetails,
      displayName: data.displayName,
    };
    await settingsUpdateHandler(updatedPipelineDetails);
  };

  const handleRestorePipeline = async () => {
    try {
      const { version: newVersion } = await restorePipeline(pipelineDetails.id);
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.pipeline'),
        })
      );
      handleToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.pipeline'),
        })
      );
    }
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (description !== updatedHTML) {
      const updatedPipelineDetails = {
        ...pipelineDetails,
        description: updatedHTML,
      };
      await descriptionUpdateHandler(updatedPipelineDetails);
    }
  };

  const followPipeline = useCallback(async () => {
    if (isFollowing) {
      await unFollowPipelineHandler();
    } else {
      await followPipelineHandler();
    }
  }, [isFollowing, followPipelineHandler, unFollowPipelineHandler]);

  const {
    editTagsPermission,
    editGlossaryTermsPermission,
    editDescriptionPermission,
    editCustomAttributePermission,
    editLineagePermission,
    viewAllPermission,
    editAllPermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        (pipelinePermissions.EditTags || pipelinePermissions.EditAll) &&
        !deleted,
      editGlossaryTermsPermission:
        (pipelinePermissions.EditGlossaryTerms ||
          pipelinePermissions.EditAll) &&
        !deleted,
      editDescriptionPermission:
        (pipelinePermissions.EditDescription || pipelinePermissions.EditAll) &&
        !deleted,
      editCustomAttributePermission:
        (pipelinePermissions.EditAll || pipelinePermissions.EditCustomFields) &&
        !deleted,
      editLineagePermission:
        (pipelinePermissions.EditAll || pipelinePermissions.EditLineage) &&
        !deleted,
      viewAllPermission: pipelinePermissions.ViewAll,
      editAllPermission: pipelinePermissions.EditAll,
    }),
    [pipelinePermissions, deleted]
  );

  const handleTabChange = (tabValue: string) => {
    if (tabValue !== tab) {
      history.replace({
        pathname: getEntityDetailsPath(
          EntityType.PIPELINE,
          pipelineFQN,
          tabValue
        ),
      });
    }
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = createTagObject(selectedTags);

    if (updatedTags && pipelineDetails) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedTopic = { ...pipelineDetails, tags: updatedTags };
      await settingsUpdateHandler(updatedTopic);
    }
  };

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) => !isSoftDelete && history.push('/'),
    []
  );

  useEffect(() => {
    getEntityFeedCount();
  }, []);

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);

    const tabs = pipelineClassBase.getPipelineDetailPageTabs({
      feedCount,
      getEntityFeedCount,
      handleFeedCount,
      onExtensionUpdate,
      pipelineDetails,
      pipelineFQN,
      viewAllPermission,
      editAllPermission,
      editLineagePermission,
      editCustomAttributePermission,
      deleted: Boolean(pipelineDetails.deleted),
      fetchPipeline,
      tab,
      labelMap: tabLabelMap,
    });

    return getDetailsTabWithNewLabel(
      tabs,
      customizedPage?.tabs,
      EntityTabs.TASKS
    );
  }, [
    description,
    feedCount.totalCount,
    deleted,
    owners,
    entityName,
    pipelineFQN,
    pipelineDetails,
    handleFeedCount,
    handleTagSelection,
    onExtensionUpdate,
    onDescriptionUpdate,
    editDescriptionPermission,
    editTagsPermission,
    editGlossaryTermsPermission,
    editLineagePermission,
    editCustomAttributePermission,
    viewAllPermission,
    editAllPermission,
  ]);

  const toggleTabExpanded = () => {
    setIsTabExpanded(!isTabExpanded);
  };

  const isExpandViewSupported = useMemo(
    () => checkIfExpandViewSupported(tabs[0], tab, PageType.Pipeline),
    [tabs[0], tab]
  );

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.pipeline'),
      })}>
      <Row gutter={[0, 12]}>
        <Col span={24}>
          <DataAssetsHeader
            isDqAlertSupported
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            afterDomainUpdateAction={updatePipelineDetailsState}
            dataAsset={pipelineDetails}
            entityType={EntityType.PIPELINE}
            openTaskCount={feedCount.openTaskCount}
            permissions={pipelinePermissions}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onFollowClick={followPipeline}
            onOwnerUpdate={onOwnerUpdate}
            onRestoreDataAsset={handleRestorePipeline}
            onTierUpdate={onTierUpdate}
            onUpdateVote={onUpdateVote}
            onVersionClick={versionHandler}
          />
        </Col>
        <GenericProvider<Pipeline>
          customizedPage={customizedPage}
          data={pipelineDetails}
          isTabExpanded={isTabExpanded}
          permissions={pipelinePermissions}
          type={EntityType.PIPELINE}
          onUpdate={settingsUpdateHandler}>
          <Col className="entity-details-page-tabs" span={24}>
            <Tabs
              activeKey={tab}
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

      <LimitWrapper resource="pipeline">
        <></>
      </LimitWrapper>
    </PageLayoutV1>
  );
};

export default withActivityFeed<PipeLineDetailsProp>(PipelineDetails);
