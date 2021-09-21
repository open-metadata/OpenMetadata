import { AxiosPromise, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { ColumnTags, TableDetail, User } from 'Models';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppState from '../../AppState';
import { getChartById, updateChart } from '../../axiosAPIs/chartAPI';
import {
  addFollower,
  getDashboardByFqn,
  patchDashboardDetails,
  removeFollower,
} from '../../axiosAPIs/dashboardAPI';
import { getServiceById } from '../../axiosAPIs/serviceAPI';
import Description from '../../components/common/description/Description';
import EntityPageInfo from '../../components/common/entityPageInfo/EntityPageInfo';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import TabsPane from '../../components/common/TabsPane/TabsPane';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainer from '../../components/containers/PageContainer';
import Loader from '../../components/Loader/Loader';
import { ModalWithMarkdownEditor } from '../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import ManageTab from '../../components/my-data-details/ManageTab';
import TagsContainer from '../../components/tags-container/tags-container';
import Tags from '../../components/tags/tags';
import { getServiceDetailsPath } from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import { Chart } from '../../generated/entity/data/chart';
import { Dashboard, TagLabel } from '../../generated/entity/data/dashboard';
import { useAuth } from '../../hooks/authHooks';
import {
  addToRecentViewed,
  getCurrentUserId,
  getUserTeams,
  isEven,
} from '../../utils/CommonUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import SVGIcons from '../../utils/SvgUtils';
import {
  getOwnerFromId,
  getTagsWithoutTier,
  getTierFromTableTags,
} from '../../utils/TableUtils';
import { getTagCategories, getTaglist } from '../../utils/TagsUtils';
type ChartType = {
  displayName: string;
} & Chart;
const MyDashBoardPage = () => {
  const USERId = getCurrentUserId();

  const { isAuthDisabled } = useAuth();

  const [tagList, setTagList] = useState<Array<string>>([]);
  const { dashboardFQN } = useParams() as Record<string, string>;
  const [dashboardDetails, setDashboardDetails] = useState<Dashboard>(
    {} as Dashboard
  );
  const [dashboardId, setDashboardId] = useState<string>('');
  const [isLoading, setLoading] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');
  const [followers, setFollowers] = useState<Array<User>>([]);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [owner, setOwner] = useState<TableDetail['owner']>();
  const [tier, setTier] = useState<string>();
  const [tags, setTags] = useState<Array<ColumnTags>>([]);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [charts, setCharts] = useState<ChartType[]>([]);
  const [dashboardUrl, setDashboardUrl] = useState<string>('');
  // const [usage, setUsage] = useState('');
  // const [weeklyUsageCount, setWeeklyUsageCount] = useState('');
  const [slashedDashboardName, setSlashedDashboardName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  const [editChart, setEditChart] = useState<{
    chart: ChartType;
    index: number;
  }>();
  const [editChartTags, setEditChartTags] = useState<{
    chart: ChartType;
    index: number;
  }>();

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
    { key: 'Dashboard Url', value: dashboardUrl, isLink: true },
    // { key: 'Usage', value: usage },
    // { key: 'Queries', value: `${weeklyUsageCount} past week` },
  ];
  const fetchTags = () => {
    getTagCategories().then((res) => {
      if (res.data) {
        setTagList(getTaglist(res.data));
      }
    });
  };

  const fetchCharts = async (charts: Dashboard['charts']) => {
    let chartsData: ChartType[] = [];
    let promiseArr: Array<AxiosPromise> = [];
    if (charts?.length) {
      promiseArr = charts.map((chart) =>
        getChartById(chart.id, ['service', 'tags'])
      );
      await Promise.allSettled(promiseArr).then(
        (res: PromiseSettledResult<AxiosResponse>[]) => {
          if (res.length) {
            chartsData = res
              .filter((chart) => chart.status === 'fulfilled')
              .map(
                (chart) =>
                  (chart as PromiseFulfilledResult<AxiosResponse>).value.data
              );
          }
        }
      );
    }

    return chartsData;
  };

  const setFollowersData = (followers: Array<User>) => {
    // need to check if already following or not with logedIn user id
    setIsFollowing(followers.some(({ id }: { id: string }) => id === USERId));
    setFollowersCount(followers?.length);
  };

  const fetchDashboardDetail = (dashboardFQN: string) => {
    setLoading(true);
    getDashboardByFqn(dashboardFQN, [
      'owner',
      'service',
      'followers',
      'tags',
      'usageSummary',
      'charts',
    ]).then((res: AxiosResponse) => {
      const {
        id,
        description,
        followers,
        fullyQualifiedName,
        service,
        tags,
        owner,
        displayName,
        charts,
        dashboardUrl,
        // usageSummary,
      } = res.data;
      setDashboardDetails(res.data);
      setDashboardId(id);
      setDescription(description ?? '');
      setFollowers(followers);
      setFollowersData(followers);
      setOwner(getOwnerFromId(owner?.id));
      setTier(getTierFromTableTags(tags));
      setTags(getTagsWithoutTier(tags));
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

          addToRecentViewed({
            entityType: EntityType.DASHBOARD,
            fqn: fullyQualifiedName,
            serviceType: serviceRes.data.serviceType,
            timestamp: 0,
          });
        }
      );
      setDashboardUrl(dashboardUrl);
      fetchCharts(charts).then((charts) => setCharts(charts));
      // if (!isNil(usageSummary?.weeklyStats.percentileRank)) {
      //   const percentile = getUsagePercentile(
      //     usageSummary.weeklyStats.percentileRank
      //   );
      //   setUsage(percentile);
      // } else {
      //   setUsage('--');
      // }
      // setWeeklyUsageCount(
      //   usageSummary?.weeklyStats.count.toLocaleString() || '--'
      // );

      setLoading(false);
    });
  };

  const followDashboard = (): void => {
    if (isFollowing) {
      removeFollower(dashboardId, USERId).then(() => {
        setFollowersCount((preValu) => preValu - 1);
        setIsFollowing(false);
      });
    } else {
      addFollower(dashboardId, USERId).then(() => {
        setFollowersCount((preValu) => preValu + 1);
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

  const handleUpdateChart = (chart: ChartType, index: number) => {
    setEditChart({ chart, index });
  };

  const closeEditChartModal = (): void => {
    setEditChart(undefined);
  };

  const onChartUpdate = (chartDescription: string) => {
    if (editChart) {
      const updatedChart = {
        ...editChart.chart,
        description: chartDescription,
      };
      const jsonPatch = compare(charts[editChart.index], updatedChart);
      updateChart(editChart.chart.id, jsonPatch).then((res: AxiosResponse) => {
        if (res.data) {
          setCharts((prevCharts) => {
            const charts = [...prevCharts];
            charts[editChart.index] = res.data;

            return charts;
          });
        }
      });
      setEditChart(undefined);
    } else {
      setEditChart(undefined);
    }
  };

  const handleEditChartTag = (chart: ChartType, index: number): void => {
    setEditChartTags({ chart, index });
  };

  const handleChartTagSelection = (selectedTags?: Array<ColumnTags>) => {
    if (selectedTags && editChartTags) {
      const prevTags = editChartTags.chart.tags?.filter((tag) =>
        selectedTags.some((selectedTag) => selectedTag.tagFQN === tag.tagFQN)
      );
      const newTags = selectedTags
        .filter(
          (selectedTag) =>
            !editChartTags.chart.tags?.some(
              (tag) => tag.tagFQN === selectedTag.tagFQN
            )
        )
        .map((tag) => ({
          labelType: 'Manual',
          state: 'Confirmed',
          tagFQN: tag.tagFQN,
        }));

      const updatedChart = {
        ...editChartTags.chart,
        tags: [...(prevTags as TagLabel[]), ...newTags],
      };
      const jsonPatch = compare(charts[editChartTags.index], updatedChart);
      updateChart(editChartTags.chart.id, jsonPatch).then(
        (res: AxiosResponse) => {
          if (res.data) {
            setCharts((prevCharts) => {
              const charts = [...prevCharts];
              charts[editChartTags.index] = res.data;

              return charts;
            });
          }
        }
      );
      setEditChartTags(undefined);
    } else {
      setEditChartTags(undefined);
    }
  };

  useEffect(() => {
    fetchDashboardDetail(dashboardFQN);
  }, [dashboardFQN]);

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
            extraInfo={extraInfo}
            followers={followersCount}
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
                  <div className="tw-table-responsive tw-my-6">
                    <table className="tw-w-full" data-testid="schema-table">
                      <thead>
                        <tr className="tableHead-row">
                          <th className="tableHead-cell">Chart Name</th>
                          <th className="tableHead-cell">Chart Type</th>
                          <th className="tableHead-cell">Description</th>
                          <th className="tableHead-cell tw-w-60">Tags</th>
                        </tr>
                      </thead>
                      <tbody className="tableBody">
                        {charts.map((chart, index) => (
                          <tr
                            className={classNames(
                              'tableBody-row',
                              !isEven(index + 1) ? 'odd-row' : null
                            )}
                            key={index}>
                            <td className="tableBody-cell">
                              <Link
                                target="_blank"
                                to={{ pathname: chart.chartUrl }}>
                                <span className="tw-flex">
                                  <span className="tw-mr-1">
                                    {chart.displayName}
                                  </span>
                                  <SVGIcons
                                    alt="external-link"
                                    className="tw-align-middle"
                                    icon="external-link"
                                    width="12px"
                                  />
                                </span>
                              </Link>
                            </td>
                            <td className="tableBody-cell">
                              {chart.chartType}
                            </td>
                            <td className="tw-group tableBody-cell tw-relative">
                              <div
                                className="tw-cursor-pointer hover:tw-underline tw-flex"
                                data-testid="description"
                                onClick={() => handleUpdateChart(chart, index)}>
                                <div>
                                  {chart.description ? (
                                    <RichTextEditorPreviewer
                                      markdown={chart.description}
                                    />
                                  ) : (
                                    <span className="tw-no-description">
                                      No description added
                                    </span>
                                  )}
                                </div>
                                <button className="tw-self-start tw-w-8 tw-h-auto tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none">
                                  <SVGIcons
                                    alt="edit"
                                    icon="icon-edit"
                                    title="Edit"
                                    width="10px"
                                  />
                                </button>
                              </div>
                            </td>
                            <td
                              className="tw-group tw-relative tableBody-cell"
                              onClick={() => {
                                if (!editChartTags) {
                                  handleEditChartTag(chart, index);
                                }
                              }}>
                              <TagsContainer
                                editable={editChartTags?.index === index}
                                selectedTags={chart.tags as ColumnTags[]}
                                tagList={tagList}
                                onCancel={() => {
                                  handleChartTagSelection();
                                }}
                                onSelectionChange={(tags) => {
                                  handleChartTagSelection(tags);
                                }}>
                                {chart.tags?.length ? (
                                  <button className="tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none">
                                    <SVGIcons
                                      alt="edit"
                                      icon="icon-edit"
                                      title="Edit"
                                      width="10px"
                                    />
                                  </button>
                                ) : (
                                  <span className="tw-opacity-0 group-hover:tw-opacity-100">
                                    <Tags
                                      className="tw-border-main"
                                      tag="+ Add tag"
                                      type="outlined"
                                    />
                                  </span>
                                )}
                              </TagsContainer>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
      {editChart && (
        <ModalWithMarkdownEditor
          header={`Edit Chart: "${editChart.chart.displayName}"`}
          placeholder="Enter Chart Description"
          value={editChart.chart.description || ''}
          onCancel={closeEditChartModal}
          onSave={onChartUpdate}
        />
      )}
    </PageContainer>
  );
};

export default MyDashBoardPage;
