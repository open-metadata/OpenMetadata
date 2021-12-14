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
import { getServiceById } from '../../axiosAPIs/serviceAPI';
import { getDatabaseTables } from '../../axiosAPIs/tableAPI';
import Description from '../../components/common/description/Description';
import NextPrevious from '../../components/common/next-previous/NextPrevious';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import TabsPane from '../../components/common/TabsPane/TabsPane';
import TitleBreadcrumb from '../../components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainer from '../../components/containers/PageContainer';
import Loader from '../../components/Loader/Loader';
import Tags from '../../components/tags/tags';
import {
  getDatasetDetailsPath,
  getExplorePathWithSearch,
  getServiceDetailsPath,
  pagingObject,
} from '../../constants/constants';
import { ServiceCategory } from '../../enums/service.enum';
import { Database } from '../../generated/entity/data/database';
import { Table } from '../../generated/entity/data/table';
import { isEven } from '../../utils/CommonUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { getOwnerFromId, getUsagePercentile } from '../../utils/TableUtils';
import { getTableTags } from '../../utils/TagsUtils';

const DatabaseDetails: FunctionComponent = () => {
  // User Id for getting followers
  const [slashedTableName, setSlashedTableName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const { databaseFQN } = useParams() as Record<string, string>;
  const [isLoading, setIsLoading] = useState(true);
  const [database, setDatabase] = useState<Database>();
  const [serviceName, setServiceName] = useState<string>();
  const [tableData, setTableData] = useState<Array<Table>>([]);

  const [databaseName, setDatabaseName] = useState<string>(
    databaseFQN.split('.').slice(-1).pop() || ''
  );
  const [isEdit, setIsEdit] = useState(false);
  const [description, setDescription] = useState('');
  const [databaseId, setDatabaseId] = useState('');
  const [tablePaging, setTablePaging] = useState<Paging>(pagingObject);
  const [tableInstanceCount, setTableInstanceCount] = useState<number>(0);

  const [activeTab, setActiveTab] = useState<number>(1);

  const history = useHistory();
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

  const fetchDatabaseTablesAndDBTModels = () => {
    setIsLoading(true);
    Promise.allSettled([fetchDatabaseTables()]).finally(() => {
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

            <div data-testid="description-container">
              <Description
                description={description}
                entityName={databaseName}
                isEdit={isEdit}
                onCancel={onCancel}
                onDescriptionEdit={onDescriptionEdit}
                onDescriptionUpdate={onDescriptionUpdate}
              />
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
                                    type="label"
                                  />
                                ))}
                                {getTableTags(table.columns).map(
                                  (tag, tagIdx) => (
                                    <Tags
                                      key={tagIdx}
                                      startWith="#"
                                      tag={tag}
                                      type="label"
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
              </div>
            </div>
          </div>
        </PageContainer>
      )}
    </>
  );
};

export default observer(DatabaseDetails);
