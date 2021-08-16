/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { AxiosResponse } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { isEqual, isNil } from 'lodash';
import { observer } from 'mobx-react';
import { ColumnTags, TableColumn, TableDetail, TableJoinsData } from 'Models';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import AppState from '../../AppState';
import { getDatabase } from '../../axiosAPIs/databaseAPI';
import { postFeed } from '../../axiosAPIs/feedsAPI';
import { getServiceById } from '../../axiosAPIs/serviceAPI';
import {
  addFollower,
  getTableDetailsByFQN,
  patchTableDetails,
  removeFollower,
} from '../../axiosAPIs/tableAPI';
import NonAdminAction from '../../components/common/non-admin-action/NonAdminAction';
import PopOver from '../../components/common/popover/PopOver';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import TitleBreadcrumb from '../../components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainer from '../../components/containers/PageContainer';
import { ModalWithMarkdownEditor } from '../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import FrequentlyJoinedTables from '../../components/my-data-details/FrequentlyJoinedTables';
import IssuesTab from '../../components/my-data-details/IssuesTab';
import ManageTab from '../../components/my-data-details/ManageTab';
import QualityTab from '../../components/my-data-details/QualityTab';
import SchemaTab from '../../components/my-data-details/SchemaTab';
import Tags from '../../components/tags/tags';
import {
  getDatabaseDetailsPath,
  getServiceDetailsPath,
  LIST_SIZE,
} from '../../constants/constants';
import useToastContext from '../../hooks/useToastContext';
import {
  getCurrentUserId,
  getPartialNameFromFQN,
  getTableFQNFromColumnFQN,
} from '../../utils/CommonUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import SVGIcons from '../../utils/SvgUtils';
import {
  getOwnerFromId,
  getTagsWithoutTier,
  getTierFromTableTags,
  getUsagePercentile,
} from '../../utils/TableUtils';
import { getTableTags } from '../../utils/TagsUtils';
import { issues } from './index.mock';

const getTabClasses = (tab: number, activeTab: number) => {
  return 'tw-gh-tabs' + (activeTab === tab ? ' active' : '');
};

const MyDataDetailsPage = () => {
  // User Id for getting followers

  const USERId = getCurrentUserId();

  const [tableId, setTableId] = useState('');
  const [tier, setTier] = useState<string>();
  const [name, setName] = useState('');
  const [followers, setFollowers] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [slashedTableName, setSlashedTableName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [description, setDescription] = useState('');
  const [usage, setUsage] = useState('');
  const [weeklyUsageCount, setWeeklyUsageCount] = useState('');
  const [columns, setColumns] = useState<Array<TableColumn>>([]);
  const [tableTags, setTableTags] = useState<Array<ColumnTags>>([]);
  const [isEdit, setIsEdit] = useState(false);
  const [owner, setOwner] = useState<TableDetail['owner']>();
  const [tableJoinData, setTableJoinData] = useState<TableJoinsData>({
    startDate: '',
    dayCount: 0,
    columnJoins: [],
  });
  const [tableDetails, setTableDetails] = useState<TableDetail>(
    {} as TableDetail
  );
  const [activeTab, setActiveTab] = useState<number>(1);
  const { datasetFQN: tableFQN } = useParams() as Record<string, string>;

  const showToast = useToastContext();

  useEffect(() => {
    getTableDetailsByFQN(
      tableFQN,
      'columns, database, usageSummary, followers, joins, tags, owner'
    ).then((res: AxiosResponse) => {
      const {
        description,
        id,
        name,
        // tier,
        columns,
        database,
        owner,
        usageSummary,
        followers,
        joins,
        tags,
      } = res.data;
      setTableDetails(res.data);
      setTableId(id);
      setTier(getTierFromTableTags(tags));
      setOwner(getOwnerFromId(owner?.id));
      // need to check if already following or not with logedIn user id
      setIsFollowing(
        !!followers.filter(({ id }: { id: string }) => id === USERId).length
      );
      setFollowers(followers?.length);
      getDatabase(database.id, 'service').then((resDB: AxiosResponse) => {
        getServiceById('databaseServices', resDB.data.service?.id).then(
          (resService: AxiosResponse) => {
            setSlashedTableName([
              {
                name: resService.data.name,
                url: resService.data.name
                  ? getServiceDetailsPath(resService.data.name)
                  : '',
                imgSrc: resService.data.serviceType
                  ? serviceTypeLogo(resService.data.serviceType)
                  : undefined,
              },
              {
                name: database.name,
                url: getDatabaseDetailsPath(resDB.data.fullyQualifiedName),
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
      setName(name);

      setDescription(description);
      setColumns(columns || []);
      setTableTags(getTableTags(columns || []));
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
      if (joins) {
        setTableJoinData(joins);
      }
    });
  }, [tableFQN]);

  const hasEditAccess = () => {
    if (owner?.type === 'user') {
      return owner.id === getCurrentUserId();
    } else {
      return AppState.userTeams.some((team) => team.id === owner?.id);
    }
  };

  const onCancel = () => {
    setIsEdit(false);
  };

  const saveUpdatedTableData = (
    updatedData: TableDetail
  ): Promise<AxiosResponse> => {
    const jsonPatch = compare(tableDetails, updatedData);

    return patchTableDetails(
      tableId,
      jsonPatch
    ) as unknown as Promise<AxiosResponse>;
  };

  const onDescriptionUpdate = (updatedHTML: string) => {
    if (description !== updatedHTML) {
      const updatedTableDetails = {
        ...tableDetails,
        description: updatedHTML,
      };
      saveUpdatedTableData(updatedTableDetails).then(() => {
        setTableDetails(updatedTableDetails);
        setDescription(updatedHTML);
        setIsEdit(false);
      });
    } else {
      setIsEdit(false);
    }
  };

  const onColumnsUpdate = (updateColumns: Array<TableColumn>) => {
    if (!isEqual(columns, updateColumns)) {
      const updatedTableDetails = {
        ...tableDetails,
        columns: updateColumns,
      };
      saveUpdatedTableData(updatedTableDetails).then(() => {
        setTableDetails(updatedTableDetails);
        setColumns(updateColumns);
      });
    }
  };

  const onSettingsUpdate = (
    newOwner?: TableDetail['owner'],
    newTier?: TableDetail['tier']
  ): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      if (newOwner || newTier) {
        const tierTag: TableDetail['tags'] = newTier
          ? [
              ...getTagsWithoutTier(tableDetails.tags),
              { tagFQN: newTier, labelType: 'Manual', state: 'Confirmed' },
            ]
          : tableDetails.tags;
        const updatedTableDetails = {
          ...tableDetails,
          owner: newOwner
            ? {
                ...tableDetails.owner,
                ...newOwner,
              }
            : tableDetails.owner,
          // tier: newTier || tableDetails.tier,
          tags: tierTag,
        };
        saveUpdatedTableData(updatedTableDetails)
          .then((res) => {
            setTableDetails(res.data);
            setOwner(res.data.owner);
            setTier(getTierFromTableTags(res.data.tags));
            resolve();
          })
          .catch(() => reject());
      } else {
        reject();
      }
    });
  };

  const onSuggest = (updatedHTML: string) => {
    if (description !== updatedHTML) {
      const data = {
        message: updatedHTML,
        from: USERId,
        addressedToEntity: {
          id: tableId,
          name: name,
          // entity: 'Table',
          type: 'Table',
        },
      };
      postFeed(data).then(() => {
        setIsEdit(false);
        showToast({
          variant: 'success',
          body: 'Suggestion posted Successfully!',
        });
      });
    }
  };

  const followTable = (): void => {
    if (isFollowing) {
      removeFollower(tableId, USERId).then(() => {
        setFollowers((preValu) => preValu - 1);
        setIsFollowing(false);
      });
    } else {
      addFollower(tableId, USERId).then(() => {
        setFollowers((preValu) => preValu + 1);
        setIsFollowing(true);
      });
    }
  };

  const onDescriptionEdit = (): void => {
    setIsEdit(true);
  };

  const getFrequentlyJoinedWithTables = (): Array<{
    name: string;
    fqn: string;
    joinCount: number;
  }> => {
    let freqJoin: Array<{ name: string; fqn: string; joinCount: number }> = [];
    for (const joinData of tableJoinData.columnJoins) {
      freqJoin = [
        ...freqJoin,
        ...joinData.joinedWith.map((joinedCol) => {
          const tableFQN = getTableFQNFromColumnFQN(
            joinedCol.fullyQualifiedName
          );

          return {
            name: getPartialNameFromFQN(tableFQN, ['database', 'table']),
            fqn: tableFQN,
            joinCount: joinedCol.joinCount,
          };
        }),
      ].sort((a, b) =>
        a.joinCount > b.joinCount ? 1 : b.joinCount > a.joinCount ? -1 : 0
      );
    }

    return freqJoin;
  };

  return (
    <PageContainer>
      <div className="tw-px-4 w-full">
        <div className="tw-flex tw-flex-col">
          <div className="tw-flex tw-flex-initial tw-justify-between tw-items-center">
            <TitleBreadcrumb titleLinks={slashedTableName} />
            <div className="tw-flex tw-h-6 tw-ml-2 tw-mt-2">
              <span
                className={classNames(
                  'tw-flex tw-border tw-border-primary tw-rounded',
                  isFollowing
                    ? 'tw-bg-primary tw-text-white'
                    : 'tw-text-primary'
                )}>
                <button
                  className={classNames(
                    'tw-text-xs tw-border-r tw-font-normal tw-py-1 tw-px-2 tw-rounded-l focus:tw-outline-none',
                    isFollowing ? 'tw-border-white' : 'tw-border-primary'
                  )}
                  data-testid="follow-button"
                  onClick={followTable}>
                  {isFollowing ? (
                    <>
                      <i className="fas fa-star" /> Unfollow
                    </>
                  ) : (
                    <>
                      <i className="far fa-star" /> Follow
                    </>
                  )}
                </button>
                <span className="tw-text-xs tw-border-l-0 tw-font-normal tw-py-1 tw-px-2 tw-rounded-r">
                  {followers}
                </span>
              </span>
            </div>
          </div>
        </div>
        <div className="tw-flex tw-gap-1 tw-mb-2 tw-mt-1">
          <span>
            <span className="tw-text-grey-muted tw-font-normal">Owner :</span>{' '}
            <span className="tw-pl-1tw-font-normal ">
              {owner?.name || '--'}
            </span>
            <span className="tw-mx-3 tw-inline-block tw-text-gray-400">•</span>
          </span>
          <span>
            <span className="tw-text-grey-muted tw-font-normal">Usage :</span>{' '}
            <span className="tw-pl-1 tw-font-normal"> {usage}</span>
            <span className="tw-mx-3 tw-inline-block tw-text-gray-400">•</span>
          </span>
          <span>
            <span className="tw-text-grey-muted tw-font-normal">Queries :</span>{' '}
            <span className="tw-pl-1 tw-font-normal">
              {weeklyUsageCount} past week
            </span>
          </span>
        </div>
        <div className="tw-flex tw-flex-wrap tw-pt-1">
          {(tableTags.length > 0 || tier) && (
            <i className="fas fa-tags tw-px-1 tw-mt-2 tw-text-grey-muted" />
          )}
          {tier && (
            <Tags className="tw-bg-gray-200" tag={`#${tier.split('.')[1]}`} />
          )}
          {tableTags.length > 0 && (
            <>
              {tableTags.slice(0, LIST_SIZE).map((tag, index) => (
                <Tags
                  className="tw-bg-gray-200"
                  key={index}
                  tag={`#${tag.tagFQN}`}
                />
              ))}

              {tableTags.slice(LIST_SIZE).length > 0 && (
                <PopOver
                  className="tw-py-1"
                  html={
                    <>
                      {tableTags.slice(LIST_SIZE).map((tag, index) => (
                        <Tags
                          className="tw-bg-gray-200 tw-px-2"
                          key={index}
                          tag={`#${tag.tagFQN}`}
                        />
                      ))}
                    </>
                  }
                  position="bottom"
                  theme="light"
                  trigger="click">
                  <span className="tw-cursor-pointer tw-text-xs link-text">
                    View more
                  </span>
                </PopOver>
              )}
            </>
          )}
        </div>

        <div className="tw-block tw-mt-1">
          <div className="tw-bg-transparent tw--mx-4">
            <nav className="tw-flex tw-flex-row tw-gh-tabs-container tw-px-4">
              <button
                className={getTabClasses(1, activeTab)}
                data-testid="tab"
                onClick={() => setActiveTab(1)}>
                <SVGIcons alt="schema" icon="icon-schema" title="schema" />{' '}
                {'Schema '}
              </button>
              <NonAdminAction
                isOwner={!owner || hasEditAccess()}
                title="You need ownership to perform this action">
                <button
                  className={getTabClasses(6, activeTab)}
                  data-testid="tab"
                  onClick={() => setActiveTab(6)}>
                  <SVGIcons alt="manage" icon="icon-manage" title="manage" />{' '}
                  {'Manage '}
                </button>
              </NonAdminAction>
            </nav>
          </div>
          <div className="tw-bg-white tw--mx-4 tw-p-4">
            {activeTab === 1 && (
              <div className="tw-grid tw-grid-cols-4 tw-gap-4 w-full">
                <div className="tw-col-span-3">
                  <div className="schema-description tw-flex tw-flex-col tw-h-full tw-min-h-168 tw-relative tw-border tw-border-main tw-rounded-md">
                    <div className="tw-flex tw-items-center tw-px-3 tw-py-1 tw-border-b tw-border-main">
                      <span className="tw-flex-1 tw-leading-8 tw-m-0 tw-text-sm tw-font-normal">
                        Description
                      </span>
                      <div className="tw-flex-initial">
                        <NonAdminAction
                          html={
                            <>
                              <p>You need ownership to perform this action</p>
                              {!owner ? (
                                <p>Claim ownership in Manage </p>
                              ) : null}
                            </>
                          }
                          isOwner={hasEditAccess()}>
                          <button
                            className="focus:tw-outline-none"
                            onClick={onDescriptionEdit}>
                            <SVGIcons
                              alt="edit"
                              icon="icon-edit"
                              title="edit"
                            />
                          </button>
                        </NonAdminAction>
                      </div>
                    </div>
                    <div className="tw-px-3 tw-py-2 tw-overflow-y-auto">
                      <div
                        className="tw-pl-3"
                        data-testid="description"
                        id="description">
                        {description ? (
                          <RichTextEditorPreviewer markdown={description} />
                        ) : (
                          <span className="tw-no-description">
                            No description added
                          </span>
                        )}
                      </div>
                      {isEdit && (
                        <ModalWithMarkdownEditor
                          header={`Edit description for ${name}`}
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
                <div className="tw-col-span-1 tw-border tw-border-main tw-rounded-md">
                  <FrequentlyJoinedTables
                    header="Frequently Joined Tables"
                    tableList={getFrequentlyJoinedWithTables()}
                  />
                </div>
                <div className="tw-col-span-full">
                  <SchemaTab
                    columns={columns}
                    joins={tableJoinData.columnJoins}
                    onUpdate={onColumnsUpdate}
                  />
                </div>
              </div>
            )}
            {activeTab === 2 && <QualityTab />}
            {activeTab === 3 && <IssuesTab issues={issues} />}
            {activeTab === 4 && <></>}
            {activeTab === 5 && <></>}
            {activeTab === 6 && (
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
    </PageContainer>
  );
};

export default observer(MyDataDetailsPage);
