import { AxiosResponse } from 'axios';
import { compare } from 'fast-json-patch';
import { ColumnTags, TableDetail, Topic, User } from 'Models';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import AppState from '../../AppState';
import { getServiceById } from '../../axiosAPIs/serviceAPI';
import {
  addFollower,
  getTopicByFqn,
  patchTopicDetails,
  removeFollower,
} from '../../axiosAPIs/topicsAPI';
import Description from '../../components/common/description/Description';
import EntityPageInfo from '../../components/common/entityPageInfo/EntityPageInfo';
import TabsPane from '../../components/common/TabsPane/TabsPane';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainer from '../../components/containers/PageContainer';
import Loader from '../../components/Loader/Loader';
import ManageTab from '../../components/my-data-details/ManageTab';
import SchemaEditor from '../../components/schema-editor/SchemaEditor';
import { getServiceDetailsPath } from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import { useAuth } from '../../hooks/authHooks';
import {
  addToRecentViewed,
  getCurrentUserId,
  getUserTeams,
} from '../../utils/CommonUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { bytesToSize } from '../../utils/StringsUtils';
import {
  getOwnerFromId,
  getTagsWithoutTier,
  getTierFromTableTags,
} from '../../utils/TableUtils';
import { getTagCategories, getTaglist } from '../../utils/TagsUtils';

const MyTopicDetailPage = () => {
  const USERId = getCurrentUserId();

  const { isAuthDisabled } = useAuth();

  const [tagList, setTagList] = useState<Array<string>>([]);
  const { topicFQN } = useParams() as Record<string, string>;
  const [topicDetails, setTopicDetails] = useState<Topic>({} as Topic);
  const [topicId, setTopicId] = useState<string>('');
  const [isLoading, setLoading] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');
  const [followers, setFollowers] = useState<Array<User>>([]);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [owner, setOwner] = useState<TableDetail['owner']>();
  const [tier, setTier] = useState<string>();
  const [schemaType, setSchemaType] = useState<string>('');
  const [tags, setTags] = useState<Array<ColumnTags>>([]);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [partitions, setPartitions] = useState<number>(0);
  const [cleanupPolicies, setCleanupPolicies] = useState<Array<string>>([]);
  const [maximumMessageSize, setMaximumMessageSize] = useState<number>(0);
  const [replicationFactor, setReplicationFactor] = useState<number>(0);
  const [retentionSize, setRetentionSize] = useState<number>(0);

  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [schemaText, setSchemaText] = useState<string>('{}');
  const [slashedTopicName, setSlashedTopicName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  const hasEditAccess = () => {
    if (owner?.type === 'user') {
      return owner.id === getCurrentUserId();
    } else {
      return getUserTeams().some((team) => team.id === owner?.id);
    }
  };
  const tabs = [
    {
      name: 'Schema',
      icon: {
        alt: 'schema',
        name: 'icon-schema',
        title: 'Schema',
      },
      isProtected: false,
      position: 1,
    },
    {
      name: 'Manage',
      icon: {
        alt: 'manage',
        name: 'icon-manage',
        title: 'Manage',
      },
      isProtected: true,
      protectedState: !owner || hasEditAccess(),
      position: 2,
    },
    {
      name: 'Config',
      icon: {
        alt: 'config',
        name: 'icon-config',
        title: 'Config',
      },
      isProtected: false,
      position: 3,
    },
  ];
  const fetchTags = () => {
    getTagCategories().then((res) => {
      if (res.data) {
        setTagList(getTaglist(res.data));
      }
    });
  };

  const setFollowersData = (followers: Array<User>) => {
    // need to check if already following or not with logedIn user id
    setIsFollowing(followers.some(({ id }: { id: string }) => id === USERId));
    setFollowersCount(followers?.length);
  };

  const fetchTopicDetail = (topicFQN: string) => {
    setLoading(true);
    getTopicByFqn(topicFQN, ['owner', 'service', 'followers', 'tags']).then(
      (res: AxiosResponse) => {
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
        } = res.data;
        setTopicDetails(res.data);
        setTopicId(id);
        setDescription(description ?? '');
        setSchemaType(schemaType);
        setFollowers(followers);
        setFollowersData(followers);
        setOwner(getOwnerFromId(owner?.id));
        setTier(getTierFromTableTags(tags));
        setTags(getTagsWithoutTier(tags));
        setSchemaText(schemaText);
        setPartitions(partitions);
        setCleanupPolicies(cleanupPolicies);
        setMaximumMessageSize(maximumMessageSize);
        setReplicationFactor(replicationFactor);
        setRetentionSize(retentionSize);
        getServiceById('messagingServices', service?.id).then(
          (serviceRes: AxiosResponse) => {
            setSlashedTopicName([
              {
                name: serviceRes.data.name,
                url: serviceRes.data.name
                  ? getServiceDetailsPath(
                      serviceRes.data.name,
                      serviceRes.data.serviceType
                    )
                  : '',
                imgSrc: serviceRes.data.serviceType
                  ? serviceTypeLogo(serviceRes.data.serviceType)
                  : undefined,
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
              serviceType: serviceRes.data.serviceType,
              timestamp: 0,
            });
          }
        );
        setLoading(false);
      }
    );
  };

  const followTopic = (): void => {
    if (isFollowing) {
      removeFollower(topicId, USERId).then(() => {
        setFollowersCount((preValu) => preValu - 1);
        setIsFollowing(false);
      });
    } else {
      addFollower(topicId, USERId).then(() => {
        setFollowersCount((preValu) => preValu + 1);
        setIsFollowing(true);
      });
    }
  };

  const onDescriptionUpdate = (updatedHTML: string) => {
    const updatedTopic = { ...topicDetails, description: updatedHTML };

    const jsonPatch = compare(topicDetails, updatedTopic);
    patchTopicDetails(topicId, jsonPatch).then((res: AxiosResponse) => {
      setDescription(res.data.description);
    });
    setIsEdit(false);
  };
  const onDescriptionEdit = (): void => {
    setIsEdit(true);
  };
  const onCancel = () => {
    setIsEdit(false);
  };

  const onSettingsUpdate = (
    newOwner?: TableDetail['owner'],
    newTier?: TableDetail['tier']
  ): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      if (newOwner || newTier) {
        const tierTag: TableDetail['tags'] = newTier
          ? [
              ...getTagsWithoutTier(topicDetails.tags),
              { tagFQN: newTier, labelType: 'Manual', state: 'Confirmed' },
            ]
          : topicDetails.tags;
        const updatedTopic = {
          ...topicDetails,
          owner: newOwner
            ? { ...topicDetails.owner, ...newOwner }
            : topicDetails.owner,
          tags: tierTag,
        };
        const jsonPatch = compare(topicDetails, updatedTopic);
        patchTopicDetails(topicId, jsonPatch)
          .then((res: AxiosResponse) => {
            setTopicDetails(res.data);
            setOwner(getOwnerFromId(res.data.owner?.id));
            setTier(getTierFromTableTags(res.data.tags));
            resolve();
          })
          .catch(() => reject());
      } else {
        reject();
      }
    });
  };

  const onTagUpdate = (selectedTags?: Array<string>) => {
    if (selectedTags) {
      const prevTags = topicDetails.tags.filter((tag) =>
        selectedTags.includes(tag.tagFQN)
      );
      const newTags: Array<ColumnTags> = selectedTags
        .filter((tag) => {
          return !prevTags.map((prevTag) => prevTag.tagFQN).includes(tag);
        })
        .map((tag) => ({
          labelType: 'Manual',
          state: 'Confirmed',
          tagFQN: tag,
        }));
      const updatedTags = [...prevTags, ...newTags];
      const updatedTopic = { ...topicDetails, tags: updatedTags };
      const jsonPatch = compare(topicDetails, updatedTopic);
      patchTopicDetails(topicId, jsonPatch).then((res: AxiosResponse) => {
        setTier(getTierFromTableTags(res.data.tags));
        setTags(getTagsWithoutTier(res.data.tags));
      });
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

  const getConfigDetails = () => {
    return [
      { key: 'Partitions', value: partitions },
      { key: 'Replication Factor', value: replicationFactor },
      { key: 'Retention Size', value: bytesToSize(retentionSize) },
      { key: 'CleanUp Policies', value: cleanupPolicies.join(',') },
      { key: 'Max Message Size', value: bytesToSize(maximumMessageSize) },
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

  useEffect(() => {
    fetchTopicDetail(topicFQN);
  }, [topicFQN]);

  useEffect(() => {
    if (isAuthDisabled && AppState.users.length && followers.length) {
      setFollowersData(followers);
    }
  }, [AppState.users, followers]);

  useEffect(() => {
    fetchTags();
  }, []);

  return (
    <PageContainer>
      {isLoading ? (
        <Loader />
      ) : (
        <div className="tw-px-4 w-full">
          <EntityPageInfo
            isTagEditable
            extraInfo={[
              { key: 'Owner', value: owner?.name || '' },
              { key: 'Tier', value: tier ? tier.split('.')[1] : '' },
              ...getConfigDetails(),
            ]}
            followers={followersCount}
            followHandler={followTopic}
            isFollowing={isFollowing}
            tagList={tagList}
            tags={tags}
            tagsHandler={onTagUpdate}
            tier={tier ?? ''}
            titleLinks={slashedTopicName}
          />
          <div className="tw-block tw-mt-1">
            <TabsPane
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              tabs={tabs}
            />

            <div className="tw-bg-white tw--mx-4 tw-p-4 tw-min-h-tab">
              {activeTab === 1 && (
                <>
                  <div className="tw-grid tw-grid-cols-4 tw-gap-4 w-full">
                    <div className="tw-col-span-full">
                      <Description
                        description={description}
                        hasEditAccess={hasEditAccess()}
                        isEdit={isEdit}
                        owner={owner}
                        onCancel={onCancel}
                        onDescriptionEdit={onDescriptionEdit}
                        onDescriptionUpdate={onDescriptionUpdate}
                      />
                    </div>
                  </div>
                  {getInfoBadge([{ key: 'Schema', value: schemaType }])}
                  <div className="tw-my-4 tw-border tw-border-main tw-rounded-md tw-py-4">
                    <SchemaEditor value={schemaText} />
                  </div>
                </>
              )}
              {activeTab === 2 && (
                <ManageTab
                  currentTier={tier}
                  currentUser={owner?.id}
                  hasEditAccess={hasEditAccess()}
                  onSave={onSettingsUpdate}
                />
              )}
              {activeTab === 3 && (
                <SchemaEditor value={JSON.stringify(getConfigObject())} />
              )}
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default MyTopicDetailPage;
