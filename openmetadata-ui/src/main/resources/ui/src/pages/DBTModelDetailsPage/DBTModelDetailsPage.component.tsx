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
import { compare } from 'fast-json-patch';
import { observer } from 'mobx-react';
import { EntityTags } from 'Models';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import AppState from '../../AppState';
import { getDatabase } from '../../axiosAPIs/databaseAPI';
import {
  addFollower,
  getDBTModelDetailsByFQN,
  patchDBTModelDetails,
  removeFollower,
} from '../../axiosAPIs/dbtModelAPI';
import { getServiceById } from '../../axiosAPIs/serviceAPI';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import DBTModelDetails from '../../components/DBTModelDetails/DBTModelDetails.component';
import Loader from '../../components/Loader/Loader';
import {
  getDatabaseDetailsPath,
  getDBTModelDetailsPath,
  getServiceDetailsPath,
} from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { Dbtmodel } from '../../generated/entity/data/dbtmodel';
import { User } from '../../generated/entity/teams/user';
import { TagLabel } from '../../generated/type/tagLabel';
import { addToRecentViewed, getCurrentUserId } from '../../utils/CommonUtils';
import {
  dbtModelTabs,
  getCurrentDBTModelTab,
} from '../../utils/DBTModelDetailsUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { getOwnerFromId, getTierTags } from '../../utils/TableUtils';
import { getTableTags } from '../../utils/TagsUtils';

const DBTModelDetailsPage: FunctionComponent = () => {
  const history = useHistory();
  const USERId = getCurrentUserId();
  const { dbtModelFQN: dbtModelFQN, tab } = useParams() as Record<
    string,
    string
  >;

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<number>(
    getCurrentDBTModelTab(tab)
  );
  const [dbtModelDetails, setDbtModelDetails] = useState<Dbtmodel>(
    {} as Dbtmodel
  );
  const [, setCurrentVersion] = useState<string>();

  const [dbtModelId, setDbtModelId] = useState('');
  const [tier, setTier] = useState<TagLabel>();
  const [name, setName] = useState('');
  const [followers, setFollowers] = useState<Array<User>>([]);
  const [slashedDBTModelName, setSlashedDBTModelName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [description, setDescription] = useState('');
  const [columns, setColumns] = useState<Dbtmodel['columns']>([]);
  const [dbtModelTags, setDBTModelTags] = useState<Array<EntityTags>>([]);
  const [dbtViewDefinition, setDbtViewDefinition] =
    useState<Dbtmodel['viewDefinition']>('');
  const [owner, setOwner] = useState<
    Dbtmodel['owner'] & { displayName?: string }
  >();

  const activeTabHandler = (tabValue: number) => {
    const currentTabIndex = tabValue - 1;
    if (dbtModelTabs[currentTabIndex].path !== tab) {
      setActiveTab(getCurrentDBTModelTab(dbtModelTabs[currentTabIndex].path));
      history.push({
        pathname: getDBTModelDetailsPath(
          dbtModelFQN,
          dbtModelTabs[currentTabIndex].path
        ),
      });
    }
  };

  const saveUpdatedDBTModelData = (
    updatedData: Dbtmodel
  ): Promise<AxiosResponse> => {
    const jsonPatch = compare(dbtModelDetails, updatedData);

    return patchDBTModelDetails(
      dbtModelId,
      jsonPatch
    ) as unknown as Promise<AxiosResponse>;
  };

  const descriptionUpdateHandler = (updatedDBTModel: Dbtmodel) => {
    saveUpdatedDBTModelData(updatedDBTModel).then((res: AxiosResponse) => {
      const { description, version } = res.data;
      setCurrentVersion(version);
      setDbtModelDetails(res.data);
      setDescription(description);
    });
  };

  const columnsUpdateHandler = (updatedDBTModel: Dbtmodel) => {
    saveUpdatedDBTModelData(updatedDBTModel).then((res: AxiosResponse) => {
      const { columns, version } = res.data;
      setCurrentVersion(version);
      setDbtModelDetails(res.data);
      setColumns(columns);
      setDBTModelTags(getTableTags(columns || []));
    });
  };

  const settingsUpdateHandler = (updatedDBTModel: Dbtmodel): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      saveUpdatedDBTModelData(updatedDBTModel)
        .then((res) => {
          const { version, owner, tags } = res.data;
          setCurrentVersion(version);
          setDbtModelDetails(res.data);
          setOwner(getOwnerFromId(owner?.id));
          setTier(getTierTags(tags));
          resolve();
        })
        .catch(() => reject());
    });
  };

  const followDBTModel = () => {
    addFollower(dbtModelId, USERId).then((res: AxiosResponse) => {
      const { newValue } = res.data.changeDescription.fieldsAdded[0];

      setFollowers([...followers, ...newValue]);
    });
  };
  const unfollowDBTModel = () => {
    removeFollower(dbtModelId, USERId).then((res: AxiosResponse) => {
      const { oldValue } = res.data.changeDescription.fieldsDeleted[0];

      setFollowers(
        followers.filter((follower) => follower.id !== oldValue[0].id)
      );
    });
  };

  useEffect(() => {
    if (dbtModelTabs[activeTab - 1].path !== tab) {
      setActiveTab(getCurrentDBTModelTab(tab));
    }
  }, [tab]);

  useEffect(() => {
    setIsLoading(true);
    getDBTModelDetailsByFQN(
      dbtModelFQN,
      'columns,owner,database,tags,followers,viewDefinition'
    )
      .then((res: AxiosResponse) => {
        const {
          description,
          id,
          name,
          columns,
          database,
          owner,
          followers,
          fullyQualifiedName,
          version,
          viewDefinition,
          tags,
        } = res.data;
        setDbtModelDetails(res.data);
        setDbtModelId(id);
        setCurrentVersion(version);
        setOwner(getOwnerFromId(owner?.id));
        setTier(getTierTags(tags));
        setFollowers(followers);
        getDatabase(database.id).then((resDB: AxiosResponse) => {
          getServiceById('databaseServices', resDB.data.service?.id).then(
            (resService: AxiosResponse) => {
              setSlashedDBTModelName([
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
                  name: resDB.data.name,
                  url: getDatabaseDetailsPath(resDB.data.fullyQualifiedName),
                },
                {
                  name: name,
                  url: '',
                  activeTitle: true,
                },
              ]);

              addToRecentViewed({
                entityType: EntityType.DBT_MODEL,
                fqn: fullyQualifiedName,
                serviceType: resService.data.serviceType,
                timestamp: 0,
              });
            }
          );
        });
        setName(name);

        setDescription(description);
        setColumns(columns || []);
        setDBTModelTags(getTableTags(columns || []));
        setDbtViewDefinition(viewDefinition);
      })
      .finally(() => {
        setIsLoading(false);
      });

    setActiveTab(getCurrentDBTModelTab(tab));
  }, [dbtModelFQN]);

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : (
        <DBTModelDetails
          activeTab={activeTab}
          columns={columns}
          columnsUpdateHandler={columnsUpdateHandler}
          dbtModelDetails={dbtModelDetails}
          dbtModelFQN={dbtModelFQN}
          dbtModelTags={dbtModelTags}
          description={description}
          descriptionUpdateHandler={descriptionUpdateHandler}
          entityName={name}
          followDBTModelHandler={followDBTModel}
          followers={followers}
          owner={owner as Dbtmodel['owner'] & { displayName: string }}
          setActiveTabHandler={activeTabHandler}
          settingsUpdateHandler={settingsUpdateHandler}
          slashedDBTModelName={slashedDBTModelName}
          tier={tier as TagLabel}
          unfollowDBTModelHandler={unfollowDBTModel}
          users={AppState.users}
          viewDefinition={dbtViewDefinition}
        />
      )}
    </>
  );
};

export default observer(DBTModelDetailsPage);
