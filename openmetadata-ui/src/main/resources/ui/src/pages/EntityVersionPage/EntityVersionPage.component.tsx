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
import {
  getDashboardByFqn,
  getDashboardVersion,
  getDashboardVersions,
} from '../../axiosAPIs/dashboardAPI';
import {
  getPipelineByFqn,
  getPipelineVersion,
  getPipelineVersions,
} from '../../axiosAPIs/pipelineAPI';
import {
  getTableDetailsByFQN,
  getTableVersion,
  getTableVersions,
} from '../../axiosAPIs/tableAPI';
import {
  getTopicByFqn,
  getTopicVersion,
  getTopicVersions,
} from '../../axiosAPIs/topicsAPI';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import DashboardVersion from '../../components/DashboardVersion/DashboardVersion.component';
import DatasetVersion from '../../components/DatasetVersion/DatasetVersion.component';
import Loader from '../../components/Loader/Loader';
import PipelineVersion from '../../components/PipelineVersion/PipelineVersion.component';
import TopicVersion from '../../components/TopicVersion/TopicVersion.component';
import {
  getDashboardDetailsPath,
  getDatabaseDetailsPath,
  getPipelineDetailsPath,
  getServiceDetailsPath,
  getTableDetailsPath,
  getTopicDetailsPath,
  getVersionPath,
} from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { Pipeline } from '../../generated/entity/data/pipeline';
import { Table } from '../../generated/entity/data/table';
import { Topic } from '../../generated/entity/data/topic';
import { EntityHistory } from '../../generated/type/entityHistory';
import { TagLabel } from '../../generated/type/tagLabel';
import useToastContext from '../../hooks/useToastContext';
import { getPartialNameFromFQN } from '../../utils/CommonUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { getOwnerFromId, getTierTags } from '../../utils/TableUtils';

export type VersionData = Partial<Table> &
  Partial<Topic> &
  Partial<Dashboard> &
  Partial<Pipeline>;

const EntityVersionPage: FunctionComponent = () => {
  const history = useHistory();
  const showToast = useToastContext();
  const [tier, setTier] = useState<TagLabel>();
  const [owner, setOwner] = useState<
    Table['owner'] & { displayName?: string }
  >();
  const [currentVersionData, setCurrentVersionData] = useState<VersionData>(
    {} as VersionData
  );

  const { entityType, version, entityFQN } = useParams() as Record<
    string,
    string
  >;
  const [isLoading, setIsloading] = useState<boolean>(false);
  const [versionList, setVersionList] = useState<EntityHistory>(
    {} as EntityHistory
  );
  const [isVersionLoading, setIsVersionLoading] = useState<boolean>(false);
  const [slashedEntityName, setSlashedEntityName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  const backHandler = () => {
    switch (entityType) {
      case EntityType.TABLE:
        history.push(getTableDetailsPath(entityFQN));

        break;

      case EntityType.TOPIC:
        history.push(getTopicDetailsPath(entityFQN));

        break;

      case EntityType.DASHBOARD:
        history.push(getDashboardDetailsPath(entityFQN));

        break;

      case EntityType.PIPELINE:
        history.push(getPipelineDetailsPath(entityFQN));

        break;

      default:
        break;
    }
  };

  const versionHandler = (v = version) => {
    history.push(getVersionPath(entityType, entityFQN, v as string));
  };

  const setEntityState = (
    tags: TagLabel[],
    owner: Table['owner'],
    data: VersionData,
    titleBreadCrumb: TitleBreadcrumbProps['titleLinks']
  ) => {
    setTier(getTierTags(tags));
    setOwner(getOwnerFromId(owner?.id));
    setCurrentVersionData(data);
    setSlashedEntityName(titleBreadCrumb);
  };

  const fetchEntityVersions = () => {
    setIsloading(true);
    switch (entityType) {
      case EntityType.TABLE: {
        getTableDetailsByFQN(
          getPartialNameFromFQN(
            entityFQN,
            ['service', 'database', 'table'],
            '.'
          ),
          ['owner', 'tags']
        )
          .then((res: AxiosResponse) => {
            const { id, owner, tags, name, database, service, serviceType } =
              res.data;
            setEntityState(tags, owner, res.data, [
              {
                name: service.name,
                url: service.name
                  ? getServiceDetailsPath(
                      service.name,
                      serviceType,
                      ServiceCategory.DATABASE_SERVICES
                    )
                  : '',
                imgSrc: serviceType ? serviceTypeLogo(serviceType) : undefined,
              },
              {
                name: database.name,
                url: getDatabaseDetailsPath(database.fullyQualifiedName),
              },
              {
                name: name,
                url: '',
                activeTitle: true,
              },
            ]);

            getTableVersions(id)
              .then((vres: AxiosResponse) => {
                setVersionList(vres.data);
                setIsloading(false);
              })
              .catch((err: AxiosError) => {
                const msg = err.message;
                showToast({
                  variant: 'error',
                  body: msg ?? `Error while fetching ${entityFQN} versions`,
                });
              });
          })
          .catch((err: AxiosError) => {
            const msg = err.message;
            showToast({
              variant: 'error',
              body: msg ?? `Error while fetching ${entityFQN} versions`,
            });
          });

        break;
      }
      case EntityType.TOPIC: {
        getTopicByFqn(
          getPartialNameFromFQN(entityFQN, ['service', 'database'], '.'),
          ['owner', 'tags']
        )
          .then((res: AxiosResponse) => {
            const { id, owner, tags, name, service, serviceType } = res.data;
            setEntityState(tags, owner, res.data, [
              {
                name: service.name,
                url: service.name
                  ? getServiceDetailsPath(
                      service.name,
                      serviceType,
                      ServiceCategory.MESSAGING_SERVICES
                    )
                  : '',
                imgSrc: serviceType ? serviceTypeLogo(serviceType) : undefined,
              },
              {
                name: name,
                url: '',
                activeTitle: true,
              },
            ]);

            getTopicVersions(id)
              .then((vres: AxiosResponse) => {
                setVersionList(vres.data);
                setIsloading(false);
              })
              .catch((err: AxiosError) => {
                const msg = err.message;
                showToast({
                  variant: 'error',
                  body: msg ?? `Error while fetching ${entityFQN} versions`,
                });
              });
          })
          .catch((err: AxiosError) => {
            const msg = err.message;
            showToast({
              variant: 'error',
              body: msg ?? `Error while fetching ${entityFQN} versions`,
            });
          });

        break;
      }
      case EntityType.DASHBOARD: {
        getDashboardByFqn(
          getPartialNameFromFQN(entityFQN, ['service', 'database'], '.'),
          ['owner', 'tags', 'charts']
        )
          .then((res: AxiosResponse) => {
            const { id, owner, tags, name, service, serviceType } = res.data;
            setEntityState(tags, owner, res.data, [
              {
                name: service.name,
                url: service.name
                  ? getServiceDetailsPath(
                      service.name,
                      serviceType,
                      ServiceCategory.MESSAGING_SERVICES
                    )
                  : '',
                imgSrc: serviceType ? serviceTypeLogo(serviceType) : undefined,
              },
              {
                name: name,
                url: '',
                activeTitle: true,
              },
            ]);

            getDashboardVersions(id)
              .then((vres: AxiosResponse) => {
                setVersionList(vres.data);
                setIsloading(false);
              })
              .catch((err: AxiosError) => {
                const msg = err.message;
                showToast({
                  variant: 'error',
                  body: msg ?? `Error while fetching ${entityFQN} versions`,
                });
              });
          })
          .catch((err: AxiosError) => {
            const msg = err.message;
            showToast({
              variant: 'error',
              body: msg ?? `Error while fetching ${entityFQN} versions`,
            });
          });

        break;
      }
      case EntityType.PIPELINE: {
        getPipelineByFqn(
          getPartialNameFromFQN(entityFQN, ['service', 'database'], '.'),
          ['owner', 'tags', 'tasks']
        )
          .then((res: AxiosResponse) => {
            const { id, owner, tags, name, service, serviceType } = res.data;
            setEntityState(tags, owner, res.data, [
              {
                name: service.name,
                url: service.name
                  ? getServiceDetailsPath(
                      service.name,
                      serviceType,
                      ServiceCategory.MESSAGING_SERVICES
                    )
                  : '',
                imgSrc: serviceType ? serviceTypeLogo(serviceType) : undefined,
              },
              {
                name: name,
                url: '',
                activeTitle: true,
              },
            ]);

            getPipelineVersions(id)
              .then((vres: AxiosResponse) => {
                setVersionList(vres.data);
                setIsloading(false);
              })
              .catch((err: AxiosError) => {
                const msg = err.message;
                showToast({
                  variant: 'error',
                  body: msg ?? `Error while fetching ${entityFQN} versions`,
                });
              });
          })
          .catch((err: AxiosError) => {
            const msg = err.message;
            showToast({
              variant: 'error',
              body: msg ?? `Error while fetching ${entityFQN} versions`,
            });
          });

        break;
      }

      default:
        break;
    }
  };

  const fetchCurrentVersion = () => {
    setIsVersionLoading(true);
    switch (entityType) {
      case EntityType.TABLE: {
        getTableDetailsByFQN(
          getPartialNameFromFQN(
            entityFQN,
            ['service', 'database', 'table'],
            '.'
          )
        )
          .then((res: AxiosResponse) => {
            const { id, database, name, service, serviceType } = res.data;
            getTableVersion(id, version)
              .then((vRes: AxiosResponse) => {
                const { owner, tags } = vRes.data;
                setEntityState(tags, owner, vRes.data, [
                  {
                    name: service.name,
                    url: service.name
                      ? getServiceDetailsPath(
                          service.name,
                          serviceType,
                          ServiceCategory.DATABASE_SERVICES
                        )
                      : '',
                    imgSrc: serviceType
                      ? serviceTypeLogo(serviceType)
                      : undefined,
                  },
                  {
                    name: database.name,
                    url: getDatabaseDetailsPath(database.fullyQualifiedName),
                  },
                  {
                    name: name,
                    url: '',
                    activeTitle: true,
                  },
                ]);
                setIsVersionLoading(false);
              })
              .catch((err: AxiosError) => {
                const msg = err.message;
                showToast({
                  variant: 'error',
                  body:
                    msg ??
                    `Error while fetching ${entityFQN} version ${version}`,
                });
              });
          })
          .catch((err: AxiosError) => {
            const msg = err.message;
            showToast({
              variant: 'error',
              body:
                msg ?? `Error while fetching ${entityFQN}  version ${version}`,
            });
          });

        break;
      }

      case EntityType.TOPIC: {
        getTopicByFqn(
          getPartialNameFromFQN(entityFQN, ['service', 'database'], '.')
        )
          .then((res: AxiosResponse) => {
            const { id, name, service, serviceType } = res.data;
            getTopicVersion(id, version)
              .then((vRes: AxiosResponse) => {
                const { owner, tags } = vRes.data;
                setEntityState(tags, owner, vRes.data, [
                  {
                    name: service.name,
                    url: service.name
                      ? getServiceDetailsPath(
                          service.name,
                          serviceType,
                          ServiceCategory.MESSAGING_SERVICES
                        )
                      : '',
                    imgSrc: serviceType
                      ? serviceTypeLogo(serviceType)
                      : undefined,
                  },
                  {
                    name: name,
                    url: '',
                    activeTitle: true,
                  },
                ]);
                setIsVersionLoading(false);
              })
              .catch((err: AxiosError) => {
                const msg = err.message;
                showToast({
                  variant: 'error',
                  body:
                    msg ??
                    `Error while fetching ${entityFQN} version ${version}`,
                });
              });
          })
          .catch((err: AxiosError) => {
            const msg = err.message;
            showToast({
              variant: 'error',
              body:
                msg ?? `Error while fetching ${entityFQN}  version ${version}`,
            });
          });

        break;
      }
      case EntityType.DASHBOARD: {
        getDashboardByFqn(
          getPartialNameFromFQN(entityFQN, ['service', 'database'], '.')
        )
          .then((res: AxiosResponse) => {
            const { id, name, service, serviceType } = res.data;
            getDashboardVersion(id, version)
              .then((vRes: AxiosResponse) => {
                const { owner, tags } = vRes.data;
                setEntityState(tags, owner, vRes.data, [
                  {
                    name: service.name,
                    url: service.name
                      ? getServiceDetailsPath(
                          service.name,
                          serviceType,
                          ServiceCategory.MESSAGING_SERVICES
                        )
                      : '',
                    imgSrc: serviceType
                      ? serviceTypeLogo(serviceType)
                      : undefined,
                  },
                  {
                    name: name,
                    url: '',
                    activeTitle: true,
                  },
                ]);
                setIsVersionLoading(false);
              })
              .catch((err: AxiosError) => {
                const msg = err.message;
                showToast({
                  variant: 'error',
                  body:
                    msg ??
                    `Error while fetching ${entityFQN} version ${version}`,
                });
              });
          })
          .catch((err: AxiosError) => {
            const msg = err.message;
            showToast({
              variant: 'error',
              body:
                msg ?? `Error while fetching ${entityFQN}  version ${version}`,
            });
          });

        break;
      }
      case EntityType.PIPELINE: {
        getPipelineByFqn(
          getPartialNameFromFQN(entityFQN, ['service', 'database'], '.')
        )
          .then((res: AxiosResponse) => {
            const { id, name, service, serviceType } = res.data;
            getPipelineVersion(id, version)
              .then((vRes: AxiosResponse) => {
                const { owner, tags } = vRes.data;
                setEntityState(tags, owner, vRes.data, [
                  {
                    name: service.name,
                    url: service.name
                      ? getServiceDetailsPath(
                          service.name,
                          serviceType,
                          ServiceCategory.MESSAGING_SERVICES
                        )
                      : '',
                    imgSrc: serviceType
                      ? serviceTypeLogo(serviceType)
                      : undefined,
                  },
                  {
                    name: name,
                    url: '',
                    activeTitle: true,
                  },
                ]);
                setIsVersionLoading(false);
              })
              .catch((err: AxiosError) => {
                const msg = err.message;
                showToast({
                  variant: 'error',
                  body:
                    msg ??
                    `Error while fetching ${entityFQN} version ${version}`,
                });
              });
          })
          .catch((err: AxiosError) => {
            const msg = err.message;
            showToast({
              variant: 'error',
              body:
                msg ?? `Error while fetching ${entityFQN}  version ${version}`,
            });
          });

        break;
      }

      default:
        break;
    }
  };

  const versionComponent = () => {
    switch (entityType) {
      case EntityType.TABLE: {
        return (
          <DatasetVersion
            backHandler={backHandler}
            currentVersionData={currentVersionData}
            datasetFQN={entityFQN}
            isVersionLoading={isVersionLoading}
            owner={owner}
            slashedTableName={slashedEntityName}
            tier={tier as TagLabel}
            version={version}
            versionHandler={versionHandler}
            versionList={versionList}
          />
        );
      }
      case EntityType.TOPIC: {
        return (
          <TopicVersion
            backHandler={backHandler}
            currentVersionData={currentVersionData}
            isVersionLoading={isVersionLoading}
            owner={owner}
            slashedTopicName={slashedEntityName}
            tier={tier as TagLabel}
            topicFQN={entityFQN}
            version={version}
            versionHandler={versionHandler}
            versionList={versionList}
          />
        );
      }

      case EntityType.DASHBOARD: {
        return (
          <DashboardVersion
            backHandler={backHandler}
            currentVersionData={currentVersionData}
            isVersionLoading={isVersionLoading}
            owner={owner}
            slashedDashboardName={slashedEntityName}
            tier={tier as TagLabel}
            topicFQN={entityFQN}
            version={version}
            versionHandler={versionHandler}
            versionList={versionList}
          />
        );
      }

      case EntityType.PIPELINE: {
        return (
          <PipelineVersion
            backHandler={backHandler}
            currentVersionData={currentVersionData}
            isVersionLoading={isVersionLoading}
            owner={owner}
            slashedPipelineName={slashedEntityName}
            tier={tier as TagLabel}
            topicFQN={entityFQN}
            version={version}
            versionHandler={versionHandler}
            versionList={versionList}
          />
        );
      }

      default:
        return null;
    }
  };

  useEffect(() => {
    fetchEntityVersions();
  }, [entityFQN]);

  useEffect(() => {
    fetchCurrentVersion();
  }, [version]);

  return <>{isLoading ? <Loader /> : versionComponent()}</>;
};

export default EntityVersionPage;
