import { AxiosResponse } from 'axios';
import { compare } from 'fast-json-patch';
import { isNil } from 'lodash';
import { ColumnTags, TableDetail } from 'Models';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  addFollower,
  getDashboardByFqn,
  patchDashboardDetails,
  removeFollower,
} from '../../axiosAPIs/dashboardAPI';
import { getServiceById } from '../../axiosAPIs/serviceAPI';
import Description from '../../components/common/description/Description';
import EntityPageInfo from '../../components/common/entityPageInfo/EntityPageInfo';
import TabsPane from '../../components/common/TabsPane/TabsPane';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainer from '../../components/containers/PageContainer';
import Loader from '../../components/Loader/Loader';
import ManageTab from '../../components/my-data-details/ManageTab';
import { getServiceDetailsPath } from '../../constants/constants';
import { Dashboard, TagLabel } from '../../generated/entity/data/dashboard';
import { getCurrentUserId, getUserTeams } from '../../utils/CommonUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import {
  getOwnerFromId,
  getTagsWithoutTier,
  getTierFromTableTags,
  getUsagePercentile,
} from '../../utils/TableUtils';
import { getTagCategories, getTaglist } from '../../utils/TagsUtils';

const MyDashBoardPage = () => {
  const USERId = getCurrentUserId();
  const [tagList, setTagList] = useState<Array<string>>([]);
  const { dashboardFQN } = useParams() as Record<string, string>;
  const [dashboardDetails, setDashboardDetails] = useState<Dashboard>(
    {} as Dashboard
  );
  const [dashboardId, setDashboardId] = useState<string>('');
  const [isLoading, setLoading] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');
  const [followers, setFollowers] = useState<number>(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [owner, setOwner] = useState<TableDetail['owner']>();
  const [tier, setTier] = useState<string>();
  const [tags, setTags] = useState<Array<ColumnTags>>([]);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [usage, setUsage] = useState('');
  const [weeklyUsageCount, setWeeklyUsageCount] = useState('');
  const [slashedDashboardName, setSlashedDashboardName] = useState<
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
      name: 'Details',
      icon: {
        alt: 'schema',
        name: 'icon-schema',
        title: 'Details',
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
  ];

  const extraInfo = [
    { key: 'Owner', value: owner?.name || '' },
    { key: 'Tier', value: tier ? tier.split('.')[1] : '' },
    { key: 'Usage', value: usage },
    { key: 'Queries', value: `${weeklyUsageCount} past week` },
  ];
  const fetchTags = () => {
    getTagCategories().then((res) => {
      if (res.data) {
        setTagList(getTaglist(res.data));
      }
    });
  };
  const fetchDashboardDetail = (dashboardFQN: string) => {
    setLoading(true);
    getDashboardByFqn(dashboardFQN, [
      'owner',
      'service',
      'followers',
      'tags',
      'usageSummary',
    ]).then((res: AxiosResponse) => {
      const {
        id,
        description,
        followers,
        service,
        tags,
        owner,
        usageSummary,
        displayName,
      } = res.data;
      setDashboardDetails(res.data);
      setDashboardId(id);
      setDescription(description ?? '');
      setFollowers(followers?.length);
      setOwner(getOwnerFromId(owner?.id));
      setTier(getTierFromTableTags(tags));
      setTags(getTagsWithoutTier(tags));
      setIsFollowing(followers.some(({ id }: { id: string }) => id === USERId));
      if (!isNil(usageSummary?.weeklyStats.percentileRank)) {
        const percentile = getUsagePercentile(
          usageSummary.weeklyStats.percentileRank
        );
        setUsage(percentile);
      } else {
        setUsage('--');
      }
      setWeeklyUsageCount(
        usageSummary?.weeklyStats.count.toLocaleString() || '--'
      );
      getServiceById('dashboardServices', service?.id).then(
        (serviceRes: AxiosResponse) => {
          setSlashedDashboardName([
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
              name: displayName,
              url: '',
              activeTitle: true,
            },
          ]);
        }
      );
      setLoading(false);
    });
  };

  const followDashboard = (): void => {
    if (isFollowing) {
      removeFollower(dashboardId, USERId).then(() => {
        setFollowers((preValu) => preValu - 1);
        setIsFollowing(false);
      });
    } else {
      addFollower(dashboardId, USERId).then(() => {
        setFollowers((preValu) => preValu + 1);
        setIsFollowing(true);
      });
    }
  };

  const onDescriptionUpdate = (updatedHTML: string) => {
    const updatedDashboard = { ...dashboardDetails, description: updatedHTML };

    const jsonPatch = compare(dashboardDetails, updatedDashboard);
    patchDashboardDetails(dashboardId, jsonPatch).then((res: AxiosResponse) => {
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
              ...getTagsWithoutTier(dashboardDetails.tags as ColumnTags[]),
              { tagFQN: newTier, labelType: 'Manual', state: 'Confirmed' },
            ]
          : (dashboardDetails.tags as ColumnTags[]);
        const updatedDashboard = {
          ...dashboardDetails,
          owner: newOwner
            ? { ...dashboardDetails.owner, ...newOwner }
            : dashboardDetails.owner,
          tags: tierTag,
        };
        const jsonPatch = compare(dashboardDetails, updatedDashboard);
        patchDashboardDetails(dashboardId, jsonPatch)
          .then((res: AxiosResponse) => {
            setDashboardDetails(res.data);
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
      const prevTags = dashboardDetails?.tags?.filter((tag) =>
        selectedTags.includes(tag?.tagFQN as string)
      );
      const newTags: Array<ColumnTags> = selectedTags
        .filter((tag) => {
          return !prevTags?.map((prevTag) => prevTag.tagFQN).includes(tag);
        })
        .map((tag) => ({
          labelType: 'Manual',
          state: 'Confirmed',
          tagFQN: tag,
        }));
      const updatedTags = [...(prevTags as TagLabel[]), ...newTags];
      const updatedDashboard = { ...dashboardDetails, tags: updatedTags };
      const jsonPatch = compare(dashboardDetails, updatedDashboard);
      patchDashboardDetails(dashboardId, jsonPatch).then(
        (res: AxiosResponse) => {
          setTier(getTierFromTableTags(res.data.tags));
          setTags(getTagsWithoutTier(res.data.tags));
        }
      );
    }
  };

  useEffect(() => {
    fetchDashboardDetail(dashboardFQN);
  }, [dashboardFQN]);

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
            extraInfo={extraInfo}
            followers={followers}
            followHandler={followDashboard}
            isFollowing={isFollowing}
            tagList={tagList}
            tags={tags}
            tagsHandler={onTagUpdate}
            tier={tier || ''}
            titleLinks={slashedDashboardName}
          />
          <div className="tw-block tw-mt-1">
            <TabsPane
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              tabs={tabs}
            />

            <div className="tw-bg-white tw--mx-4 tw-p-4">
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
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default MyDashBoardPage;
