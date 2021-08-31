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
import { compare } from 'fast-json-patch';
import { isEqual, isNil } from 'lodash';
import { observer } from 'mobx-react';
import {
  ColumnTags,
  SampleData,
  TableColumn,
  TableDetail,
  TableJoinsData,
} from 'Models';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getDatabase } from '../../axiosAPIs/databaseAPI';
import { postFeed } from '../../axiosAPIs/feedsAPI';
import { getServiceById } from '../../axiosAPIs/serviceAPI';
import {
  addFollower,
  getTableDetailsByFQN,
  patchTableDetails,
  removeFollower,
} from '../../axiosAPIs/tableAPI';
import Description from '../../components/common/description/Description';
import EntityPageInfo from '../../components/common/entityPageInfo/EntityPageInfo';
import TabsPane from '../../components/common/TabsPane/TabsPane';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainer from '../../components/containers/PageContainer';
import FrequentlyJoinedTables from '../../components/my-data-details/FrequentlyJoinedTables';
import IssuesTab from '../../components/my-data-details/IssuesTab';
import ManageTab from '../../components/my-data-details/ManageTab';
import QualityTab from '../../components/my-data-details/QualityTab';
import SchemaTab from '../../components/my-data-details/SchemaTab';
import {
  getDatabaseDetailsPath,
  getServiceDetailsPath,
} from '../../constants/constants';
import useToastContext from '../../hooks/useToastContext';
import {
  getCurrentUserId,
  getPartialNameFromFQN,
  getTableFQNFromColumnFQN,
  getUserTeams,
} from '../../utils/CommonUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import {
  getOwnerFromId,
  getTagsWithoutTier,
  getTierFromTableTags,
  getUsagePercentile,
} from '../../utils/TableUtils';
import { getTableTags } from '../../utils/TagsUtils';
import { issues } from './index.mock';

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
  const [sampleData, setSampleData] = useState<SampleData>({
    columns: [],
    rows: [],
  });
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
      position: 6,
    },
  ];

  const extraInfo = [
    { key: 'Owner', value: owner?.name || '' },
    { key: 'Usage', value: usage },
    { key: 'Queries', value: `${weeklyUsageCount} past week` },
  ];

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

  useEffect(() => {
    getTableDetailsByFQN(
      tableFQN,
      'columns, database, usageSummary, followers, joins, tags, owner,sampleData'
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
        sampleData,
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
      setSampleData(sampleData);
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

  return (
    <PageContainer>
      <div className="tw-px-4 w-full">
        <EntityPageInfo
          extraInfo={extraInfo}
          followers={followers}
          followHandler={followTable}
          isFollowing={isFollowing}
          tags={tableTags}
          tier={tier || ''}
          titleLinks={slashedTableName}
        />

        <div className="tw-block tw-mt-1">
          <TabsPane
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabs={tabs}
          />

          <div className="tw-bg-white tw--mx-4 tw-p-4">
            {activeTab === 1 && (
              <div className="tw-grid tw-grid-cols-4 tw-gap-4 w-full">
                <div className="tw-col-span-3">
                  <Description
                    description={description}
                    hasEditAccess={hasEditAccess()}
                    isEdit={isEdit}
                    owner={owner}
                    onCancel={onCancel}
                    onDescriptionEdit={onDescriptionEdit}
                    onDescriptionUpdate={onDescriptionUpdate}
                    onSuggest={onSuggest}
                  />
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
                    sampleData={sampleData}
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
