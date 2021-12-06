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
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { getDatabase } from '../../axiosAPIs/databaseAPI';
import { getServiceById } from '../../axiosAPIs/serviceAPI';
import {
  getTableDetailsByFQN,
  getTableVersion,
  getTableVersions,
} from '../../axiosAPIs/tableAPI';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import DatasetVersion from '../../components/DatasetVersion/DatasetVersion.component';
import Loader from '../../components/Loader/Loader';
import {
  getDatabaseDetailsPath,
  getDatasetDetailsPath,
  getDatasetVersionPath,
  getServiceDetailsPath,
} from '../../constants/constants';
import { ServiceCategory } from '../../enums/service.enum';
import { Table } from '../../generated/entity/data/table';
import { EntityHistory } from '../../generated/type/entityHistory';
import { TagLabel } from '../../generated/type/tagLabel';
import useToastContext from '../../hooks/useToastContext';
import { getPartialNameFromFQN } from '../../utils/CommonUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { getOwnerFromId, getTierTags } from '../../utils/TableUtils';
const EntityVersionPage: FunctionComponent = () => {
  const history = useHistory();
  const showToast = useToastContext();
  const [tier, setTier] = useState<TagLabel>();
  const [owner, setOwner] = useState<
    Table['owner'] & { displayName?: string }
  >();
  const [currentVersionData, setCurrentVersionData] = useState<Table>(
    {} as Table
  );

  const { version, datasetFQN } = useParams() as Record<string, string>;
  const [isLoading, setIsloading] = useState<boolean>(false);
  const [versionList, setVersionList] = useState<EntityHistory>(
    {} as EntityHistory
  );
  const [isVersionLoading, setIsVersionLoading] = useState<boolean>(false);
  const [slashedTableName, setSlashedTableName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  const backHandler = () => {
    history.push(getDatasetDetailsPath(datasetFQN));
  };

  const versionHandler = (v = version) => {
    history.push(getDatasetVersionPath(datasetFQN, v as string));
  };

  const fetchEntityVersions = () => {
    setIsloading(true);
    getTableDetailsByFQN(
      getPartialNameFromFQN(datasetFQN, ['service', 'database', 'table'], '.'),
      ['owner', 'tags']
    )
      .then((res: AxiosResponse) => {
        const { id, owner, tags, name, database } = res.data;
        setTier(getTierTags(tags));
        setOwner(getOwnerFromId(owner?.id));
        setCurrentVersionData(res.data);
        getDatabase(database.id).then((resDB: AxiosResponse) => {
          getServiceById('databaseServices', resDB.data.service?.id).then(
            (resService: AxiosResponse) => {
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
                  name: resDB.data.name,
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
        getTableVersions(id)
          .then((vres: AxiosResponse) => {
            setVersionList(vres.data);
            setIsloading(false);
          })
          .catch((err: AxiosError) => {
            const msg = err.message;
            showToast({
              variant: 'error',
              body: msg ?? `Error while fetching ${datasetFQN} versions`,
            });
          });
      })
      .catch((err: AxiosError) => {
        const msg = err.message;
        showToast({
          variant: 'error',
          body: msg ?? `Error while fetching ${datasetFQN} versions`,
        });
      });
  };

  const fetchCurrentVersion = () => {
    setIsVersionLoading(true);
    getTableDetailsByFQN(
      getPartialNameFromFQN(datasetFQN, ['service', 'database', 'table'], '.')
    )
      .then((res: AxiosResponse) => {
        const { id, database, name } = res.data;
        getDatabase(database.id).then((resDB: AxiosResponse) => {
          getServiceById('databaseServices', resDB.data.service?.id).then(
            (resService: AxiosResponse) => {
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
                  name: resDB.data.name,
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

        getTableVersion(id, version)
          .then((vRes: AxiosResponse) => {
            const { owner, tags } = vRes.data;
            setTier(getTierTags(tags));
            setOwner(getOwnerFromId(owner?.id));
            setCurrentVersionData(vRes.data);
            setIsVersionLoading(false);
          })
          .catch((err: AxiosError) => {
            const msg = err.message;
            showToast({
              variant: 'error',
              body:
                msg ?? `Error while fetching ${datasetFQN} version ${version}`,
            });
          });
      })
      .catch((err: AxiosError) => {
        const msg = err.message;
        showToast({
          variant: 'error',
          body: msg ?? `Error while fetching ${datasetFQN}  version ${version}`,
        });
      });
  };

  useEffect(() => {
    fetchEntityVersions();
  }, [datasetFQN]);

  useEffect(() => {
    fetchCurrentVersion();
  }, [version]);

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : (
        <DatasetVersion
          backHandler={backHandler}
          currentVersionData={currentVersionData}
          datasetFQN={datasetFQN}
          isVersionLoading={isVersionLoading}
          owner={owner}
          slashedTableName={slashedTableName}
          tier={tier as TagLabel}
          version={version}
          versionHandler={versionHandler}
          versionList={versionList}
        />
      )}
    </>
  );
};

export default EntityVersionPage;
