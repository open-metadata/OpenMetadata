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
import { Table } from '../../generated/entity/data/table';
import { EntityHistory } from '../../generated/type/entityHistory';
import useToastContext from '../../hooks/useToastContext';
import { getPartialNameFromFQN } from '../../utils/CommonUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { getOwnerFromId, getTierFromTableTags } from '../../utils/TableUtils';
const EntityVersionPage: FunctionComponent = () => {
  const history = useHistory();
  const showToast = useToastContext();
  const [tier, setTier] = useState<string>();
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
      getPartialNameFromFQN(datasetFQN, ['service', 'database', 'table'], '.')
    )
      .then((res: AxiosResponse) => {
        const { id } = res.data;
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
      getPartialNameFromFQN(datasetFQN, ['service', 'database', 'table'], '.'),
      'database'
    )
      .then((res: AxiosResponse) => {
        const { id, database, name } = res.data;
        getDatabase(database.id, 'service').then((resDB: AxiosResponse) => {
          getServiceById('databaseServices', resDB.data.service?.id).then(
            (resService: AxiosResponse) => {
              setSlashedTableName([
                {
                  name: resService.data.name,
                  url: resService.data.name
                    ? getServiceDetailsPath(
                        resService.data.name,
                        resService.data.serviceType
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
            setTier(getTierFromTableTags(tags));
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
          tier={tier as string}
          version={version}
          versionHandler={versionHandler}
          versionList={versionList}
        />
      )}
    </>
  );
};

export default EntityVersionPage;
