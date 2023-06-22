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

import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import TopicDetails from 'components/TopicDetails/TopicDetails.component';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { compare } from 'fast-json-patch';
import { isUndefined, omitBy, toString } from 'lodash';
import { observer } from 'mobx-react';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { postThread } from 'rest/feedsAPI';
import {
  addFollower,
  getTopicByFqn,
  patchTopicDetails,
  removeFollower,
} from 'rest/topicsAPI';
import { getVersionPath } from '../../constants/constants';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Topic } from '../../generated/entity/data/topic';
import { EntityFieldThreadCount } from '../../interface/feed.interface';
import {
  addToRecentViewed,
  getCurrentUserId,
  getEntityMissingError,
  getFeedCounts,
  sortTagsCaseInsensitive,
} from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const TopicDetailsPage: FunctionComponent = () => {
  const { t } = useTranslation();
  const USERId = getCurrentUserId();
  const history = useHistory();
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const { topicFQN } = useParams<{ topicFQN: string }>();
  const [topicDetails, setTopicDetails] = useState<Topic>({} as Topic);
  const [isLoading, setLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState(false);

  const [feedCount, setFeedCount] = useState<number>(0);
  const [entityFieldThreadCount, setEntityFieldThreadCount] = useState<
    EntityFieldThreadCount[]
  >([]);
  const [entityFieldTaskCount, setEntityFieldTaskCount] = useState<
    EntityFieldThreadCount[]
  >([]);

  const [topicPermissions, setTopicPermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const getEntityFeedCount = () => {
    getFeedCounts(
      EntityType.TOPIC,
      topicFQN,
      setEntityFieldThreadCount,
      setEntityFieldTaskCount,
      setFeedCount
    );
  };

  const { id: topicId, version: currentVersion } = topicDetails;

  const saveUpdatedTopicData = (updatedData: Topic) => {
    const jsonPatch = compare(omitBy(topicDetails, isUndefined), updatedData);

    return patchTopicDetails(topicId, jsonPatch);
  };

  const onTopicUpdate = async (updatedData: Topic, key: keyof Topic) => {
    try {
      const res = await saveUpdatedTopicData(updatedData);

      setTopicDetails((previous) => {
        if (key === 'tags') {
          return {
            ...previous,
            version: res.version,
            [key]: sortTagsCaseInsensitive(res.tags ?? []),
          };
        }

        return {
          ...previous,
          version: res.version,
          [key]: res[key],
        };
      });
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchResourcePermission = async (entityFqn: string) => {
    setLoading(true);
    try {
      const permissions = await getEntityPermissionByFqn(
        ResourceEntity.TOPIC,
        entityFqn
      );
      setTopicPermissions(permissions);
    } catch (error) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: entityFqn,
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchTopicDetail = async (topicFQN: string) => {
    setLoading(true);
    try {
      const res = await getTopicByFqn(topicFQN, [
        TabSpecificField.OWNER,
        TabSpecificField.FOLLOWERS,
        TabSpecificField.TAGS,
        TabSpecificField.EXTENSION,
      ]);
      const { id, fullyQualifiedName, serviceType } = res;

      setTopicDetails(res);

      addToRecentViewed({
        displayName: getEntityName(res),
        entityType: EntityType.TOPIC,
        fqn: fullyQualifiedName ?? '',
        serviceType: serviceType,
        timestamp: 0,
        id: id,
      });
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        setIsError(true);
      } else {
        showErrorToast(
          error as AxiosError,
          t('server.entity-details-fetch-error', {
            entityType: t('label.pipeline'),
            entityName: topicFQN,
          })
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const followTopic = async () => {
    try {
      const res = await addFollower(topicId, USERId);
      const { newValue } = res.changeDescription.fieldsAdded[0];
      setTopicDetails((prev) => ({
        ...prev,
        followers: [...(prev?.followers ?? []), ...newValue],
      }));
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(topicDetails),
        })
      );
    }
  };

  const unFollowTopic = async () => {
    try {
      const res = await removeFollower(topicId, USERId);
      const { oldValue } = res.changeDescription.fieldsDeleted[0];
      setTopicDetails((prev) => ({
        ...prev,
        followers: (prev?.followers ?? []).filter(
          (follower) => follower.id !== oldValue[0].id
        ),
      }));
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: getEntityName(topicDetails),
        })
      );
    }
  };

  const versionHandler = () => {
    currentVersion &&
      history.push(
        getVersionPath(EntityType.TOPIC, topicFQN, toString(currentVersion))
      );
  };

  const createThread = async (data: CreateThread) => {
    try {
      await postThread(data);
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.create-entity-error', {
          entity: t('label.conversation'),
        })
      );
    }
  };

  useEffect(() => {
    fetchResourcePermission(topicFQN);
  }, [topicFQN]);

  useEffect(() => {
    if (topicPermissions.ViewAll || topicPermissions.ViewBasic) {
      fetchTopicDetail(topicFQN);
      getEntityFeedCount();
    }
  }, [topicPermissions, topicFQN]);

  if (isLoading) {
    return <Loader />;
  }
  if (isError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError('topic', topicFQN)}
      </ErrorPlaceHolder>
    );
  }
  if (!topicPermissions.ViewAll && !topicPermissions.ViewBasic) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <TopicDetails
      createThread={createThread}
      entityFieldTaskCount={entityFieldTaskCount}
      entityFieldThreadCount={entityFieldThreadCount}
      feedCount={feedCount}
      followTopicHandler={followTopic}
      topicDetails={topicDetails}
      unFollowTopicHandler={unFollowTopic}
      versionHandler={versionHandler}
      onTopicUpdate={onTopicUpdate}
    />
  );
};

export default observer(TopicDetailsPage);
