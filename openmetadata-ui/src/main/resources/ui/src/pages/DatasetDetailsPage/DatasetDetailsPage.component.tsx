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
import { isEmpty, isUndefined } from 'lodash';
import { observer } from 'mobx-react';
import {
  EntityFieldThreadCount,
  EntityTags,
  EntityThread,
  LeafNodes,
  LineagePos,
  LoadingNodeState,
} from 'Models';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import AppState from '../../AppState';
import {
  getAllFeeds,
  getFeedCount,
  postFeedById,
  postThread,
} from '../../axiosAPIs/feedsAPI';
import { getLineageByFQN } from '../../axiosAPIs/lineageAPI';
import { addLineage, deleteLineageEdge } from '../../axiosAPIs/miscAPI';
import {
  addColumnTestCase,
  addFollower,
  addTableTestCase,
  deleteColumnTestCase,
  deleteTableTestCase,
  getTableDetailsByFQN,
  patchTableDetails,
  removeFollower,
} from '../../axiosAPIs/tableAPI';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import DatasetDetails from '../../components/DatasetDetails/DatasetDetails.component';
import {
  Edge,
  EdgeData,
} from '../../components/EntityLineage/EntityLineage.interface';
import Loader from '../../components/Loader/Loader';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import {
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getServiceDetailsPath,
  getTableTabPath,
  getVersionPath,
} from '../../constants/constants';
import { ColumnTestType } from '../../enums/columnTest.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { CreateTableTest } from '../../generated/api/tests/createTableTest';
import {
  Column,
  EntityReference,
  Table,
  TableData,
  TableJoins,
  TableType,
  TypeUsedToReturnUsageDetailsOfAnEntity,
} from '../../generated/entity/data/table';
import { User } from '../../generated/entity/teams/user';
import { TableTest, TableTestType } from '../../generated/tests/tableTest';
import { EntityLineage } from '../../generated/type/entityLineage';
import { Paging } from '../../generated/type/paging';
import { TagLabel } from '../../generated/type/tagLabel';
import {
  ColumnTest,
  DatasetTestModeType,
  ModifiedTableColumn,
} from '../../interface/dataQuality.interface';
import jsonData from '../../jsons/en';
import {
  addToRecentViewed,
  getCurrentUserId,
  getEntityMissingError,
  getFields,
  getPartialNameFromTableFQN,
} from '../../utils/CommonUtils';
import {
  datasetTableTabs,
  defaultFields,
  getCurrentDatasetTab,
} from '../../utils/DatasetDetailsUtils';
import { getEntityFeedLink, getEntityLineage } from '../../utils/EntityUtils';
import { deletePost, getUpdatedThread } from '../../utils/FeedUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const DatasetDetailsPage: FunctionComponent = () => {
  const history = useHistory();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLineageLoading, setIsLineageLoading] = useState<boolean>(false);
  const [isSampleDataLoading, setIsSampleDataLoading] =
    useState<boolean>(false);
  const [isTableQueriesLoading, setIsTableQueriesLoading] =
    useState<boolean>(false);
  const [isentityThreadLoading, setIsentityThreadLoading] =
    useState<boolean>(false);
  const USERId = getCurrentUserId();
  const [tableId, setTableId] = useState('');
  const [tier, setTier] = useState<TagLabel>();
  const [name, setName] = useState('');
  const [followers, setFollowers] = useState<Array<User>>([]);
  const [slashedTableName, setSlashedTableName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [description, setDescription] = useState('');
  const [columns, setColumns] = useState<ModifiedTableColumn[]>([]);
  const [sampleData, setSampleData] = useState<TableData>({
    columns: [],
    rows: [],
  });
  const [tableTags, setTableTags] = useState<Array<EntityTags>>([]);
  const [owner, setOwner] = useState<
    Table['owner'] & { displayName?: string }
  >();
  const [joins, setJoins] = useState<TableJoins>({
    startDate: new Date(),
    dayCount: 0,
    columnJoins: [],
  });
  const [tableType, setTableType] = useState<TableType>(TableType.Regular);
  const [tableProfile, setTableProfile] = useState<Table['tableProfile']>([]);
  const [tableDetails, setTableDetails] = useState<Table>({} as Table);
  const { datasetFQN, tab } = useParams() as Record<string, string>;
  const [activeTab, setActiveTab] = useState<number>(getCurrentDatasetTab(tab));
  const [entityLineage, setEntityLineage] = useState<EntityLineage>(
    {} as EntityLineage
  );
  const [leafNodes, setLeafNodes] = useState<LeafNodes>({} as LeafNodes);
  const [usageSummary, setUsageSummary] =
    useState<TypeUsedToReturnUsageDetailsOfAnEntity>(
      {} as TypeUsedToReturnUsageDetailsOfAnEntity
    );
  const [currentVersion, setCurrentVersion] = useState<string>();
  const [isNodeLoading, setNodeLoading] = useState<LoadingNodeState>({
    id: undefined,
    state: false,
  });
  const [tableFQN, setTableFQN] = useState<string>(
    getPartialNameFromTableFQN(
      datasetFQN,
      ['service', 'database', 'schema', 'table'],
      FQN_SEPARATOR_CHAR
    )
  );
  const [deleted, setDeleted] = useState<boolean>(false);
  const [isError, setIsError] = useState(false);
  const [tableQueries, setTableQueries] = useState<Table['tableQueries']>([]);
  const [entityThread, setEntityThread] = useState<EntityThread[]>([]);

  const [feedCount, setFeedCount] = useState<number>(0);
  const [entityFieldThreadCount, setEntityFieldThreadCount] = useState<
    EntityFieldThreadCount[]
  >([]);

  // Data Quality tab state
  const [testMode, setTestMode] = useState<DatasetTestModeType>('table');
  const [showTestForm, setShowTestForm] = useState(false);
  const [tableTestCase, setTableTestCase] = useState<TableTest[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>();

  const [paging, setPaging] = useState<Paging>({} as Paging);

  const handleTestModeChange = (mode: DatasetTestModeType) => {
    setTestMode(mode);
  };

  const handleShowTestForm = (value: boolean) => {
    setShowTestForm(value);
  };

  const handleSelectedColumn = (value: string | undefined) => {
    setSelectedColumn(value);
  };

  const activeTabHandler = (tabValue: number) => {
    const currentTabIndex = tabValue - 1;
    if (datasetTableTabs[currentTabIndex].path !== tab) {
      setActiveTab(
        getCurrentDatasetTab(datasetTableTabs[currentTabIndex].path)
      );
      history.push({
        pathname: getTableTabPath(
          tableFQN,
          datasetTableTabs[currentTabIndex].path
        ),
      });
      handleShowTestForm(false);
    }
  };

  const qualityTestFormHandler = (
    tabValue: number,
    testMode?: DatasetTestModeType,
    columnName?: string
  ) => {
    activeTabHandler(tabValue);
    if (testMode && columnName) {
      setTestMode(testMode as DatasetTestModeType);
      setSelectedColumn(columnName);
      setShowTestForm(true);
    }
  };

  const getLineageData = () => {
    setIsLineageLoading(true);
    getLineageByFQN(tableFQN, EntityType.TABLE)
      .then((res: AxiosResponse) => {
        if (res.data) {
          setEntityLineage(res.data);
        } else {
          showErrorToast(jsonData['api-error-messages']['fetch-lineage-error']);
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-lineage-error']
        );
      })
      .finally(() => {
        setIsLineageLoading(false);
      });
  };

  const getFeedData = (after?: string) => {
    setIsentityThreadLoading(true);
    getAllFeeds(getEntityFeedLink(EntityType.TABLE, tableFQN), after)
      .then((res: AxiosResponse) => {
        const { data, paging: pagingObj } = res.data;
        if (data) {
          setPaging(pagingObj);
          setEntityThread((prevData) => [...prevData, ...data]);
        } else {
          showErrorToast(
            jsonData['api-error-messages']['fetch-entity-feed-error']
          );
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

  const fetchTableDetail = () => {
    setIsLoading(true);
    getTableDetailsByFQN(
      tableFQN,
      getFields(defaultFields, datasetTableTabs[activeTab - 1].field ?? '')
    )
      .then((res: AxiosResponse) => {
        if (res.data) {
          const {
            description,
            id,
            name,
            columns,
            database,
            deleted,
            owner,
            usageSummary,
            followers,
            fullyQualifiedName,
            joins,
            tags,
            sampleData,
            tableProfile,
            tableType,
            version,
            service,
            serviceType,
            databaseSchema,
          } = res.data;
          setTableDetails(res.data);
          setTableId(id);
          setCurrentVersion(version);
          setTier(getTierTags(tags));
          setTableType(tableType);
          setOwner(owner);
          setFollowers(followers);
          setDeleted(deleted);
          setSlashedTableName([
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
              name: getPartialNameFromTableFQN(database.fullyQualifiedName, [
                'database',
              ]),
              url: getDatabaseDetailsPath(database.fullyQualifiedName),
            },
            {
              name: getPartialNameFromTableFQN(
                databaseSchema.fullyQualifiedName,
                ['schema']
              ),
              url: getDatabaseSchemaDetailsPath(
                databaseSchema.fullyQualifiedName
              ),
            },
            {
              name: name,
              url: '',
              activeTitle: true,
            },
          ]);

          if (res.data.tableTests && res.data.tableTests.length > 0) {
            setTableTestCase(res.data.tableTests);
          }

          addToRecentViewed({
            entityType: EntityType.TABLE,
            fqn: fullyQualifiedName,
            serviceType: serviceType,
            timestamp: 0,
          });
          setName(name);

          setDescription(description);
          setColumns(columns || []);
          setSampleData(sampleData);
          setTableProfile(tableProfile || []);
          setTableTags(getTagsWithoutTier(tags));
          setUsageSummary(usageSummary);
          setJoins(joins);
        } else {
          showErrorToast(
            jsonData['api-error-messages']['fetch-table-details-error']
          );
          setIsError(true);
        }
      })
      .catch((err: AxiosError) => {
        if (err.response?.status === 404) {
          setIsError(true);
        } else {
          showErrorToast(
            err,
            jsonData['api-error-messages']['fetch-table-details-error']
          );
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const fetchTabSpecificData = (tabField = '') => {
    switch (tabField) {
      case TabSpecificField.SAMPLE_DATA: {
        if (!isUndefined(sampleData)) {
          break;
        } else {
          setIsSampleDataLoading(true);
          getTableDetailsByFQN(tableFQN, tabField)
            .then((res: AxiosResponse) => {
              if (res.data) {
                const { sampleData } = res.data;
                setSampleData(sampleData);
              } else {
                showErrorToast(
                  jsonData['api-error-messages']['fetch-sample-data-error']
                );
              }
            })
            .catch((err: AxiosError) => {
              showErrorToast(
                err,
                jsonData['api-error-messages']['fetch-sample-data-error']
              );
            })
            .finally(() => setIsSampleDataLoading(false));

          break;
        }
      }

      case TabSpecificField.LINEAGE: {
        if (!deleted) {
          if (isEmpty(entityLineage)) {
            getLineageData();
          }

          break;
        }

        break;
      }

      case TabSpecificField.TABLE_QUERIES: {
        if ((tableQueries?.length ?? 0) > 0) {
          break;
        } else {
          setIsTableQueriesLoading(true);
          getTableDetailsByFQN(tableFQN, tabField)
            .then((res: AxiosResponse) => {
              if (res.data) {
                const { tableQueries } = res.data;
                setTableQueries(tableQueries);
              } else {
                showErrorToast(
                  jsonData['api-error-messages']['fetch-table-queries-error']
                );
              }
            })
            .catch((err: AxiosError) => {
              showErrorToast(
                err,
                jsonData['api-error-messages']['fetch-table-queries-error']
              );
            })
            .finally(() => setIsTableQueriesLoading(false));

          break;
        }
      }
      case TabSpecificField.ACTIVITY_FEED: {
        getFeedData();

        break;
      }

      default:
        break;
    }
  };

  useEffect(() => {
    if (datasetTableTabs[activeTab - 1].path !== tab) {
      setActiveTab(getCurrentDatasetTab(tab));
    }
    setEntityThread([]);
  }, [tab]);

  useEffect(() => {
    fetchTabSpecificData(datasetTableTabs[activeTab - 1].field);
  }, [activeTab]);

  const getEntityFeedCount = () => {
    getFeedCount(getEntityFeedLink(EntityType.TABLE, tableFQN))
      .then((res: AxiosResponse) => {
        if (res.data) {
          setFeedCount(res.data.totalCount);
          setEntityFieldThreadCount(res.data.counts);
        } else {
          showErrorToast(
            jsonData['api-error-messages']['fetch-entity-feed-count-error']
          );
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-entity-feed-count-error']
        );
      });
  };

  const saveUpdatedTableData = (updatedData: Table): Promise<AxiosResponse> => {
    const jsonPatch = compare(tableDetails, updatedData);

    return patchTableDetails(
      tableId,
      jsonPatch
    ) as unknown as Promise<AxiosResponse>;
  };

  const descriptionUpdateHandler = (updatedTable: Table) => {
    saveUpdatedTableData(updatedTable)
      .then((res: AxiosResponse) => {
        if (res.data) {
          const { description, version } = res.data;
          setCurrentVersion(version);
          setTableDetails(res.data);
          setDescription(description);
          getEntityFeedCount();
        } else {
          showErrorToast(
            jsonData['api-error-messages']['update-description-error']
          );
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-description-error']
        );
      });
  };

  const columnsUpdateHandler = (updatedTable: Table) => {
    saveUpdatedTableData(updatedTable)
      .then((res: AxiosResponse) => {
        if (res.data) {
          const { columns, version } = res.data;
          setCurrentVersion(version);
          setTableDetails(res.data);
          setColumns(columns);
          getEntityFeedCount();
        } else {
          showErrorToast(jsonData['api-error-messages']['update-entity-error']);
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-entity-error']
        );
      });
  };

  const onTagUpdate = (updatedTable: Table) => {
    saveUpdatedTableData(updatedTable)
      .then((res: AxiosResponse) => {
        if (res.data) {
          setTier(getTierTags(res.data.tags));
          setCurrentVersion(res.data.version);
          setTableTags(getTagsWithoutTier(res.data.tags));
          getEntityFeedCount();
        } else {
          showErrorToast(jsonData['api-error-messages']['update-tags-error']);
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-tags-error']
        );
      });
  };

  const settingsUpdateHandler = (updatedTable: Table): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      saveUpdatedTableData(updatedTable)
        .then((res) => {
          if (res.data) {
            const { version, owner, tags } = res.data;
            setCurrentVersion(version);
            setTableDetails(res.data);
            setOwner(owner);
            setTier(getTierTags(tags));
            getEntityFeedCount();
            resolve();
          } else {
            showErrorToast(
              jsonData['api-error-messages']['update-entity-error']
            );
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['update-entity-error']
          );
          reject();
        });
    });
  };

  const followTable = () => {
    addFollower(tableId, USERId)
      .then((res: AxiosResponse) => {
        if (res.data) {
          const { newValue } = res.data.changeDescription.fieldsAdded[0];

          setFollowers([...followers, ...newValue]);
        } else {
          showErrorToast(
            jsonData['api-error-messages']['update-entity-follow-error']
          );
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-entity-follow-error']
        );
      });
  };
  const unfollowTable = () => {
    removeFollower(tableId, USERId)
      .then((res: AxiosResponse) => {
        if (res.data) {
          const { oldValue } = res.data.changeDescription.fieldsDeleted[0];

          setFollowers(
            followers.filter((follower) => follower.id !== oldValue[0].id)
          );
        } else {
          showErrorToast(
            jsonData['api-error-messages']['update-entity-unfollow-error']
          );
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-entity-unfollow-error']
        );
      });
  };

  const versionHandler = () => {
    history.push(
      getVersionPath(EntityType.TABLE, tableFQN, currentVersion as string)
    );
  };

  const setLeafNode = (val: EntityLineage, pos: LineagePos) => {
    if (pos === 'to' && val.downstreamEdges?.length === 0) {
      setLeafNodes((prev) => ({
        ...prev,
        downStreamNode: [...(prev.downStreamNode ?? []), val.entity.id],
      }));
    }
    if (pos === 'from' && val.upstreamEdges?.length === 0) {
      setLeafNodes((prev) => ({
        ...prev,
        upStreamNode: [...(prev.upStreamNode ?? []), val.entity.id],
      }));
    }
  };

  const entityLineageHandler = (lineage: EntityLineage) => {
    setEntityLineage(lineage);
  };

  const loadNodeHandler = (node: EntityReference, pos: LineagePos) => {
    setNodeLoading({ id: node.id, state: true });
    getLineageByFQN(node.name, node.type)
      .then((res: AxiosResponse) => {
        if (!res.data) {
          setLeafNode(res.data, pos);
          setEntityLineage(getEntityLineage(entityLineage, res.data, pos));
        } else {
          showErrorToast(
            jsonData['api-error-messages']['fetch-lineage-node-error']
          );
        }
        setTimeout(() => {
          setNodeLoading((prev) => ({ ...prev, state: false }));
        }, 500);
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-lineage-node-error']
        );
      });
  };

  const addLineageHandler = (edge: Edge): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      addLineage(edge)
        .then(() => {
          resolve();
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['add-lineage-error']
          );
          reject();
        });
    });
  };

  const removeLineageHandler = (data: EdgeData) => {
    deleteLineageEdge(
      data.fromEntity,
      data.fromId,
      data.toEntity,
      data.toId
    ).catch((err: AxiosError) => {
      showErrorToast(
        err,
        jsonData['api-error-messages']['delete-lineage-error']
      );
    });
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
          showErrorToast(jsonData['api-error-messages']['add-feed-error']);
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
            jsonData['api-error-messages']['create-conversation-error']
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

  const handleAddTableTestCase = (data: CreateTableTest) => {
    addTableTestCase(tableDetails.id, data)
      .then((res: AxiosResponse) => {
        if (res.data) {
          const { tableTests } = res.data;
          let itsNewTest = true;
          const existingData = tableTestCase.map((test) => {
            if (test.name === tableTests[0].name) {
              itsNewTest = false;

              return tableTests[0];
            }

            return test;
          });
          if (itsNewTest) {
            existingData.push(tableTests[0]);
          }
          setTableTestCase(existingData);
          handleShowTestForm(false);
          showSuccessToast(
            `Test ${data.testCase.tableTestType} for ${name} has been ${
              itsNewTest ? 'added' : 'updated'
            } successfully.`
          );
        } else {
          showErrorToast(
            jsonData['api-error-messages']['add-table-test-error']
          );
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['add-table-test-error']
        );
      });
  };

  const handleAddColumnTestCase = (data: ColumnTest) => {
    addColumnTestCase(tableDetails.id, data)
      .then((res: AxiosResponse) => {
        if (res.data) {
          let itsNewTest = true;
          const columnTestRes = res.data.columns.find(
            (d: Column) => d.name === data.columnName
          );
          const updatedColumns = columns.map((d) => {
            if (d.name === data.columnName) {
              const oldTest =
                (d as ModifiedTableColumn)?.columnTests?.filter(
                  (test) => test.id !== columnTestRes.columnTests[0].id
                ) || [];

              itsNewTest =
                oldTest.length ===
                (d as ModifiedTableColumn)?.columnTests?.length;

              return {
                ...d,
                columnTests: [...oldTest, columnTestRes.columnTests[0]],
              };
            }

            return d;
          });
          setColumns(updatedColumns);
          handleShowTestForm(false);
          setSelectedColumn(undefined);
          showSuccessToast(
            `Test ${data.testCase.columnTestType} for ${
              data.columnName
            } has been ${itsNewTest ? 'added' : 'updated'} successfully.`
          );
        } else {
          showErrorToast(
            jsonData['api-error-messages']['add-column-test-error']
          );
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['add-column-test-error']
        );
      });
  };

  const handleRemoveTableTest = (testType: TableTestType) => {
    deleteTableTestCase(tableDetails.id, testType)
      .then(() => {
        const updatedTest = tableTestCase.filter(
          (d) => d.testCase.tableTestType !== testType
        );
        setTableTestCase(updatedTest);
        showSuccessToast(jsonData['api-success-messages']['delete-test']);
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['delete-test-error']
        );
      });
  };

  const handleRemoveColumnTest = (
    columnName: string,
    testType: ColumnTestType
  ) => {
    deleteColumnTestCase(tableDetails.id, columnName, testType)
      .then(() => {
        const updatedColumns = columns.map((d) => {
          if (d.name === columnName) {
            const updatedTest =
              (d as ModifiedTableColumn)?.columnTests?.filter(
                (test) => test.testCase.columnTestType !== testType
              ) || [];

            return {
              ...d,
              columnTests: updatedTest,
            };
          }

          return d;
        });
        setColumns(updatedColumns);
        showSuccessToast(jsonData['api-success-messages']['delete-test']);
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['delete-test-error']
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
                jsonData['api-error-messages'][
                  'fetch-updated-conversation-error'
                ]
              );
            }
          })
          .catch((error: AxiosError) => {
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
  useEffect(() => {
    fetchTableDetail();
    setActiveTab(getCurrentDatasetTab(tab));
    getEntityFeedCount();
  }, [tableFQN]);

  useEffect(() => {
    setTableFQN(
      getPartialNameFromTableFQN(
        datasetFQN,
        ['service', 'database', 'schema', 'table'],
        FQN_SEPARATOR_CHAR
      )
    );
    setEntityLineage({} as EntityLineage);
  }, [datasetFQN]);

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : isError ? (
        <ErrorPlaceHolder>
          {getEntityMissingError('table', tableFQN)}
        </ErrorPlaceHolder>
      ) : (
        <DatasetDetails
          activeTab={activeTab}
          addLineageHandler={addLineageHandler}
          columns={columns}
          columnsUpdateHandler={columnsUpdateHandler}
          createThread={createThread}
          dataModel={tableDetails.dataModel}
          datasetFQN={tableFQN}
          deletePostHandler={deletePostHandler}
          deleted={deleted}
          description={description}
          descriptionUpdateHandler={descriptionUpdateHandler}
          entityFieldThreadCount={entityFieldThreadCount}
          entityLineage={entityLineage}
          entityLineageHandler={entityLineageHandler}
          entityName={name}
          entityThread={entityThread}
          feedCount={feedCount}
          fetchFeedHandler={getFeedData}
          followTableHandler={followTable}
          followers={followers}
          handleAddColumnTestCase={handleAddColumnTestCase}
          handleAddTableTestCase={handleAddTableTestCase}
          handleRemoveColumnTest={handleRemoveColumnTest}
          handleRemoveTableTest={handleRemoveTableTest}
          handleSelectedColumn={handleSelectedColumn}
          handleShowTestForm={handleShowTestForm}
          handleTestModeChange={handleTestModeChange}
          isLineageLoading={isLineageLoading}
          isNodeLoading={isNodeLoading}
          isQueriesLoading={isTableQueriesLoading}
          isSampleDataLoading={isSampleDataLoading}
          isentityThreadLoading={isentityThreadLoading}
          joins={joins}
          lineageLeafNodes={leafNodes}
          loadNodeHandler={loadNodeHandler}
          owner={owner as Table['owner'] & { displayName: string }}
          paging={paging}
          postFeedHandler={postFeedHandler}
          qualityTestFormHandler={qualityTestFormHandler}
          removeLineageHandler={removeLineageHandler}
          sampleData={sampleData}
          selectedColumn={selectedColumn as string}
          setActiveTabHandler={activeTabHandler}
          settingsUpdateHandler={settingsUpdateHandler}
          showTestForm={showTestForm}
          slashedTableName={slashedTableName}
          tableDetails={tableDetails}
          tableProfile={tableProfile}
          tableQueries={tableQueries}
          tableTags={tableTags}
          tableTestCase={tableTestCase}
          tableType={tableType}
          tagUpdateHandler={onTagUpdate}
          testMode={testMode}
          tier={tier as TagLabel}
          unfollowTableHandler={unfollowTable}
          usageSummary={usageSummary}
          users={AppState.users}
          version={currentVersion}
          versionHandler={versionHandler}
        />
      )}
    </>
  );
};

export default observer(DatasetDetailsPage);
