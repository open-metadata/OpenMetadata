import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { ColumnJoins } from 'Models';
import React, { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { getDatabase } from '../../axiosAPIs/databaseAPI';
import { getServiceById } from '../../axiosAPIs/serviceAPI';
import {
  getTableDetailsByFQN,
  getTableVersion,
  getTableVersions,
} from '../../axiosAPIs/tableAPI';
import Description from '../../components/common/description/Description';
import EntityPageInfo from '../../components/common/entityPageInfo/EntityPageInfo';
import TabsPane from '../../components/common/TabsPane/TabsPane';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainer from '../../components/containers/PageContainer';
import EntityVersionTimeLine from '../../components/EntityVersionTimeLine/EntityVersionTimeLine';
import Loader from '../../components/Loader/Loader';
import SchemaTab from '../../components/SchemaTab/SchemaTab.component';
import {
  getDatabaseDetailsPath,
  getDatasetDetailsPath,
  getDatasetVersionPath,
  getServiceDetailsPath,
  getTeamDetailsPath,
} from '../../constants/constants';
import { Table } from '../../generated/entity/data/table';
import { EntityHistory } from '../../generated/type/entityHistory';
import useToastContext from '../../hooks/useToastContext';
import { getPartialNameFromFQN } from '../../utils/CommonUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { getOwnerFromId, getTierFromTableTags } from '../../utils/TableUtils';
import { getTableTags } from '../../utils/TagsUtils';
const EntityVersionPage = () => {
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
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);

  const extraInfo = [
    {
      key: 'Owner',
      value:
        owner?.type === 'team'
          ? getTeamDetailsPath(owner?.name || '')
          : owner?.name || '',
      placeholderText: owner?.displayName || '',
      isLink: owner?.type === 'team',
      openInNewTab: false,
    },
    { key: 'Tier', value: tier ? tier.split('.')[1] : '' },
  ];

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
  ];

  const versionDrawerHandler = () => {
    setIsDrawerOpen((prevState) => !prevState);
  };
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
    <PageContainer>
      <div
        className={classNames(
          'tw-px-4 tw-w-full tw-h-full tw-flex tw-flex-col tw-relative'
        )}>
        {isVersionLoading ? (
          <Loader />
        ) : (
          <div className={classNames({ 'version-data': isDrawerOpen })}>
            <EntityPageInfo
              entityName={currentVersionData.name}
              extraInfo={extraInfo}
              followersList={[]}
              tags={getTableTags(currentVersionData.columns || [])}
              tier={tier || ''}
              titleLinks={slashedTableName}
              version={version}
              versionHandler={versionDrawerHandler}
            />
            <div className="tw-mt-1 tw-flex tw-flex-col tw-flex-grow ">
              <TabsPane activeTab={1} className="tw-flex-initial" tabs={tabs} />
              <div className="tw-bg-white tw-flex-grow">
                <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-w-full tw-mt-4 ">
                  <div className="tw-col-span-full">
                    <Description
                      isReadOnly
                      description={currentVersionData.description || ''}
                    />
                  </div>

                  <div className="tw-col-span-full">
                    <SchemaTab
                      isReadOnly
                      columnName={getPartialNameFromFQN(
                        datasetFQN,
                        ['column'],
                        '.'
                      )}
                      columns={currentVersionData.columns}
                      joins={currentVersionData.joins as ColumnJoins[]}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <EntityVersionTimeLine
          currentVersion={version}
          isLoading={isLoading}
          show={isDrawerOpen}
          versionHandler={versionHandler}
          versionList={versionList}
          onBack={backHandler}
        />
      </div>
    </PageContainer>
  );
};

export default EntityVersionPage;
