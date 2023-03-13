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

import { Card, Col, Row, Skeleton, Space, Table as TableAntd } from 'antd';
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
import { isUndefined, startCase, toNumber } from 'lodash';
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
  getDatabaseSchemaDetailsByFQN,
  patchDatabaseSchemaDetails,
} from 'rest/databaseAPI';
import {
  getAllFeeds,
  getFeedCount,
  postFeedById,
  postThread,
} from 'rest/feedsAPI';
import { searchQuery } from 'rest/searchAPI';
import { default as AppState, default as appState } from '../../AppState';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import {
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getServiceDetailsPath,
  getTeamAndUserDetailsPath,
  INITIAL_PAGING_VALUE,
  PAGE_SIZE,
} from '../../constants/constants';
import { EntityField } from '../../constants/Feeds.constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { observerOptions } from '../../constants/Mydata.constants';
import { EntityType, FqnPart, TabSpecificField } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { OwnerType } from '../../enums/user.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { DatabaseSchema } from '../../generated/entity/data/databaseSchema';
import { Table } from '../../generated/entity/data/table';
import { Post, Thread } from '../../generated/entity/feed/thread';
import { Paging } from '../../generated/type/paging';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { EntityFieldThreadCount } from '../../interface/feed.interface';
import jsonData from '../../jsons/en';
import { getPartialNameFromTableFQN } from '../../utils/CommonUtils';
import {
  databaseSchemaDetailsTabs,
  getCurrentDatabaseSchemaDetailsTab,
  getQueryStringForSchemaTables,
  getTablesFromSearchResponse,
} from '../../utils/DatabaseSchemaDetailsUtils';
import { getEntityFeedLink, getEntityName } from '../../utils/EntityUtils';
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
import { getEntityLink } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const DatabaseSchemaPage: FunctionComponent = () => {
  const [slashedTableName, setSlashedTableName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const { databaseSchemaFQN, tab } = useParams<Record<string, string>>();
  const [isLoading, setIsLoading] = useState(true);
  const [databaseSchema, setDatabaseSchema] = useState<DatabaseSchema>();
  const [tableData, setTableData] = useState<Array<Table>>([]);
  const [tableDataLoading, setTableDataLoading] = useState<boolean>(true);

  const [databaseSchemaName, setDatabaseSchemaName] = useState<string>(
    databaseSchemaFQN.split(FQN_SEPARATOR_CHAR).slice(-1).pop() || ''
  );
  const [IsSchemaDetailsLoading, setIsSchemaDetailsLoading] =
    useState<boolean>(true);
  const [isEdit, setIsEdit] = useState(false);
  const [description, setDescription] = useState('');
  const [databaseSchemaId, setDatabaseSchemaId] = useState('');
  const [tableInstanceCount, setTableInstanceCount] = useState<number>(0);

  const [activeTab, setActiveTab] = useState<number>(
    getCurrentDatabaseSchemaDetailsTab(tab)
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
  const [currentTablesPage, setCurrentTablesPage] =
    useState<number>(INITIAL_PAGING_VALUE);
  const [elementRef, isInView] = useInfiniteScroll(observerOptions);

  const history = useHistory();
  const isMounting = useRef(true);

  const [databaseSchemaPermission, setDatabaseSchemaPermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const fetchDatabaseSchemaPermission = async () => {
    setIsLoading(true);
    try {
      const response = await getEntityPermissionByFqn(
        ResourceEntity.DATABASE_SCHEMA,
        databaseSchemaFQN
      );
      setDatabaseSchemaPermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    {
      name: 'Tables',
      icon: {
        alt: 'tables',
        name: 'table-grey',
        title: 'Tables',
        selectedName: 'table',
      },
      count: tableInstanceCount,
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
        databaseSchema?.owner?.type === 'team'
          ? getTeamAndUserDetailsPath(
              databaseSchema?.owner?.displayName ||
                databaseSchema?.owner?.name ||
                ''
            )
          : databaseSchema?.owner?.displayName ||
            databaseSchema?.owner?.name ||
            '',
      placeholderText:
        databaseSchema?.owner?.displayName || databaseSchema?.owner?.name || '',
      isLink: databaseSchema?.owner?.type === 'team',
      openInNewTab: false,
      profileName:
        databaseSchema?.owner?.type === OwnerType.USER
          ? databaseSchema?.owner?.name
          : undefined,
    },
  ];

  const onThreadLinkSelect = (link: string) => {
    setThreadLink(link);
  };

  const onThreadPanelClose = () => {
    setThreadLink('');
  };

  const getEntityFeedCount = () => {
    getFeedCount(
      getEntityFeedLink(EntityType.DATABASE_SCHEMA, databaseSchemaFQN)
    )
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
    setIsSchemaDetailsLoading(true);
    getDatabaseSchemaDetailsByFQN(databaseSchemaFQN, ['owner', 'usageSummary'])
      .then((res) => {
        if (res) {
          const {
            description: schemaDescription = '',
            id = '',
            name,
            service,
            serviceType,
            database,
          } = res;
          setDatabaseSchema(res);
          setDescription(schemaDescription);
          setDatabaseSchemaId(id);
          setDatabaseSchemaName(name);
          setSlashedTableName([
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
              name: getPartialNameFromTableFQN(
                database.fullyQualifiedName ?? '',
                [FqnPart.Database]
              ),
              url: getDatabaseDetailsPath(database.fullyQualifiedName ?? ''),
            },
            {
              name: getEntityName(res),
              url: '',
              activeTitle: true,
            },
          ]);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        const errMsg = getErrorText(
          err,
          jsonData['api-error-messages']['fetch-databaseSchema-details-error']
        );
        setError(errMsg);
        showErrorToast(errMsg);
      })
      .finally(() => {
        setIsLoading(false);
        setIsSchemaDetailsLoading(false);
      });
  };

  const getSchemaTables = async (
    pageNumber: number,
    databaseSchema: DatabaseSchema
  ) => {
    setTableDataLoading(true);
    try {
      setCurrentTablesPage(pageNumber);
      const res = await searchQuery({
        query: getQueryStringForSchemaTables(
          databaseSchema.service,
          databaseSchema.database,
          databaseSchema
        ),
        pageNumber,
        sortField: 'name.keyword',
        sortOrder: 'asc',
        pageSize: PAGE_SIZE,
        searchIndex: SearchIndex.TABLE,
        includeDeleted: false,
      });
      setTableData(getTablesFromSearchResponse(res));
      setTableInstanceCount(res.hits.total.value);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setTableDataLoading(false);
    }
  };

  const tablePaginationHandler = (pageNumber: string | number) => {
    if (!isUndefined(databaseSchema)) {
      getSchemaTables(toNumber(pageNumber), databaseSchema);
    }
  };

  const onCancel = () => {
    setIsEdit(false);
  };

  const saveUpdatedDatabaseSchemaData = async (
    updatedData: DatabaseSchema
  ): Promise<DatabaseSchema> => {
    let jsonPatch: Operation[] = [];
    if (databaseSchema) {
      jsonPatch = compare(databaseSchema, updatedData);
    }

    return patchDatabaseSchemaDetails(databaseSchemaId, jsonPatch);
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (description !== updatedHTML && databaseSchema) {
      const updatedDatabaseSchemaDetails = {
        ...databaseSchema,
        description: updatedHTML,
      };

      try {
        const response = await saveUpdatedDatabaseSchemaData(
          updatedDatabaseSchemaDetails
        );
        if (response) {
          setDatabaseSchema(updatedDatabaseSchemaDetails);
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
    if (databaseSchemaDetailsTabs[currentTabIndex].path !== tab) {
      setActiveTab(tabValue);
      history.push({
        pathname: getDatabaseSchemaDetailsPath(
          databaseSchemaFQN,
          databaseSchemaDetailsTabs[currentTabIndex].path
        ),
      });
    }
  };

  const handleUpdateOwner = (owner: DatabaseSchema['owner']) => {
    const updatedData = {
      ...databaseSchema,
      owner: { ...databaseSchema?.owner, ...owner },
    };

    return new Promise<void>((_, reject) => {
      saveUpdatedDatabaseSchemaData(updatedData as DatabaseSchema)
        .then((res) => {
          if (res) {
            setDatabaseSchema(res);
            reject();
          } else {
            reject();

            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['update-databaseSchema-error']
          );
          reject();
        });
    });
  };

  const handleRemoveOwner = () => {
    const updatedData = {
      ...databaseSchema,
      owner: undefined,
    };

    return new Promise<void>((resolve, reject) => {
      saveUpdatedDatabaseSchemaData(updatedData as DatabaseSchema)
        .then((res) => {
          if (res) {
            setDatabaseSchema(res);
            resolve();
          } else {
            reject();

            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['update-databaseSchema-error']
          );
          reject();
        });
    });
  };

  const fetchActivityFeed = (after?: string) => {
    setIsentityThreadLoading(true);
    getAllFeeds(
      getEntityFeedLink(EntityType.DATABASE_SCHEMA, databaseSchemaFQN),
      after
    )
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
          const { id: threadId, posts } = res;
          setEntityThread((pre) => {
            return pre.map((thread) => {
              if (thread.id === threadId) {
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

  const tableColumn: ColumnsType<Table> = useMemo(
    () => [
      {
        title: t('label.table-entity-text', {
          entityText: t('label.name'),
        }),
        dataIndex: 'name',
        key: 'name',
        render: (_, record: Table) => {
          return (
            <Link
              to={getEntityLink(
                EntityType.TABLE,
                record.fullyQualifiedName as string
              )}>
              {getEntityName(record)}
            </Link>
          );
        },
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (text: string) =>
          text?.trim() ? (
            <RichTextEditorPreviewer markdown={text} />
          ) : (
            <span className="text-grey-muted">{t('label.no-description')}</span>
          ),
      },
    ],
    []
  );

  const getSchemaTableList = () => {
    return (
      <>
        <TableAntd
          bordered
          className="table-shadow"
          columns={tableColumn}
          data-testid="databaseSchema-tables"
          dataSource={tableData}
          loading={{
            spinning: tableDataLoading,
            indicator: <Loader size="small" />,
          }}
          pagination={false}
          rowKey="id"
          size="small"
        />
        {tableInstanceCount > PAGE_SIZE && tableData.length > 0 && (
          <NextPrevious
            isNumberBased
            currentPage={currentTablesPage}
            pageSize={PAGE_SIZE}
            paging={paging}
            pagingHandler={tablePaginationHandler}
            totalCount={tableInstanceCount}
          />
        )}
      </>
    );
  };

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
    if (
      databaseSchemaPermission.ViewAll ||
      databaseSchemaPermission.ViewBasic
    ) {
      const currentTab = getCurrentDatabaseSchemaDetailsTab(tab);
      const currentTabIndex = currentTab - 1;

      if (tabs[currentTabIndex].isProtected) {
        activeTabHandler(1);
      }
      getDetailsByFQN();
      getEntityFeedCount();
    }
  }, [databaseSchemaPermission, databaseSchemaFQN]);

  useEffect(() => {
    tablePaginationHandler(INITIAL_PAGING_VALUE);
  }, [databaseSchema]);

  useEffect(() => {
    fetchDatabaseSchemaPermission();
  }, [databaseSchemaFQN]);

  // alwyas Keep this useEffect at the end...
  useEffect(() => {
    isMounting.current = false;
    appState.inPageSearchText = '';
  }, []);

  return (
    <Fragment>
      {isLoading ? (
        <Loader />
      ) : error ? (
        <ErrorPlaceHolder>
          <p data-testid="error-message">{error}</p>
        </ErrorPlaceHolder>
      ) : (
        <>
          {databaseSchemaPermission.ViewAll ||
          databaseSchemaPermission.ViewBasic ? (
            <PageContainerV1>
              <Row
                className="p-x-md p-t-lg"
                data-testid="page-container"
                gutter={[0, 12]}>
                {IsSchemaDetailsLoading ? (
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
                        <TitleBreadcrumb titleLinks={slashedTableName} />
                        <ManageButton
                          isRecursiveDelete
                          allowSoftDelete={false}
                          canDelete={databaseSchemaPermission.Delete}
                          entityFQN={databaseSchemaFQN}
                          entityId={databaseSchemaId}
                          entityName={databaseSchemaName}
                          entityType={EntityType.DATABASE_SCHEMA}
                        />
                      </Space>
                    </Col>
                    <Col span={24}>
                      {extraInfo.map((info, index) => (
                        <Space key={index}>
                          <EntitySummaryDetails
                            currentOwner={databaseSchema?.owner}
                            data={info}
                            removeOwner={
                              databaseSchemaPermission.EditOwner ||
                              databaseSchemaPermission.EditAll
                                ? handleRemoveOwner
                                : undefined
                            }
                            updateOwner={
                              databaseSchemaPermission.EditOwner ||
                              databaseSchemaPermission.EditAll
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
                        entityFqn={databaseSchemaFQN}
                        entityName={databaseSchemaName}
                        entityType={EntityType.DATABASE_SCHEMA}
                        hasEditAccess={
                          databaseSchemaPermission.EditDescription ||
                          databaseSchemaPermission.EditAll
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
                  <Row className="m-t-xss">
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
                        <Fragment>{getSchemaTableList()}</Fragment>
                      )}
                      {activeTab === 2 && (
                        <Card className="p-t-xss p-b-md">
                          <Row className="entity-feed-list" id="activityfeed">
                            <Col offset={4} span={16}>
                              <ActivityFeedList
                                hideFeedFilter
                                hideThreadFilter
                                isEntityFeed
                                withSidePanel
                                className=""
                                deletePostHandler={deletePostHandler}
                                entityName={databaseSchemaName}
                                feedList={entityThread}
                                postFeedHandler={postFeedHandler}
                                updateThreadHandler={updateThreadHandler}
                              />
                            </Col>
                          </Row>
                        </Card>
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
    </Fragment>
  );
};

export default observer(DatabaseSchemaPage);
