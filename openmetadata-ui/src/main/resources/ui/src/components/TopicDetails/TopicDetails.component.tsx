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

import { EntityTags } from 'Models';
import React, { useEffect, useState } from 'react';
import { getTeamDetailsPath } from '../../constants/constants';
import { Topic } from '../../generated/entity/data/topic';
import { User } from '../../generated/entity/teams/user';
import { LabelType, State } from '../../generated/type/tagLabel';
import { useAuth } from '../../hooks/authHooks';
import { getCurrentUserId, getUserTeams } from '../../utils/CommonUtils';
import { getEntityFieldThreadCounts } from '../../utils/FeedUtils';
import { bytesToSize } from '../../utils/StringsUtils';
import { getTagsWithoutTier } from '../../utils/TableUtils';
import ActivityFeedList from '../ActivityFeed/ActivityFeedList/ActivityFeedList';
import ActivityThreadPanel from '../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import TabsPane from '../common/TabsPane/TabsPane';
import PageContainer from '../containers/PageContainer';
import ManageTabComponent from '../ManageTab/ManageTab.component';
import SchemaEditor from '../schema-editor/SchemaEditor';
import { TopicDetailsProps } from './TopicDetails.interface';

const TopicDetails: React.FC<TopicDetailsProps> = ({
  users,
  topicDetails,
  partitions,
  cleanupPolicies,
  maximumMessageSize,
  replicationFactor,
  retentionSize,
  schemaText,
  schemaType,
  topicTags,
  activeTab,
  entityName,
  owner,
  description,
  tier,
  followers,
  slashedTopicName,
  setActiveTabHandler,
  settingsUpdateHandler,
  followTopicHandler,
  unfollowTopicHandler,
  descriptionUpdateHandler,
  tagUpdateHandler,
  version,
  versionHandler,
  deleted,
  entityThread,
  isentityThreadLoading,
  postFeedHandler,
  feedCount,
  entityFieldThreadCount,
  createThread,
}: TopicDetailsProps) => {
  const { isAuthDisabled } = useAuth();
  const [isEdit, setIsEdit] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [threadLink, setThreadLink] = useState<string>('');
  const hasEditAccess = () => {
    if (owner?.type === 'user') {
      return owner.id === getCurrentUserId();
    } else {
      return getUserTeams().some((team) => team.id === owner?.id);
    }
  };
  const setFollowersData = (followers: Array<User>) => {
    setIsFollowing(
      followers.some(({ id }: { id: string }) => id === getCurrentUserId())
    );
    setFollowersCount(followers?.length);
  };

  const getConfigDetails = () => {
    return [
      { key: 'Partitions', value: `${partitions} partitions` },
      {
        key: 'Replication Factor',
        value: `${replicationFactor} replication factor`,
      },
      {
        key: 'Retention Size',
        value: `${bytesToSize(retentionSize)} retention size`,
      },
      {
        key: 'Clean-up Policies',
        value: `${cleanupPolicies.join(', ')} clean-up policies`,
      },
      {
        key: 'Max Message Size',
        value: `${bytesToSize(maximumMessageSize)} maximum size`,
      },
    ];
  };

  const getConfigObject = () => {
    return {
      Partitions: partitions,
      'Replication Factor': replicationFactor,
      'Retention Size': retentionSize,
      'CleanUp Policies': cleanupPolicies,
      'Max Message Size': maximumMessageSize,
    };
  };
  const tabs = [
    {
      name: 'Schema',
      icon: {
        alt: 'schema',
        name: 'icon-schema',
        title: 'Schema',
        selectedName: 'icon-schemacolor',
      },
      isProtected: false,
      position: 1,
    },
    {
      name: `Activity Feed (${feedCount})`,
      icon: {
        alt: 'activity_feed',
        name: 'activity_feed',
        title: 'Activity Feed',
        selectedName: 'activity-feed-color',
      },
      isProtected: false,
      position: 2,
    },
    {
      name: 'Config',
      icon: {
        alt: 'config',
        name: 'icon-config',
        title: 'Config',
        selectedName: 'icon-configcolor',
      },
      isProtected: false,
      position: 3,
    },
    {
      name: 'Manage',
      icon: {
        alt: 'manage',
        name: 'icon-manage',
        title: 'Manage',
        selectedName: 'icon-managecolor',
      },
      isProtected: true,
      isHidden: deleted,
      protectedState: !owner || hasEditAccess(),
      position: 4,
    },
  ];
  const extraInfo = [
    {
      key: 'Owner',
      value:
        owner?.type === 'team'
          ? getTeamDetailsPath(owner?.name || '')
          : owner?.name || '',
      placeholderText: owner?.displayName || '',
      isLink: owner?.type === 'team',
      openInNewTab: false,
    },
    { key: 'Tier', value: tier?.tagFQN ? tier.tagFQN.split('.')[1] : '' },
    ...getConfigDetails(),
  ];

  const onDescriptionEdit = (): void => {
    setIsEdit(true);
  };
  const onCancel = () => {
    setIsEdit(false);
  };

  const onDescriptionUpdate = (updatedHTML: string) => {
    if (description !== updatedHTML) {
      const updatedTopicDetails = {
        ...topicDetails,
        description: updatedHTML,
      };
      descriptionUpdateHandler(updatedTopicDetails);
      setIsEdit(false);
    } else {
      setIsEdit(false);
    }
  };

  const onSettingsUpdate = (newOwner?: Topic['owner'], newTier?: string) => {
    if (newOwner || newTier) {
      const tierTag: Topic['tags'] = newTier
        ? [
            ...getTagsWithoutTier(topicDetails.tags as Array<EntityTags>),
            {
              tagFQN: newTier,
              labelType: LabelType.Manual,
              state: State.Confirmed,
            },
          ]
        : topicDetails.tags;
      const updatedTopicDetails = {
        ...topicDetails,
        owner: newOwner
          ? {
              ...topicDetails.owner,
              ...newOwner,
            }
          : topicDetails.owner,
        tags: tierTag,
      };

      return settingsUpdateHandler(updatedTopicDetails);
    } else {
      return Promise.reject();
    }
  };

  const followTopic = () => {
    if (isFollowing) {
      setFollowersCount((preValu) => preValu - 1);
      setIsFollowing(false);
      unfollowTopicHandler();
    } else {
      setFollowersCount((preValu) => preValu + 1);
      setIsFollowing(true);
      followTopicHandler();
    }
  };

  const getInfoBadge = (infos: Array<Record<string, string | number>>) => {
    return (
      <div className="tw-flex tw-justify-between">
        <div className="tw-flex tw-gap-3">
          {infos.map((info, index) => (
            <div className="tw-mt-4" key={index}>
              <span className="tw-py-1.5 tw-px-2 tw-rounded-l tw-bg-tag ">
                {info.key}
              </span>
              <span className="tw-py-1.5 tw-px-2 tw-bg-primary-lite tw-font-normal tw-rounded-r">
                {info.value}
              </span>
            </div>
          ))}
        </div>
        <div />
      </div>
    );
  };

  const onTagUpdate = (selectedTags?: Array<string>) => {
    if (selectedTags) {
      const prevTags =
        topicDetails?.tags?.filter((tag) =>
          selectedTags.includes(tag?.tagFQN as string)
        ) || [];
      const newTags = selectedTags
        .filter((tag) => {
          return !prevTags?.map((prevTag) => prevTag.tagFQN).includes(tag);
        })
        .map((tag) => ({
          labelType: LabelType.Manual,
          state: State.Confirmed,
          tagFQN: tag,
        }));
      const updatedTags = [...prevTags, ...newTags];
      const updatedTopic = { ...topicDetails, tags: updatedTags };
      tagUpdateHandler(updatedTopic);
    }
  };

  const onThreadLinkSelect = (link: string) => {
    setThreadLink(link);
  };

  const onThreadPanelClose = () => {
    setThreadLink('');
  };

  useEffect(() => {
    if (isAuthDisabled && users.length && followers.length) {
      setFollowersData(followers);
    }
  }, [users, followers]);

  useEffect(() => {
    setFollowersData(followers);
  }, [followers]);

  return (
    <PageContainer>
      <div className="tw-px-6 tw-w-full tw-h-full tw-flex tw-flex-col">
        <EntityPageInfo
          isTagEditable
          deleted={deleted}
          entityFieldThreads={getEntityFieldThreadCounts(
            'tags',
            entityFieldThreadCount
          )}
          entityName={entityName}
          extraInfo={extraInfo}
          followHandler={followTopic}
          followers={followersCount}
          followersList={followers}
          hasEditAccess={hasEditAccess()}
          isFollowing={isFollowing}
          owner={owner}
          tags={topicTags}
          tagsHandler={onTagUpdate}
          tier={tier ?? ''}
          titleLinks={slashedTopicName}
          version={version}
          versionHandler={versionHandler}
          onThreadLinkSelect={onThreadLinkSelect}
        />
        <div className="tw-mt-4 tw-flex tw-flex-col tw-flex-grow">
          <TabsPane
            activeTab={activeTab}
            setActiveTab={setActiveTabHandler}
            tabs={tabs}
          />

          <div className="tw-bg-white tw-flex-grow tw--mx-6 tw-px-7 tw-py-4">
            {activeTab === 1 && (
              <>
                <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-w-full">
                  <div className="tw-col-span-full">
                    <Description
                      description={description}
                      entityFieldThreads={getEntityFieldThreadCounts(
                        'description',
                        entityFieldThreadCount
                      )}
                      entityName={entityName}
                      hasEditAccess={hasEditAccess()}
                      isEdit={isEdit}
                      isReadOnly={deleted}
                      owner={owner}
                      onCancel={onCancel}
                      onDescriptionEdit={onDescriptionEdit}
                      onDescriptionUpdate={onDescriptionUpdate}
                      onThreadLinkSelect={onThreadLinkSelect}
                    />
                  </div>
                </div>
                {getInfoBadge([{ key: 'Schema', value: schemaType }])}
                <div className="tw-my-4 tw-border tw-border-main tw-rounded-md tw-py-4">
                  <SchemaEditor value={schemaText} />
                </div>
                {threadLink ? (
                  <ActivityThreadPanel
                    createThread={createThread}
                    open={Boolean(threadLink)}
                    postFeedHandler={postFeedHandler}
                    threadLink={threadLink}
                    onCancel={onThreadPanelClose}
                  />
                ) : null}
              </>
            )}
            {activeTab === 2 && (
              <div
                className="tw-py-4 tw-px-7 tw-grid tw-grid-cols-3 entity-feed-list tw-bg-body-main tw--mx-7 tw--my-4 tw-h-screen"
                id="activityfeed">
                <div />
                <ActivityFeedList
                  isEntityFeed
                  withSidePanel
                  className=""
                  feedList={entityThread}
                  isLoading={isentityThreadLoading}
                  postFeedHandler={postFeedHandler}
                />
                <div />
              </div>
            )}
            {activeTab === 3 && (
              <div>
                <SchemaEditor value={JSON.stringify(getConfigObject())} />
              </div>
            )}
            {activeTab === 4 && !deleted && (
              <div>
                <ManageTabComponent
                  currentTier={tier?.tagFQN}
                  currentUser={owner?.id}
                  hasEditAccess={hasEditAccess()}
                  onSave={onSettingsUpdate}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default TopicDetails;
