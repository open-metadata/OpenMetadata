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
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { isNil } from 'lodash';
import { observer } from 'mobx-react';
import { EntityFieldThreadCount, EntityThread, ExtraInfo } from 'Models';
import React, {
  Fragment,
  FunctionComponent,
  RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import { default as AppState, default as appState } from '../../AppState';
import {
  getDatabaseDetailsByFQN,
  getDatabaseSchemas,
  patchDatabaseDetails,
} from '../../axiosAPIs/databaseAPI';
import {
  getAllFeeds,
  getFeedCount,
  postFeedById,
  postThread,
} from '../../axiosAPIs/feedsAPI';
import ActivityFeedList from '../../components/ActivityFeed/ActivityFeedList/ActivityFeedList';
import ActivityThreadPanel from '../../components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import Description from '../../components/common/description/Description';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from '../../components/common/next-previous/NextPrevious';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import TabsPane from '../../components/common/TabsPane/TabsPane';
import TitleBreadcrumb from '../../components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainer from '../../components/containers/PageContainer';
import Loader from '../../components/Loader/Loader';
import ManageTabComponent from '../../components/ManageTab/ManageTab.component';
import RequestDescriptionModal from '../../components/Modals/RequestDescriptionModal/RequestDescriptionModal';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import {
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getExplorePathWithSearch,
  getServiceDetailsPath,
  getTeamDetailsPath,
  PAGE_SIZE,
  pagingObject,
} from '../../constants/constants';
import { observerOptions } from '../../constants/Mydata.constants';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Database } from '../../generated/entity/data/database';
import { DatabaseSchema } from '../../generated/entity/data/databaseSchema';
import { EntityReference } from '../../generated/entity/teams/user';
import { Paging } from '../../generated/type/paging';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import jsonData from '../../jsons/en';
import { hasEditAccess, isEven } from '../../utils/CommonUtils';
import {
  databaseDetailsTabs,
  getCurrentDatabaseDetailsTab,
} from '../../utils/DatabaseDetailsUtils';
import { getEntityFeedLink, getInfoElements } from '../../utils/EntityUtils';
import { getDefaultValue } from '../../utils/FeedElementUtils';
import {
  deletePost,
  getEntityFieldThreadCounts,
  getUpdatedThread,
} from '../../utils/FeedUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { getErrorText } from '../../utils/StringsUtils';
import { getOwnerFromId, getUsagePercentile } from '../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const DatabaseDetails: FunctionComponent = () => {
  const [slashedDatabaseName, setSlashedDatabaseName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  const { databaseFQN, tab } = useParams() as Record<string, string>;
  const [isLoading, setIsLoading] = useState(true);
  const [database, setDatabase] = useState<Database>();
  const [serviceType, setServiceType] = useState<string>();
  const [schemaData, setSchemaData] = useState<Array<DatabaseSchema>>([]);

  const [databaseName, setDatabaseName] = useState<string>(
    databaseFQN.split(FQN_SEPARATOR_CHAR).slice(-1).pop() || ''
  );
  const [isEdit, setIsEdit] = useState(false);
  const [description, setDescription] = useState('');
  const [databaseId, setDatabaseId] = useState('');
  const [databaseSchemaPaging, setSchemaPaging] =
    useState<Paging>(pagingObject);
  const [databaseSchemaInstanceCount, setSchemaInstanceCount] =
    useState<number>(0);

  const [activeTab, setActiveTab] = useState<number>(
    getCurrentDatabaseDetailsTab(tab)
  );
  const [error, setError] = useState('');

  const [entityThread, setEntityThread] = useState<EntityThread[]>([]);
  const [isentityThreadLoading, setIsentityThreadLoading] =
    useState<boolean>(false);
  const [feedCount, setFeedCount] = useState<number>(0);
  const [entityFieldThreadCount, setEntityFieldThreadCount] = useState<
    EntityFieldThreadCount[]
  >([]);

  const [threadLink, setThreadLink] = useState<string>('');
  const [selectedField, setSelectedField] = useState<string>('');
  const [paging, setPaging] = useState<Paging>({} as Paging);
  const [elementRef, isInView] = useInfiniteScroll(observerOptions);
  const [currentPage, setCurrentPage] = useState(1);

  const history = useHistory();
  const isMounting = useRef(true);

  const tabs = [
    {
      name: 'Schemas',
      icon: {
        alt: 'schemas',
        name: 'schema-grey',
        title: 'Schemas',
        selectedName: 'schemas',
      },
      count: databaseSchemaInstanceCount,
      isProtected: false,
      position: 1,
    },
    {
      name: 'Activity Feed',
      icon: {
        alt: 'activity_feed',
        name: 'activity_feed',
        title: 'Activity Feed',
        selectedName: 'activity-feed-color',
      },
      isProtected: false,
      position: 2,
      count: feedCount,
    },
    {
      name: 'Manage',
      icon: {
        alt: 'manage',
        name: 'icon-manage',
        title: 'Manage',
        selectedName: 'icon-managecolor',
      },
      isProtected: false,
      position: 3,
    },
  ];

  const extraInfo: Array<ExtraInfo> = [
    {
      key: 'Owner',
      value:
        database?.owner?.type === 'team'
          ? getTeamDetailsPath(
              database?.owner?.displayName || database?.owner?.name || ''
            )
          : database?.owner?.displayName || database?.owner?.name || '',
      placeholderText:
        database?.owner?.displayName || database?.owner?.name || '',
      isLink: database?.owner?.type === 'team',
      openInNewTab: false,
    },
  ];

  const fetchDatabaseSchemas = (pagingObj?: string) => {
    return new Promise<void>((resolve, reject) => {
      getDatabaseSchemas(databaseFQN, pagingObj, ['owner', 'usageSummary'])
        .then((res: AxiosResponse) => {
          if (res.data.data) {
            setSchemaData(res.data.data);
            setSchemaPaging(res.data.paging);
            setSchemaInstanceCount(res.data.paging.total);
          } else {
            setSchemaData([]);
            setSchemaPaging(pagingObject);

            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
          resolve();
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['fetch-database-schemas-error']
          );

          reject();
        });
    });
  };

  const fetchDatabaseSchemasAndDBTModels = () => {
    setIsLoading(true);
    Promise.allSettled([fetchDatabaseSchemas()]).finally(() => {
      setIsLoading(false);
    });
  };

  const onThreadLinkSelect = (link: string) => {
    setThreadLink(link);
  };

  const onThreadPanelClose = () => {
    setThreadLink('');
  };

  const onEntityFieldSelect = (value: string) => {
    setSelectedField(value);
  };
  const closeRequestModal = () => {
    setSelectedField('');
  };

  const getEntityFeedCount = () => {
    getFeedCount(getEntityFeedLink(EntityType.DATABASE, databaseFQN))
      .then((res: AxiosResponse) => {
        if (res.data) {
          setFeedCount(res.data.totalCount);
          setEntityFieldThreadCount(res.data.counts);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-entity-feed-count-error']
        );
      });
  };

  const getDetailsByFQN = () => {
    getDatabaseDetailsByFQN(databaseFQN, ['owner'])
      .then((res: AxiosResponse) => {
        if (res.data) {
          const { description, id, name, service, serviceType } = res.data;
          setDatabase(res.data);
          setDescription(description);
          setDatabaseId(id);
          setDatabaseName(name);

          setServiceType(serviceType);

          setSlashedDatabaseName([
            {
              name: service.name,
              url: service.name
                ? getServiceDetailsPath(
                    service.name,
                    ServiceCategory.DATABASE_SERVICES
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
          fetchDatabaseSchemasAndDBTModels();
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        const errMsg = getErrorText(
          err,
          jsonData['api-error-messages']['fetch-database-details-error']
        );
        setError(errMsg);
        showErrorToast(errMsg);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const onCancel = () => {
    setIsEdit(false);
  };

  const saveUpdatedDatabaseData = (
    updatedData: Database
  ): Promise<AxiosResponse> => {
    let jsonPatch;
    if (database) {
      jsonPatch = compare(database, updatedData);
    }

    return patchDatabaseDetails(
      databaseId,
      jsonPatch
    ) as unknown as Promise<AxiosResponse>;
  };

  const onDescriptionUpdate = (updatedHTML: string) => {
    if (description !== updatedHTML && database) {
      const updatedDatabaseDetails = {
        ...database,
        description: updatedHTML,
      };
      saveUpdatedDatabaseData(updatedDatabaseDetails)
        .then((res: AxiosResponse) => {
          if (res.data) {
            setDatabase(updatedDatabaseDetails);
            setDescription(updatedHTML);
            getEntityFeedCount();
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['update-database-error']
          );
        })
        .finally(() => {
          setIsEdit(false);
        });
    }
  };

  const onDescriptionEdit = (): void => {
    setIsEdit(true);
  };

  const activeTabHandler = (tabValue: number) => {
    const currentTabIndex = tabValue - 1;
    if (databaseDetailsTabs[currentTabIndex].path !== tab) {
      setActiveTab(tabValue);
      history.push({
        pathname: getDatabaseDetailsPath(
          databaseFQN,
          databaseDetailsTabs[currentTabIndex].path
        ),
      });
    }
  };

  const databaseSchemaPagingHandler = (
    cursorType: string | number,
    activePage?: number
  ) => {
    const pagingString = `&${cursorType}=${
      databaseSchemaPaging[cursorType as keyof typeof databaseSchemaPaging]
    }`;
    setIsLoading(true);
    fetchDatabaseSchemas(pagingString).finally(() => {
      setIsLoading(false);
    });
    setCurrentPage(activePage ?? 1);
  };

  const handleUpdateOwner = (owner: Database['owner']) => {
    const updatedData = {
      ...database,
      owner,
    };

    return new Promise<void>((_, reject) => {
      saveUpdatedDatabaseData(updatedData as Database)
        .then((res: AxiosResponse) => {
          if (res.data) {
            setDatabase(res.data);
            reject();
          } else {
            reject();

            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['update-database-error']
          );
          reject();
        });
    });
  };

  const fetchActivityFeed = (after?: string) => {
    setIsentityThreadLoading(true);
    getAllFeeds(getEntityFeedLink(EntityType.DATABASE, databaseFQN), after)
      .then((res: AxiosResponse) => {
        const { data, paging: pagingObj } = res.data;
        if (data) {
          setPaging(pagingObj);
          setEntityThread((prevData) => [...prevData, ...data]);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-entity-feed-error']
        );
      })
      .finally(() => setIsentityThreadLoading(false));
  };

  const postFeedHandler = (value: string, id: string) => {
    const currentUser = AppState.userDetails?.name ?? AppState.users[0]?.name;

    const data = {
      message: value,
      from: currentUser,
    };
    postFeedById(id, data)
      .then((res: AxiosResponse) => {
        if (res.data) {
          const { id, posts } = res.data;
          setEntityThread((pre) => {
            return pre.map((thread) => {
              if (thread.id === id) {
                return { ...res.data, posts: posts.slice(-3) };
              } else {
                return thread;
              }
            });
          });
          getEntityFeedCount();
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, jsonData['api-error-messages']['add-feed-error']);
      });
  };

  const createThread = (data: CreateThread) => {
    postThread(data)
      .then((res: AxiosResponse) => {
        if (res.data) {
          setEntityThread((pre) => [...pre, res.data]);
          getEntityFeedCount();
          showSuccessToast(
            jsonData['api-success-messages']['create-conversation']
          );
        } else {
          showErrorToast(
            jsonData['api-error-messages']['unexpected-server-response']
          );
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['create-conversation-error']
        );
      });
  };

  const deletePostHandler = (threadId: string, postId: string) => {
    deletePost(threadId, postId)
      .then(() => {
        getUpdatedThread(threadId)
          .then((data) => {
            if (data) {
              setEntityThread((pre) => {
                return pre.map((thread) => {
                  if (thread.id === data.id) {
                    return {
                      ...thread,
                      posts: data.posts.slice(-3),
                      postsCount: data.postsCount,
                    };
                  } else {
                    return thread;
                  }
                });
              });
            } else {
              showErrorToast(
                jsonData['api-error-messages']['unexpected-server-response']
              );
            }
          })
          .catch((error) => {
            showErrorToast(
              error,
              jsonData['api-error-messages']['fetch-updated-conversation-error']
            );
          });

        showSuccessToast(jsonData['api-success-messages']['delete-message']);
      })
      .catch((error: AxiosError) => {
        showErrorToast(
          error,
          jsonData['api-error-messages']['delete-message-error']
        );
      });
  };

  const getLoader = () => {
    return isentityThreadLoading ? <Loader /> : null;
  };

  const fetchMoreFeed = (
    isElementInView: boolean,
    pagingObj: Paging,
    isFeedLoading: boolean
  ) => {
    if (isElementInView && pagingObj?.after && !isFeedLoading) {
      fetchActivityFeed(pagingObj.after);
    }
  };

  useEffect(() => {
    getEntityFeedCount();
  }, []);

  useEffect(() => {
    if (!isMounting.current && appState.inPageSearchText) {
      history.push(
        `${getExplorePathWithSearch(
          appState.inPageSearchText
        )}?database=${databaseName}&service_type=${serviceType}`
      );
    }
  }, [appState.inPageSearchText]);

  useEffect(() => {
    const currentTab = getCurrentDatabaseDetailsTab(tab);
    const currentTabIndex = currentTab - 1;

    if (tabs[currentTabIndex].isProtected) {
      activeTabHandler(1);
    }
    getDetailsByFQN();
  }, []);

  useEffect(() => {
    if (TabSpecificField.ACTIVITY_FEED === tab) {
      fetchActivityFeed();
    } else {
      setEntityThread([]);
    }
  }, [tab]);

  useEffect(() => {
    fetchMoreFeed(isInView as boolean, paging, isentityThreadLoading);
  }, [isInView, paging, isentityThreadLoading]);

  // alwyas Keep this useEffect at the end...
  useEffect(() => {
    isMounting.current = false;
    appState.inPageSearchText = '';
  }, []);

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : error ? (
        <ErrorPlaceHolder>
          <p data-testid="error-message">{error}</p>
        </ErrorPlaceHolder>
      ) : (
        <PageContainer>
          <div
            className="tw-px-6 tw-w-full tw-h-full tw-flex tw-flex-col"
            data-testid="page-container">
            <TitleBreadcrumb titleLinks={slashedDatabaseName} />

            <div className="tw-flex tw-gap-1 tw-mb-2 tw-mt-1 tw-ml-7 tw-flex-wrap">
              {extraInfo.map((info, index) => (
                <span className="tw-flex" key={index}>
                  {getInfoElements(info)}
                  {extraInfo.length !== 1 && index < extraInfo.length - 1 ? (
                    <span className="tw-mx-1.5 tw-inline-block tw-text-gray-400">
                      |
                    </span>
                  ) : null}
                </span>
              ))}
            </div>

            <div className="tw-pl-2" data-testid="description-container">
              <Description
                blurWithBodyBG
                description={description}
                entityFieldThreads={getEntityFieldThreadCounts(
                  'description',
                  entityFieldThreadCount
                )}
                entityFqn={databaseFQN}
                entityName={databaseName}
                entityType={EntityType.DATABASE}
                isEdit={isEdit}
                onCancel={onCancel}
                onDescriptionEdit={onDescriptionEdit}
                onDescriptionUpdate={onDescriptionUpdate}
                onEntityFieldSelect={onEntityFieldSelect}
                onThreadLinkSelect={onThreadLinkSelect}
              />
            </div>
            <div className="tw-mt-4 tw-flex tw-flex-col tw-flex-grow">
              <TabsPane
                activeTab={activeTab}
                className="tw-flex-initial"
                setActiveTab={activeTabHandler}
                tabs={tabs}
              />
              <div className="tw-bg-white tw-flex-grow tw--mx-6 tw-px-7 tw-py-4">
                {activeTab === 1 && (
                  <Fragment>
                    <table
                      className="tw-bg-white tw-w-full tw-mb-4"
                      data-testid="database-databaseSchemas">
                      <thead data-testid="table-header">
                        <tr className="tableHead-row">
                          <th
                            className="tableHead-cell"
                            data-testid="header-name">
                            Schema Name
                          </th>
                          <th
                            className="tableHead-cell"
                            data-testid="header-description">
                            Description
                          </th>
                          <th
                            className="tableHead-cell"
                            data-testid="header-owner">
                            Owner
                          </th>
                          <th
                            className="tableHead-cell"
                            data-testid="header-usage">
                            Usage
                          </th>
                        </tr>
                      </thead>
                      <tbody className="tableBody">
                        {schemaData.length > 0 ? (
                          schemaData.map((schema, index) => (
                            <tr
                              className={classNames(
                                'tableBody-row',
                                !isEven(index + 1) ? 'odd-row' : null
                              )}
                              data-testid="tabale-column"
                              key={index}>
                              <td className="tableBody-cell">
                                <Link
                                  to={
                                    schema.fullyQualifiedName
                                      ? getDatabaseSchemaDetailsPath(
                                          schema.fullyQualifiedName
                                        )
                                      : ''
                                  }>
                                  {schema.name}
                                </Link>
                              </td>
                              <td className="tableBody-cell">
                                {schema.description?.trim() ? (
                                  <RichTextEditorPreviewer
                                    markdown={schema.description}
                                  />
                                ) : (
                                  <span className="tw-no-description">
                                    No description
                                  </span>
                                )}
                              </td>
                              <td className="tableBody-cell">
                                <p>
                                  {getOwnerFromId(schema?.owner?.id)
                                    ?.displayName ||
                                    getOwnerFromId(schema?.owner?.id)?.name ||
                                    '--'}
                                </p>
                              </td>
                              <td className="tableBody-cell">
                                <p>
                                  {getUsagePercentile(
                                    schema.usageSummary?.weeklyStats
                                      ?.percentileRank || 0
                                  )}
                                </p>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr className="tableBody-row">
                            <td
                              className="tableBody-cell tw-text-center"
                              colSpan={5}>
                              No records found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    {Boolean(
                      !isNil(databaseSchemaPaging.after) ||
                        !isNil(databaseSchemaPaging.before)
                    ) && (
                      <NextPrevious
                        currentPage={currentPage}
                        pageSize={PAGE_SIZE}
                        paging={databaseSchemaPaging}
                        pagingHandler={databaseSchemaPagingHandler}
                        totalCount={paging.total}
                      />
                    )}
                  </Fragment>
                )}
                {activeTab === 2 && (
                  <div
                    className="tw-py-4 tw-px-7 tw-grid tw-grid-cols-3 entity-feed-list tw--mx-7 tw--my-4"
                    id="activityfeed">
                    <div />
                    <ActivityFeedList
                      isEntityFeed
                      withSidePanel
                      className=""
                      deletePostHandler={deletePostHandler}
                      entityName={databaseName}
                      feedList={entityThread}
                      postFeedHandler={postFeedHandler}
                    />
                    <div />
                  </div>
                )}
                {activeTab === 3 && (
                  <ManageTabComponent
                    hideTier
                    currentUser={database?.owner?.id}
                    hasEditAccess={hasEditAccess(
                      database?.owner?.type || '',
                      database?.owner?.id || ''
                    )}
                    onSave={handleUpdateOwner}
                  />
                )}
                <div
                  data-testid="observer-element"
                  id="observer-element"
                  ref={elementRef as RefObject<HTMLDivElement>}>
                  {getLoader()}
                </div>
              </div>
            </div>
            {threadLink ? (
              <ActivityThreadPanel
                createThread={createThread}
                deletePostHandler={deletePostHandler}
                open={Boolean(threadLink)}
                postFeedHandler={postFeedHandler}
                threadLink={threadLink}
                onCancel={onThreadPanelClose}
              />
            ) : null}
            {selectedField ? (
              <RequestDescriptionModal
                createThread={createThread}
                defaultValue={getDefaultValue(
                  database?.owner as EntityReference
                )}
                header="Request description"
                threadLink={getEntityFeedLink(
                  EntityType.DATABASE,
                  databaseFQN,
                  selectedField
                )}
                onCancel={closeRequestModal}
              />
            ) : null}
          </div>
        </PageContainer>
      )}
    </>
  );
};

export default observer(DatabaseDetails);
