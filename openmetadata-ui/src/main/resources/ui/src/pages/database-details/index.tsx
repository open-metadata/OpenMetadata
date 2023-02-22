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

import { Col, Row, Skeleton, Space, Table } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import ActivityFeedList from 'components/ActivityFeed/ActivityFeedList/ActivityFeedList';
import ActivityThreadPanel from 'components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import Description from 'components/common/description/Description';
import ManageButton from 'components/common/entityPageInfo/ManageButton/ManageButton';
import EntitySummaryDetails from 'components/common/EntitySummaryDetails/EntitySummaryDetails';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import TabsPane from 'components/common/TabsPane/TabsPane';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainerV1 from 'components/containers/PageContainerV1';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import { compare, Operation } from 'fast-json-patch';
import { isNil, startCase } from 'lodash';
import { observer } from 'mobx-react';
import { ExtraInfo } from 'Models';
import React, {
  Fragment,
  FunctionComponent,
  RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory, useParams } from 'react-router-dom';
import {
  getDatabaseDetailsByFQN,
  getDatabaseSchemas,
  patchDatabaseDetails,
} from 'rest/databaseAPI';
import {
  getAllFeeds,
  getFeedCount,
  postFeedById,
  postThread,
} from 'rest/feedsAPI';
import { default as AppState, default as appState } from '../../AppState';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import {
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getExplorePath,
  getServiceDetailsPath,
  getTeamAndUserDetailsPath,
  PAGE_SIZE,
  pagingObject,
} from '../../constants/constants';
import { EntityField } from '../../constants/Feeds.constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { observerOptions } from '../../constants/Mydata.constants';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { OwnerType } from '../../enums/user.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Database } from '../../generated/entity/data/database';
import { DatabaseSchema } from '../../generated/entity/data/databaseSchema';
import { Post, Thread } from '../../generated/entity/feed/thread';
import { EntityReference } from '../../generated/entity/teams/user';
import { UsageDetails } from '../../generated/type/entityUsage';
import { Paging } from '../../generated/type/paging';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { EntityFieldThreadCount } from '../../interface/feed.interface';
import jsonData from '../../jsons/en';
import { getEntityName } from '../../utils/CommonUtils';
import {
  databaseDetailsTabs,
  getCurrentDatabaseDetailsTab,
} from '../../utils/DatabaseDetailsUtils';
import { getEntityFeedLink } from '../../utils/EntityUtils';
import {
  deletePost,
  getEntityFieldThreadCounts,
  updateThreadData,
} from '../../utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import {
  getServiceRouteFromServiceType,
  serviceTypeLogo,
} from '../../utils/ServiceUtils';
import { getErrorText } from '../../utils/StringsUtils';
import { getUsagePercentile } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const DatabaseDetails: FunctionComponent = () => {
  const { t } = useTranslation();
  const [slashedDatabaseName, setSlashedDatabaseName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const { databaseFQN, tab } = useParams() as Record<string, string>;
  const [isLoading, setIsLoading] = useState(true);
  const [database, setDatabase] = useState<Database>();
  const [serviceType, setServiceType] = useState<string>();
  const [schemaData, setSchemaData] = useState<Array<DatabaseSchema>>([]);
  const [schemaDataLoading, setSchemaDataLoading] = useState<boolean>(true);

  const [databaseName, setDatabaseName] = useState<string>(
    databaseFQN.split(FQN_SEPARATOR_CHAR).slice(-1).pop() || ''
  );
  const [isDatabaseDetailsLoading, setIsDatabaseDetailsLoading] =
    useState<boolean>(true);
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

  const [entityThread, setEntityThread] = useState<Thread[]>([]);
  const [isentityThreadLoading, setIsentityThreadLoading] =
    useState<boolean>(false);
  const [feedCount, setFeedCount] = useState<number>(0);
  const [entityFieldThreadCount, setEntityFieldThreadCount] = useState<
    EntityFieldThreadCount[]
  >([]);

  const [threadLink, setThreadLink] = useState<string>('');
  const [paging, setPaging] = useState<Paging>({} as Paging);
  const [elementRef, isInView] = useInfiniteScroll(observerOptions);
  const [currentPage, setCurrentPage] = useState(1);

  const history = useHistory();
  const isMounting = useRef(true);

  const [databasePermission, setDatabasePermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const fetchDatabasePermission = async () => {
    setIsLoading(true);
    try {
      const response = await getEntityPermissionByFqn(
        ResourceEntity.DATABASE,
        databaseFQN
      );
      setDatabasePermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

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
      name: 'Activity Feeds',
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
  ];

  const extraInfo: Array<ExtraInfo> = [
    {
      key: 'Owner',
      value:
        database?.owner?.type === 'team'
          ? getTeamAndUserDetailsPath(
              database?.owner?.displayName || database?.owner?.name || ''
            )
          : database?.owner?.displayName || database?.owner?.name || '',
      placeholderText:
        database?.owner?.displayName || database?.owner?.name || '',
      isLink: database?.owner?.type === 'team',
      openInNewTab: false,
      profileName:
        database?.owner?.type === OwnerType.USER
          ? database?.owner?.name
          : undefined,
    },
  ];

  const fetchDatabaseSchemas = (pagingObj?: string) => {
    return new Promise<void>((resolve, reject) => {
      setSchemaDataLoading(true);
      getDatabaseSchemas(databaseFQN, pagingObj, ['owner', 'usageSummary'])
        .then((res) => {
          if (res.data) {
            setSchemaData(res.data);
            setSchemaPaging(res.paging);
            setSchemaInstanceCount(res.paging.total);
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
        })
        .finally(() => {
          setSchemaDataLoading(false);
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

  const getEntityFeedCount = () => {
    getFeedCount(getEntityFeedLink(EntityType.DATABASE, databaseFQN))
      .then((res) => {
        if (res) {
          setFeedCount(res.totalCount);
          setEntityFieldThreadCount(res.counts);
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
    setIsDatabaseDetailsLoading(true);
    getDatabaseDetailsByFQN(databaseFQN, ['owner'])
      .then((res) => {
        if (res) {
          const { description, id, name, service, serviceType } = res;
          setDatabase(res);
          setDescription(description ?? '');
          setDatabaseId(id ?? '');
          setDatabaseName(name);

          setServiceType(serviceType);

          setSlashedDatabaseName([
            {
              name: startCase(ServiceCategory.DATABASE_SERVICES),
              url: getSettingPath(
                GlobalSettingsMenuCategory.SERVICES,
                getServiceRouteFromServiceType(
                  ServiceCategory.DATABASE_SERVICES
                )
              ),
            },
            {
              name: service.name ?? '',
              url: service.name
                ? getServiceDetailsPath(
                    service.name,
                    ServiceCategory.DATABASE_SERVICES
                  )
                : '',
              imgSrc: serviceType ? serviceTypeLogo(serviceType) : undefined,
            },
            {
              name: getEntityName(res),
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
        setIsDatabaseDetailsLoading(false);
      });
  };

  const onCancel = () => {
    setIsEdit(false);
  };

  const saveUpdatedDatabaseData = (updatedData: Database) => {
    let jsonPatch: Operation[] = [];
    if (database) {
      jsonPatch = compare(database, updatedData);
    }

    return patchDatabaseDetails(databaseId, jsonPatch);
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (description !== updatedHTML && database) {
      const updatedDatabaseDetails = {
        ...database,
        description: updatedHTML,
      };
      try {
        const response = await saveUpdatedDatabaseData(updatedDatabaseDetails);
        if (response) {
          setDatabase(updatedDatabaseDetails);
          setDescription(updatedHTML);
          getEntityFeedCount();
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsEdit(false);
      }
    } else {
      setIsEdit(false);
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
      owner: { ...database?.owner, ...owner },
    };

    return new Promise<void>((_, reject) => {
      saveUpdatedDatabaseData(updatedData as Database)
        .then((res) => {
          if (res) {
            setDatabase(res);
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

  const handleRemoveOwner = () => {
    const updatedData = {
      ...database,
      owner: undefined,
    };

    return new Promise<void>((resolve, reject) => {
      saveUpdatedDatabaseData(updatedData as Database)
        .then((res) => {
          if (res) {
            setDatabase(res);
            resolve();
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
      .then((res) => {
        const { data, paging: pagingObj } = res;
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
    } as Post;
    postFeedById(id, data)
      .then((res) => {
        if (res) {
          const { id, posts } = res;
          setEntityThread((pre) => {
            return pre.map((thread) => {
              if (thread.id === id) {
                return { ...res, posts: posts?.slice(-3) };
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
      .then((res) => {
        if (res) {
          setEntityThread((pre) => [...pre, res]);
          getEntityFeedCount();
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

  const deletePostHandler = (
    threadId: string,
    postId: string,
    isThread: boolean
  ) => {
    deletePost(threadId, postId, isThread, setEntityThread);
  };

  const updateThreadHandler = (
    threadId: string,
    postId: string,
    isThread: boolean,
    data: Operation[]
  ) => {
    updateThreadData(threadId, postId, isThread, data, setEntityThread);
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
        getExplorePath({
          search: appState.inPageSearchText,
          extraParameters: {
            postFilter: {
              serviceType: [serviceType],
              'database.name.keyword': [databaseName],
            },
          },
        })
      );
    }
  }, [appState.inPageSearchText]);

  useEffect(() => {
    if (databasePermission.ViewAll || databasePermission.ViewBasic) {
      const currentTab = getCurrentDatabaseDetailsTab(tab);
      const currentTabIndex = currentTab - 1;

      if (tabs[currentTabIndex].isProtected) {
        activeTabHandler(1);
      }
      getDetailsByFQN();
    }
  }, [databasePermission, databaseFQN]);

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

  useEffect(() => {
    fetchDatabasePermission();
  }, [databaseFQN]);

  // alwyas Keep this useEffect at the end...
  useEffect(() => {
    isMounting.current = false;
    appState.inPageSearchText = '';
  }, []);

  const tableColumn: ColumnsType<DatabaseSchema> = useMemo(
    () => [
      {
        title: t('label.schema-name'),
        dataIndex: 'name',
        key: 'name',
        render: (text: string, record: DatabaseSchema) => (
          <Link
            to={
              record.fullyQualifiedName
                ? getDatabaseSchemaDetailsPath(record.fullyQualifiedName)
                : ''
            }>
            {text}
          </Link>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (text: string) =>
          text?.trim() ? (
            <RichTextEditorPreviewer markdown={text} />
          ) : (
            <span className="text-grey-muted">
              {t('label.no-entity', { entity: t('label.description') })}
            </span>
          ),
      },
      {
        title: t('label.owner'),
        dataIndex: 'owner',
        key: 'owner',
        render: (text: EntityReference) => getEntityName(text) || '--',
      },
      {
        title: t('label.usage'),
        dataIndex: 'usageSummary',
        key: 'usageSummary',
        render: (text: UsageDetails) =>
          getUsagePercentile(text?.weeklyStats?.percentileRank || 0),
      },
    ],
    []
  );

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : error ? (
        <ErrorPlaceHolder>
          <p data-testid="error-message">{error}</p>
        </ErrorPlaceHolder>
      ) : (
        <>
          {databasePermission.ViewAll || databasePermission.ViewBasic ? (
            <PageContainerV1>
              <Row
                className=" p-x-md p-t-lg"
                data-testid="page-container"
                gutter={[0, 12]}>
                {isDatabaseDetailsLoading ? (
                  <Skeleton
                    active
                    paragraph={{
                      rows: 3,
                      width: ['20%', '80%', '60%'],
                    }}
                  />
                ) : (
                  <>
                    <Col span={24}>
                      <Space align="center" className="justify-between w-full">
                        <TitleBreadcrumb titleLinks={slashedDatabaseName} />
                        <ManageButton
                          isRecursiveDelete
                          allowSoftDelete={false}
                          canDelete={databasePermission.Delete}
                          entityFQN={databaseFQN}
                          entityId={databaseId}
                          entityName={databaseName}
                          entityType={EntityType.DATABASE}
                        />
                      </Space>
                    </Col>
                    <Col span={24}>
                      {extraInfo.map((info, index) => (
                        <Space key={index}>
                          <EntitySummaryDetails
                            currentOwner={database?.owner}
                            data={info}
                            removeOwner={handleRemoveOwner}
                            updateOwner={
                              databasePermission.EditOwner ||
                              databasePermission.EditAll
                                ? handleUpdateOwner
                                : undefined
                            }
                          />
                        </Space>
                      ))}
                    </Col>
                    <Col data-testid="description-container" span={24}>
                      <Description
                        description={description}
                        entityFieldThreads={getEntityFieldThreadCounts(
                          EntityField.DESCRIPTION,
                          entityFieldThreadCount
                        )}
                        entityFqn={databaseFQN}
                        entityName={databaseName}
                        entityType={EntityType.DATABASE}
                        hasEditAccess={
                          databasePermission.EditDescription ||
                          databasePermission.EditAll
                        }
                        isEdit={isEdit}
                        onCancel={onCancel}
                        onDescriptionEdit={onDescriptionEdit}
                        onDescriptionUpdate={onDescriptionUpdate}
                        onThreadLinkSelect={onThreadLinkSelect}
                      />
                    </Col>
                  </>
                )}
                <Col span={24}>
                  <Row className="m-t-md">
                    <Col span={24}>
                      <TabsPane
                        activeTab={activeTab}
                        className="flex-initial"
                        setActiveTab={activeTabHandler}
                        tabs={tabs}
                      />
                    </Col>
                    <Col className="p-y-md" span={24}>
                      {activeTab === 1 && (
                        <Fragment>
                          <Table
                            bordered
                            className="table-shadow"
                            columns={tableColumn}
                            data-testid="database-databaseSchemas"
                            dataSource={schemaData}
                            loading={{
                              spinning: schemaDataLoading,
                              indicator: <Loader size="small" />,
                            }}
                            pagination={false}
                            rowKey="id"
                            size="small"
                          />
                          {Boolean(
                            !isNil(databaseSchemaPaging.after) ||
                              !isNil(databaseSchemaPaging.before)
                          ) && (
                            <NextPrevious
                              currentPage={currentPage}
                              pageSize={PAGE_SIZE}
                              paging={databaseSchemaPaging}
                              pagingHandler={databaseSchemaPagingHandler}
                              totalCount={databaseSchemaPaging.total}
                            />
                          )}
                        </Fragment>
                      )}
                      {activeTab === 2 && (
                        <Row
                          className="p-t-xss p-b-md entity-feed-list bg-white border-1 rounded-4 shadow-base h-full"
                          id="activityfeed">
                          <Col offset={4} span={16}>
                            <ActivityFeedList
                              hideFeedFilter
                              hideThreadFilter
                              isEntityFeed
                              withSidePanel
                              className=""
                              deletePostHandler={deletePostHandler}
                              entityName={databaseName}
                              feedList={entityThread}
                              postFeedHandler={postFeedHandler}
                              updateThreadHandler={updateThreadHandler}
                            />
                          </Col>
                        </Row>
                      )}
                      <Col
                        data-testid="observer-element"
                        id="observer-element"
                        ref={elementRef as RefObject<HTMLDivElement>}
                        span={24}>
                        {getLoader()}
                      </Col>
                    </Col>
                  </Row>
                </Col>
                <Col span={24}>
                  {threadLink ? (
                    <ActivityThreadPanel
                      createThread={createThread}
                      deletePostHandler={deletePostHandler}
                      open={Boolean(threadLink)}
                      postFeedHandler={postFeedHandler}
                      threadLink={threadLink}
                      updateThreadHandler={updateThreadHandler}
                      onCancel={onThreadPanelClose}
                    />
                  ) : null}
                </Col>
              </Row>
            </PageContainerV1>
          ) : (
            <ErrorPlaceHolder>
              {t('message.no-permission-to-view')}
            </ErrorPlaceHolder>
          )}
        </>
      )}
    </>
  );
};

export default observer(DatabaseDetails);
