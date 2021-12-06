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

import { AxiosResponse } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { isNil } from 'lodash';
import { observer } from 'mobx-react';
import { Paging } from 'Models';
import React, { FunctionComponent, useEffect, useRef, useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import appState from '../../AppState';
import {
  getDatabaseDetailsByFQN,
  patchDatabaseDetails,
} from '../../axiosAPIs/databaseAPI';
import { getDatabaseDBTModels } from '../../axiosAPIs/dbtModelAPI';
import { postFeed } from '../../axiosAPIs/feedsAPI';
import { getServiceById } from '../../axiosAPIs/serviceAPI';
import { getDatabaseTables } from '../../axiosAPIs/tableAPI';
import NextPrevious from '../../components/common/next-previous/NextPrevious';
import NonAdminAction from '../../components/common/non-admin-action/NonAdminAction';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import TabsPane from '../../components/common/TabsPane/TabsPane';
import TitleBreadcrumb from '../../components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainer from '../../components/containers/PageContainer';
import Loader from '../../components/Loader/Loader';
import { ModalWithMarkdownEditor } from '../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import Tags from '../../components/tags/tags';
import {
  getDatasetDetailsPath,
  getDBTModelDetailsPath,
  getExplorePathWithSearch,
  getServiceDetailsPath,
  pagingObject,
  TITLE_FOR_NON_ADMIN_ACTION,
} from '../../constants/constants';
import { ServiceCategory } from '../../enums/service.enum';
import { Database } from '../../generated/entity/data/database';
import { Dbtmodel } from '../../generated/entity/data/dbtmodel';
import { Table } from '../../generated/entity/data/table';
import useToastContext from '../../hooks/useToastContext';
import { getCurrentUserId, isEven } from '../../utils/CommonUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getOwnerFromId, getUsagePercentile } from '../../utils/TableUtils';
import { getTableTags } from '../../utils/TagsUtils';

const DatabaseDetails: FunctionComponent = () => {
  // User Id for getting followers
  const USERId = getCurrentUserId();
  const [slashedTableName, setSlashedTableName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const { databaseFQN } = useParams() as Record<string, string>;
  const [isLoading, setIsLoading] = useState(true);
  const [database, setDatabase] = useState<Database>();
  const [serviceName, setServiceName] = useState<string>();
  const [tableData, setTableData] = useState<Array<Table>>([]);
  const [dbtModelData, setDbtModelData] = useState<Array<Dbtmodel>>([]);

  const [databaseName, setDatabaseName] = useState<string>(
    databaseFQN.split('.').slice(-1).pop() || ''
  );
  const [isEdit, setIsEdit] = useState(false);
  const [description, setDescription] = useState('');
  const [databaseId, setDatabaseId] = useState('');
  const [tablePaging, setTablePaging] = useState<Paging>(pagingObject);
  const [dbtModelPaging, setDbtModelPaging] = useState<Paging>(pagingObject);
  const [tableInstanceCount, setTableInstanceCount] = useState<number>(0);
  const [dbtModelInstanceCount, setDbtModelInstanceCount] = useState<number>(0);

  const [activeTab, setActiveTab] = useState<number>(1);

  const history = useHistory();
  const showToast = useToastContext();
  const isMounting = useRef(true);

  const tabs = [
    {
      name: 'Tables',
      icon: {
        alt: 'tables',
        name: 'table-grey',
        title: 'Tables',
      },
      count: tableInstanceCount,
      isProtected: false,
      position: 1,
    },
    {
      name: 'DBT Models',
      icon: {
        alt: 'dbt_models',
        name: 'dbtmodel-grey',
        title: 'DBT Models',
      },
      count: dbtModelInstanceCount,
      isProtected: false,
      position: 2,
    },
  ];

  const fetchDatabaseTables = (paging?: string) => {
    return new Promise<void>((resolve, reject) => {
      getDatabaseTables(databaseFQN, paging, [
        'owner',
        'tags',
        'columns',
        'usageSummary',
      ])
        .then((res: AxiosResponse) => {
          if (res.data.data) {
            setTableData(res.data.data);
            setTablePaging(res.data.paging);
            setTableInstanceCount(res.data.paging.total);
          } else {
            setTableData([]);
            setTablePaging(pagingObject);
          }
          resolve();
        })
        .catch(() => {
          reject();
        });
    });
  };

  const fetchDatabaseDBTModels = (paging?: string) => {
    return new Promise<void>((resolve, reject) => {
      getDatabaseDBTModels(databaseFQN, paging, ['owner', 'tags', 'columns'])
        .then((res: AxiosResponse) => {
          if (res.data.data) {
            setDbtModelData(res.data.data);
            setDbtModelPaging(res.data.paging);
            setDbtModelInstanceCount(res.data.paging.total);
          } else {
            setDbtModelData([]);
            setDbtModelPaging(pagingObject);
          }
          resolve();
        })
        .catch(() => {
          reject();
        });
    });
  };

  const fetchDatabaseTablesAndDBTModels = () => {
    setIsLoading(true);
    Promise.allSettled([
      fetchDatabaseTables(),
      fetchDatabaseDBTModels(),
    ]).finally(() => {
      setIsLoading(false);
    });
  };

  const getDetailsByFQN = () => {
    getDatabaseDetailsByFQN(databaseFQN).then((res: AxiosResponse) => {
      const { description, id, name, service } = res.data;
      setDatabase(res.data);
      setDescription(description);
      setDatabaseId(id);
      setDatabaseName(name);

      getServiceById('databaseServices', service?.id).then(
        (resService: AxiosResponse) => {
          setServiceName(resService.data.name);
          setSlashedTableName([
            {
              name: resService.data.name,
              url: resService.data.name
                ? getServiceDetailsPath(
                    resService.data.name,
                    resService.data.serviceType,
                    ServiceCategory.DATABASE_SERVICES
                  )
                : '',
              imgSrc: resService.data.serviceType
                ? serviceTypeLogo(resService.data.serviceType)
                : undefined,
            },
            {
              name: name,
              url: '',
              activeTitle: true,
            },
          ]);
        }
      );
    });
    fetchDatabaseTablesAndDBTModels();
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
      saveUpdatedDatabaseData(updatedDatabaseDetails).then(() => {
        setDatabase(updatedDatabaseDetails);
        setDescription(updatedHTML);
        setIsEdit(false);
      });
    }
  };

  const onSuggest = (updatedHTML: string) => {
    if (description !== updatedHTML) {
      const data = {
        message: updatedHTML,
        from: USERId,
        addressedToEntity: {
          id: databaseId,
          name: databaseName,
          type: 'Table',
        },
      };
      postFeed(data).then(() => {
        setIsEdit(false);
        showToast({
          variant: 'info',
          body: 'Suggestion posted Successfully!',
        });
      });
    }
  };

  const onDescriptionEdit = (): void => {
    setIsEdit(true);
  };

  const activeTabHandler = (tabValue: number) => {
    setActiveTab(tabValue);
  };

  const tablePagingHandler = (cursorType: string) => {
    const pagingString = `&${cursorType}=${
      tablePaging[cursorType as keyof typeof tablePaging]
    }`;
    setIsLoading(true);
    fetchDatabaseTables(pagingString).finally(() => {
      setIsLoading(false);
    });
  };

  const dbtModelPagingHandler = (cursorType: string) => {
    const pagingString = `&${cursorType}=${
      dbtModelPaging[cursorType as keyof typeof dbtModelPaging]
    }`;
    setIsLoading(true);
    fetchDatabaseDBTModels(pagingString).finally(() => {
      setIsLoading(false);
    });
  };

  useEffect(() => {
    if (!isMounting.current && appState.inPageSearchText) {
      history.push(
        `${getExplorePathWithSearch(
          appState.inPageSearchText
        )}?database=${databaseName}&service=${serviceName}`
      );
    }
  }, [appState.inPageSearchText]);

  useEffect(() => {
    getDetailsByFQN();
  }, []);

  // alwyas Keep this useEffect at the end...
  useEffect(() => {
    isMounting.current = false;
    appState.inPageSearchText = '';
  }, []);

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : (
        <PageContainer>
          <div
            className="tw-px-4 tw-w-full tw-h-full tw-flex tw-flex-col"
            data-testid="page-container">
            <TitleBreadcrumb titleLinks={slashedTableName} />

            <div className="tw-bg-white tw-my-4">
              <div className="tw-col-span-3">
                <div
                  className="schema-description tw-flex tw-flex-col tw-h-full tw-relative tw-border tw-border-main tw-rounded-md"
                  data-testid="description-container">
                  <div className="tw-flex tw-items-center tw-px-3 tw-py-1 tw-border-b tw-border-main">
                    <span className="tw-flex-1 tw-leading-8 tw-m-0 tw-text-sm tw-font-normal">
                      Description
                    </span>
                    <div className="tw-flex-initial">
                      <NonAdminAction
                        position="left"
                        title={TITLE_FOR_NON_ADMIN_ACTION}>
                        <button
                          className="focus:tw-outline-none"
                          data-testid="description-edit-button"
                          onClick={onDescriptionEdit}>
                          <SVGIcons
                            alt="edit"
                            icon="icon-edit"
                            title="Edit"
                            width="12px"
                          />
                        </button>
                      </NonAdminAction>
                    </div>
                  </div>
                  <div className="tw-px-3 tw-pl-5 tw-py-2 tw-overflow-y-auto">
                    <div data-testid="description-data" id="description" />
                    {description ? (
                      <RichTextEditorPreviewer markdown={description} />
                    ) : (
                      <span className="tw-no-description">
                        No description added
                      </span>
                    )}
                    {isEdit && (
                      <ModalWithMarkdownEditor
                        header={`Edit description for ${databaseName}`}
                        placeholder="Enter Description"
                        value={description}
                        onCancel={onCancel}
                        onSave={onDescriptionUpdate}
                        onSuggest={onSuggest}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="tw-mt-1 tw-flex tw-flex-col tw-flex-grow">
              <TabsPane
                activeTab={activeTab}
                className="tw-flex-initial"
                setActiveTab={activeTabHandler}
                tabs={tabs}
              />
              <div className="tw-bg-white tw-flex-grow tw-py-4">
                {activeTab === 1 && (
                  <>
                    <table
                      className="tw-bg-white tw-w-full tw-mb-4"
                      data-testid="database-tables">
                      <thead data-testid="table-header">
                        <tr className="tableHead-row">
                          <th
                            className="tableHead-cell"
                            data-testid="header-name">
                            Table Name
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
                          <th
                            className="tableHead-cell tw-w-60"
                            data-testid="header-tags">
                            Tags
                          </th>
                        </tr>
                      </thead>
                      <tbody className="tableBody">
                        {tableData.length > 0 ? (
                          tableData.map((table, index) => (
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
                                    table.fullyQualifiedName
                                      ? getDatasetDetailsPath(
                                          table.fullyQualifiedName
                                        )
                                      : ''
                                  }>
                                  {table.name}
                                </Link>
                              </td>
                              <td className="tableBody-cell">
                                {table.description?.trim() ? (
                                  <RichTextEditorPreviewer
                                    markdown={table.description}
                                  />
                                ) : (
                                  <span className="tw-no-description">
                                    No description added
                                  </span>
                                )}
                              </td>
                              <td className="tableBody-cell">
                                <p>
                                  {getOwnerFromId(table?.owner?.id)?.name ||
                                    '--'}
                                </p>
                              </td>
                              <td className="tableBody-cell">
                                <p>
                                  {getUsagePercentile(
                                    table.usageSummary?.weeklyStats
                                      ?.percentileRank || 0
                                  )}
                                </p>
                              </td>
                              <td className="tableBody-cell">
                                {table.tags?.map((tag, tagIndex) => (
                                  <Tags
                                    className="tw-bg-gray-200"
                                    key={tagIndex}
                                    startWith="#"
                                    tag={{
                                      ...tag,
                                      tagFQN: tag.tagFQN?.startsWith(
                                        'Tier.Tier'
                                      )
                                        ? tag.tagFQN.split('.')[1]
                                        : tag.tagFQN,
                                    }}
                                  />
                                ))}
                                {getTableTags(table.columns).map(
                                  (tag, tagIdx) => (
                                    <Tags
                                      className="tw-bg-gray-200"
                                      key={tagIdx}
                                      startWith="#"
                                      tag={tag}
                                    />
                                  )
                                )}
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
                      !isNil(tablePaging.after) || !isNil(tablePaging.before)
                    ) && (
                      <NextPrevious
                        paging={tablePaging}
                        pagingHandler={tablePagingHandler}
                      />
                    )}
                  </>
                )}
                {activeTab === 2 && (
                  <>
                    <table
                      className="tw-bg-white tw-w-full tw-mb-4"
                      data-testid="database-tables">
                      <thead data-testid="table-header">
                        <tr className="tableHead-row">
                          <th
                            className="tableHead-cell"
                            data-testid="header-name">
                            DBT Model Name
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
                            className="tableHead-cell tw-w-60"
                            data-testid="header-tags">
                            Tags
                          </th>
                        </tr>
                      </thead>
                      <tbody className="tableBody">
                        {dbtModelData.length > 0 ? (
                          dbtModelData.map((dbtModel, index) => (
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
                                    dbtModel.fullyQualifiedName
                                      ? getDBTModelDetailsPath(
                                          dbtModel.fullyQualifiedName
                                        )
                                      : ''
                                  }>
                                  {dbtModel.name}
                                </Link>
                              </td>
                              <td className="tableBody-cell">
                                {dbtModel.description?.trim() ? (
                                  <RichTextEditorPreviewer
                                    markdown={dbtModel.description}
                                  />
                                ) : (
                                  <span className="tw-no-description">
                                    No description added
                                  </span>
                                )}
                              </td>
                              <td className="tableBody-cell">
                                <p>
                                  {getOwnerFromId(dbtModel?.owner?.id)?.name ||
                                    '--'}
                                </p>
                              </td>
                              <td className="tableBody-cell">
                                {dbtModel.tags?.map((tag, tagIndex) => (
                                  <Tags
                                    className="tw-bg-gray-200"
                                    key={tagIndex}
                                    startWith="#"
                                    tag={{
                                      ...tag,
                                      tagFQN: tag.tagFQN?.startsWith(
                                        'Tier.Tier'
                                      )
                                        ? tag.tagFQN.split('.')[1]
                                        : tag.tagFQN,
                                    }}
                                  />
                                ))}
                                {getTableTags(dbtModel.columns).map(
                                  (tag, tagIdx) => (
                                    <Tags
                                      className="tw-bg-gray-200"
                                      key={tagIdx}
                                      startWith="#"
                                      tag={tag}
                                    />
                                  )
                                )}
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
                      !isNil(dbtModelPaging.after) ||
                        !isNil(dbtModelPaging.before)
                    ) && (
                      <NextPrevious
                        paging={dbtModelPaging}
                        pagingHandler={dbtModelPagingHandler}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </PageContainer>
      )}
    </>
  );
};

export default observer(DatabaseDetails);
