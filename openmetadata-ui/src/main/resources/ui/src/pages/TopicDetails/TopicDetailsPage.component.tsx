/*
 *  Copyright 2021 Collate
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

import { AxiosError, AxiosResponse } from 'axios';
import { compare } from 'fast-json-patch';
import { observer } from 'mobx-react';
import { EntityTags, TableDetail } from 'Models';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import AppState from '../../AppState';
import {
  addFollower,
  getTopicByFqn,
  patchTopicDetails,
  removeFollower,
} from '../../axiosAPIs/topicsAPI';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import Loader from '../../components/Loader/Loader';
import TopicDetails from '../../components/TopicDetails/TopicDetails.component';
import {
  getServiceDetailsPath,
  getTopicDetailsPath,
  getVersionPath,
} from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { Topic } from '../../generated/entity/data/topic';
import { User } from '../../generated/entity/teams/user';
import { TagLabel } from '../../generated/type/tagLabel';
import useToastContext from '../../hooks/useToastContext';
import { addToRecentViewed, getCurrentUserId } from '../../utils/CommonUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import {
  getOwnerFromId,
  getTagsWithoutTier,
  getTierTags,
} from '../../utils/TableUtils';
import { getTagCategories, getTaglist } from '../../utils/TagsUtils';
import {
  getCurrentTopicTab,
  topicDetailsTabs,
} from '../../utils/TopicDetailsUtils';

const TopicDetailsPage: FunctionComponent = () => {
  const USERId = getCurrentUserId();
  const showToast = useToastContext();
  const history = useHistory();

  const [tagList, setTagList] = useState<Array<string>>([]);
  const { topicFQN, tab } = useParams() as Record<string, string>;
  const [topicDetails, setTopicDetails] = useState<Topic>({} as Topic);
  const [topicId, setTopicId] = useState<string>('');
  const [isLoading, setLoading] = useState<boolean>(true);
  const [description, setDescription] = useState<string>('');
  const [followers, setFollowers] = useState<Array<User>>([]);
  const [owner, setOwner] = useState<TableDetail['owner']>();
  const [tier, setTier] = useState<TagLabel>();
  const [schemaType, setSchemaType] = useState<string>('');
  const [tags, setTags] = useState<Array<EntityTags>>([]);
  const [activeTab, setActiveTab] = useState<number>(getCurrentTopicTab(tab));
  const [partitions, setPartitions] = useState<number>(0);
  const [cleanupPolicies, setCleanupPolicies] = useState<Array<string>>([]);
  const [maximumMessageSize, setMaximumMessageSize] = useState<number>(0);
  const [replicationFactor, setReplicationFactor] = useState<number>(0);
  const [retentionSize, setRetentionSize] = useState<number>(0);
  const [name, setName] = useState<string>('');

  const [schemaText, setSchemaText] = useState<string>('{}');
  const [slashedTopicName, setSlashedTopicName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [currentVersion, setCurrentVersion] = useState<string>();

  const activeTabHandler = (tabValue: number) => {
    const currentTabIndex = tabValue - 1;
    if (topicDetailsTabs[currentTabIndex].path !== tab) {
      setActiveTab(getCurrentTopicTab(topicDetailsTabs[currentTabIndex].path));
      history.push({
        pathname: getTopicDetailsPath(
          topicFQN,
          topicDetailsTabs[currentTabIndex].path
        ),
      });
    }
  };

  useEffect(() => {
    if (topicDetailsTabs[activeTab - 1].path !== tab) {
      setActiveTab(getCurrentTopicTab(tab));
    }
  }, [tab]);

  const saveUpdatedTopicData = (updatedData: Topic): Promise<AxiosResponse> => {
    const jsonPatch = compare(topicDetails, updatedData);

    return patchTopicDetails(
      topicId,
      jsonPatch
    ) as unknown as Promise<AxiosResponse>;
  };

  const fetchTags = () => {
    getTagCategories().then((res) => {
      setTagList(getTaglist(res.data));
    });
  };

  const fetchTopicDetail = (topicFQN: string) => {
    setLoading(true);
    getTopicByFqn(topicFQN, ['owner', 'followers', 'tags'])
      .then((res: AxiosResponse) => {
        const {
          id,
          description,
          followers,
          fullyQualifiedName,
          name,
          schemaType,
          schemaText,
          service,
          tags,
          owner,
          partitions,
          cleanupPolicies,
          maximumMessageSize,
          replicationFactor,
          retentionSize,
          serviceType,
          version,
        } = res.data;
        setName(name);
        setTopicDetails(res.data);
        setTopicId(id);
        setCurrentVersion(version);
        setDescription(description ?? '');
        setSchemaType(schemaType);
        setFollowers(followers);
        setOwner(getOwnerFromId(owner?.id));
        setTier(getTierTags(tags));
        setTags(getTagsWithoutTier(tags));
        setSchemaText(schemaText);
        setPartitions(partitions);
        setCleanupPolicies(cleanupPolicies);
        setMaximumMessageSize(maximumMessageSize);
        setReplicationFactor(replicationFactor);
        setRetentionSize(retentionSize);
        setSlashedTopicName([
          {
            name: service.name,
            url: service.name
              ? getServiceDetailsPath(
                  service.name,
                  serviceType,
                  ServiceCategory.MESSAGING_SERVICES
                )
              : '',
            imgSrc: serviceType ? serviceTypeLogo(serviceType) : undefined,
          },
          {
            name: name,
            url: '',
            activeTitle: true,
          },
        ]);

        addToRecentViewed({
          entityType: EntityType.TOPIC,
          fqn: fullyQualifiedName,
          serviceType: serviceType,
          timestamp: 0,
        });
        setLoading(false);
      })
      .catch((err: AxiosError) => {
        const errMsg = err.message || 'Error while fetching topic details';
        showToast({
          variant: 'error',
          body: errMsg,
        });
        setLoading(false);
      });
  };

  const followTopic = () => {
    addFollower(topicId, USERId).then((res: AxiosResponse) => {
      const { newValue } = res.data.changeDescription.fieldsAdded[0];

      setFollowers([...followers, ...newValue]);
    });
  };
  const unfollowTopic = () => {
    removeFollower(topicId, USERId).then((res: AxiosResponse) => {
      const { oldValue } = res.data.changeDescription.fieldsDeleted[0];

      setFollowers(
        followers.filter((follower) => follower.id !== oldValue[0].id)
      );
    });
  };

  const descriptionUpdateHandler = (updatedTopic: Topic) => {
    saveUpdatedTopicData(updatedTopic).then((res: AxiosResponse) => {
      const { description, version } = res.data;
      setCurrentVersion(version);
      setTopicDetails(res.data);
      setDescription(description);
    });
  };

  const settingsUpdateHandler = (updatedTopic: Topic): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      saveUpdatedTopicData(updatedTopic)
        .then((res) => {
          setTopicDetails(res.data);
          setCurrentVersion(res.data.version);
          setOwner(getOwnerFromId(res.data.owner?.id));
          setTier(getTierTags(res.data.tags));
          resolve();
        })
        .catch(() => reject());
    });
  };

  const onTagUpdate = (updatedTopic: Topic) => {
    saveUpdatedTopicData(updatedTopic).then((res: AxiosResponse) => {
      setTier(getTierTags(res.data.tags));
      setCurrentVersion(res.data.version);
      setTags(getTagsWithoutTier(res.data.tags));
    });
  };

  const versionHandler = () => {
    history.push(
      getVersionPath(EntityType.TOPIC, topicFQN, currentVersion as string)
    );
  };

  useEffect(() => {
    fetchTopicDetail(topicFQN);
  }, [topicFQN]);

  useEffect(() => {
    fetchTags();
  }, []);

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : (
        <TopicDetails
          activeTab={activeTab}
          cleanupPolicies={cleanupPolicies}
          description={description}
          descriptionUpdateHandler={descriptionUpdateHandler}
          entityName={name}
          followTopicHandler={followTopic}
          followers={followers}
          maximumMessageSize={maximumMessageSize}
          owner={owner}
          partitions={partitions}
          replicationFactor={replicationFactor}
          retentionSize={retentionSize}
          schemaText={schemaText}
          schemaType={schemaType}
          setActiveTabHandler={activeTabHandler}
          settingsUpdateHandler={settingsUpdateHandler}
          slashedTopicName={slashedTopicName}
          tagList={tagList}
          tagUpdateHandler={onTagUpdate}
          tier={tier as TagLabel}
          topicDetails={topicDetails}
          topicTags={tags}
          unfollowTopicHandler={unfollowTopic}
          users={AppState.users}
          version={currentVersion}
          versionHandler={versionHandler}
        />
      )}
    </>
  );
};

export default observer(TopicDetailsPage);
