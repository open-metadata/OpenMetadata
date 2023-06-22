/*
 *  Copyright 2022 Collate.
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

import { AxiosError } from 'axios';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import ContainerVersion from 'components/ContainerVersion/ContainerVersion.component';
import DashboardVersion from 'components/DashboardVersion/DashboardVersion.component';
import DataModelVersion from 'components/DataModelVersion/DataModelVersion.component';
import DatasetVersion from 'components/DatasetVersion/DatasetVersion.component';
import Loader from 'components/Loader/Loader';
import MlModelVersion from 'components/MlModelVersion/MlModelVersion.component';
import PipelineVersion from 'components/PipelineVersion/PipelineVersion.component';
import TopicVersion from 'components/TopicVersion/TopicVersion.component';
import { Container } from 'generated/entity/data/container';
import { DashboardDataModel } from 'generated/entity/data/dashboardDataModel';
import { Mlmodel } from 'generated/entity/data/mlmodel';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import {
  getDashboardByFqn,
  getDashboardVersion,
  getDashboardVersions,
} from 'rest/dashboardAPI';
import {
  getDataModelDetailsByFQN,
  getDataModelVersion,
  getDataModelVersionsList,
} from 'rest/dataModelsAPI';
import {
  getMlModelByFQN,
  getMlModelVersion,
  getMlModelVersions,
} from 'rest/mlModelAPI';
import {
  getPipelineByFqn,
  getPipelineVersion,
  getPipelineVersions,
} from 'rest/pipelineAPI';
import {
  getContainerByName,
  getContainerVersion,
  getContainerVersions,
} from 'rest/storageAPI';
import {
  getTableDetailsByFQN,
  getTableVersion,
  getTableVersions,
} from 'rest/tableAPI';
import {
  getTopicByFqn,
  getTopicVersion,
  getTopicVersions,
} from 'rest/topicsAPI';
import { getEntityBreadcrumbs, getEntityName } from 'utils/EntityUtils';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import {
  getContainerDetailPath,
  getDashboardDetailsPath,
  getDataModelDetailsPath,
  getMlModelDetailsPath,
  getPipelineDetailsPath,
  getTableDetailsPath,
  getTopicDetailsPath,
  getVersionPath,
} from '../../constants/constants';
import { EntityType, FqnPart, TabSpecificField } from '../../enums/entity.enum';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { Pipeline } from '../../generated/entity/data/pipeline';
import { Table } from '../../generated/entity/data/table';
import { Topic } from '../../generated/entity/data/topic';
import { EntityHistory } from '../../generated/type/entityHistory';
import { TagLabel } from '../../generated/type/tagLabel';
import {
  getPartialNameFromFQN,
  getPartialNameFromTableFQN,
} from '../../utils/CommonUtils';
import { defaultFields as DataModelFields } from '../../utils/DataModelsUtils';
import { defaultFields as MlModelFields } from '../../utils/MlModelDetailsUtils';

import PageLayoutV1 from 'components/containers/PageLayoutV1';
import { getTierTags } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';

export type VersionData =
  | Table
  | Topic
  | Dashboard
  | Pipeline
  | Mlmodel
  | Container
  | DashboardDataModel;

const EntityVersionPage: FunctionComponent = () => {
  const { t } = useTranslation();
  const history = useHistory();
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

      case EntityType.MLMODEL:
        history.push(getMlModelDetailsPath(entityFQN));

        break;

      case EntityType.CONTAINER:
        history.push(getContainerDetailPath(entityFQN));

        break;
      case EntityType.DASHBOARD_DATA_MODEL:
        history.push(getDataModelDetailsPath(entityFQN));

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
    setOwner(owner);
    setCurrentVersionData(data);
    setSlashedEntityName(titleBreadCrumb);
  };

  const fetchEntityVersions = async () => {
    setIsloading(true);
    switch (entityType) {
      case EntityType.TABLE: {
        getTableDetailsByFQN(
          getPartialNameFromTableFQN(
            entityFQN,
            [FqnPart.Service, FqnPart.Database, FqnPart.Schema, FqnPart.Table],
            FQN_SEPARATOR_CHAR
          ),
          ['owner', 'tags']
        )
          .then((res) => {
            const { id, owner, tags = [] } = res;

            setEntityState(
              tags,
              owner,
              res,
              getEntityBreadcrumbs(res, EntityType.TABLE)
            );

            getTableVersions(id)
              .then((vres) => {
                setVersionList(vres);
                setIsloading(false);
              })
              .catch((err: AxiosError) => {
                showErrorToast(
                  err,
                  t('server.entity-fetch-version-error', {
                    entity: entityFQN,
                    version: '',
                  })
                );
              });
          })
          .catch((err: AxiosError) => {
            showErrorToast(
              err,
              t('server.entity-fetch-version-error', {
                entity: entityFQN,
                version: '',
              })
            );
          });

        break;
      }
      case EntityType.TOPIC: {
        getTopicByFqn(
          getPartialNameFromFQN(
            entityFQN,
            ['service', 'database'],
            FQN_SEPARATOR_CHAR
          ),
          [TabSpecificField.OWNER, TabSpecificField.TAGS]
        )
          .then((res) => {
            const { id, owner, tags = [] } = res;

            setEntityState(
              tags,
              owner,
              res,
              getEntityBreadcrumbs(res, EntityType.TOPIC)
            );

            getTopicVersions(id)
              .then((vres) => {
                setVersionList(vres);
                setIsloading(false);
              })
              .catch((err: AxiosError) => {
                showErrorToast(
                  err,
                  t('server.entity-fetch-version-error', {
                    entity: entityFQN,
                    version: '',
                  })
                );
              });
          })
          .catch((err: AxiosError) => {
            showErrorToast(
              err,
              t('server.entity-fetch-version-error', {
                entity: entityFQN,
                version: '',
              })
            );
          });

        break;
      }
      case EntityType.DASHBOARD: {
        getDashboardByFqn(
          getPartialNameFromFQN(
            entityFQN,
            ['service', 'database'],
            FQN_SEPARATOR_CHAR
          ),
          ['owner', 'tags', 'charts']
        )
          .then((res) => {
            const { id, owner, tags = [] } = res;

            setEntityState(
              tags,
              owner,
              res,
              getEntityBreadcrumbs(res, EntityType.DASHBOARD)
            );

            getDashboardVersions(id)
              .then((vres) => {
                setVersionList(vres);
                setIsloading(false);
              })
              .catch((err: AxiosError) => {
                showErrorToast(
                  err,
                  t('server.entity-fetch-version-error', {
                    entity: entityFQN,
                    version: '',
                  })
                );
              });
          })
          .catch((err: AxiosError) => {
            showErrorToast(
              err,
              t('server.entity-fetch-version-error', {
                entity: entityFQN,
                version: '',
              })
            );
          });

        break;
      }
      case EntityType.PIPELINE: {
        getPipelineByFqn(
          getPartialNameFromFQN(
            entityFQN,
            ['service', 'database'],
            FQN_SEPARATOR_CHAR
          ),
          ['owner', 'tags', 'tasks']
        )
          .then((res) => {
            const { id, owner, tags = [] } = res;

            setEntityState(
              tags,
              owner,
              res,
              getEntityBreadcrumbs(res, EntityType.PIPELINE)
            );

            getPipelineVersions(id)
              .then((vres) => {
                setVersionList(vres);
                setIsloading(false);
              })
              .catch((err: AxiosError) => {
                showErrorToast(
                  err,
                  t('server.entity-fetch-version-error', {
                    entity: entityFQN,
                    version: '',
                  })
                );
              });
          })
          .catch((err: AxiosError) => {
            showErrorToast(
              err,
              t('server.entity-fetch-version-error', {
                entity: entityFQN,
                version: '',
              })
            );
          });

        break;
      }

      case EntityType.MLMODEL: {
        getMlModelByFQN(
          getPartialNameFromFQN(
            entityFQN,
            ['service', 'database'],
            FQN_SEPARATOR_CHAR
          ),
          MlModelFields
        )
          .then((res) => {
            const { id, owner, tags = [] } = res;

            setEntityState(
              tags,
              owner,
              res,
              getEntityBreadcrumbs(res, EntityType.MLMODEL)
            );

            getMlModelVersions(id)
              .then((vres) => {
                setVersionList(vres);
                setIsloading(false);
              })
              .catch((err: AxiosError) => {
                showErrorToast(
                  err,
                  t('server.entity-fetch-version-error', {
                    entity: entityFQN,
                    version: '',
                  })
                );
              });
          })

          .catch((err: AxiosError) => {
            showErrorToast(
              err,
              t('server.entity-fetch-version-error', {
                entity: entityFQN,
                version: '',
              })
            );
          });

        break;
      }

      case EntityType.CONTAINER: {
        try {
          const response = await getContainerByName(
            getPartialNameFromFQN(
              entityFQN,
              ['service', 'database'],
              FQN_SEPARATOR_CHAR
            ),
            'dataModel,owner,tags'
          );
          const { id, owner, tags = [] } = response;

          setEntityState(
            tags,
            owner,
            response,
            getEntityBreadcrumbs(response, EntityType.CONTAINER)
          );
          const versions = await getContainerVersions(id);
          setVersionList(versions);
        } catch (err) {
          showErrorToast(
            err as AxiosError,
            t('server.entity-fetch-version-error', {
              entity: entityFQN,
              version: '',
            })
          );
        } finally {
          setIsloading(false);
        }

        break;
      }
      case EntityType.DASHBOARD_DATA_MODEL: {
        getDataModelDetailsByFQN(entityFQN, DataModelFields)
          .then((res) => {
            const { id, owner, tags = [] } = res;

            setEntityState(
              tags,
              owner,
              res,
              getEntityBreadcrumbs(res, EntityType.DASHBOARD_DATA_MODEL)
            );

            getDataModelVersionsList(id ?? '')
              .then((vres) => {
                setVersionList(vres);
                setIsloading(false);
              })
              .catch((err: AxiosError) => {
                showErrorToast(
                  err,
                  t('server.entity-fetch-version-error', {
                    entity: entityFQN,
                    version: '',
                  })
                );
              });
          })

          .catch((err: AxiosError) => {
            showErrorToast(
              err,
              t('server.entity-fetch-version-error', {
                entity: entityFQN,
                version: '',
              })
            );
          });

        break;
      }

      default:
        break;
    }
  };

  const fetchCurrentVersion = async () => {
    setIsVersionLoading(true);
    switch (entityType) {
      case EntityType.TABLE: {
        getTableDetailsByFQN(
          getPartialNameFromTableFQN(
            entityFQN,
            [FqnPart.Service, FqnPart.Database, FqnPart.Schema, FqnPart.Table],
            FQN_SEPARATOR_CHAR
          ),
          []
        )
          .then((res) => {
            const { id } = res;
            getTableVersion(id, version)
              .then((vRes) => {
                const { owner, tags } = vRes;
                setEntityState(
                  tags,
                  owner,
                  vRes,
                  getEntityBreadcrumbs(vRes, EntityType.TABLE)
                );
                setIsVersionLoading(false);
              })
              .catch((err: AxiosError) => {
                showErrorToast(
                  err,
                  t('server.entity-fetch-version-error', {
                    entity: entityFQN,
                    version: version,
                  })
                );
              });
          })
          .catch((err: AxiosError) => {
            showErrorToast(
              err,
              t('server.entity-fetch-version-error', {
                entity: entityFQN,
                version: version,
              })
            );
          });

        break;
      }

      case EntityType.TOPIC: {
        getTopicByFqn(
          getPartialNameFromFQN(
            entityFQN,
            ['service', 'database'],
            FQN_SEPARATOR_CHAR
          ),
          []
        )
          .then((res) => {
            const { id } = res;
            getTopicVersion(id, version)
              .then((vRes) => {
                const { owner, tags = [] } = vRes;

                setEntityState(
                  tags,
                  owner,
                  vRes,
                  getEntityBreadcrumbs(vRes, EntityType.TOPIC)
                );
                setIsVersionLoading(false);
              })
              .catch((err: AxiosError) => {
                showErrorToast(
                  err,
                  t('server.entity-fetch-version-error', {
                    entity: entityFQN,
                    version: version,
                  })
                );
              });
          })
          .catch((err: AxiosError) => {
            showErrorToast(
              err,
              t('server.entity-fetch-version-error', {
                entity: entityFQN,
                version: version,
              })
            );
          });

        break;
      }
      case EntityType.DASHBOARD: {
        getDashboardByFqn(
          getPartialNameFromFQN(
            entityFQN,
            ['service', 'database'],
            FQN_SEPARATOR_CHAR
          ),
          []
        )
          .then((res) => {
            const { id } = res;
            getDashboardVersion(id, version)
              .then((vRes) => {
                const { owner, tags = [] } = vRes;

                setEntityState(
                  tags,
                  owner,
                  vRes,
                  getEntityBreadcrumbs(vRes, EntityType.DASHBOARD)
                );
                setIsVersionLoading(false);
              })
              .catch((err: AxiosError) => {
                showErrorToast(
                  err,
                  t('server.entity-fetch-version-error', {
                    entity: entityFQN,
                    version: version,
                  })
                );
              });
          })
          .catch((err: AxiosError) => {
            showErrorToast(
              err,
              t('server.entity-fetch-version-error', {
                entity: entityFQN,
                version: version,
              })
            );
          });

        break;
      }
      case EntityType.PIPELINE: {
        getPipelineByFqn(
          getPartialNameFromFQN(
            entityFQN,
            ['service', 'database'],
            FQN_SEPARATOR_CHAR
          ),
          []
        )
          .then((res) => {
            const { id } = res;
            getPipelineVersion(id, version)
              .then((vRes) => {
                const { owner, tags = [] } = vRes;

                setEntityState(
                  tags,
                  owner,
                  vRes,
                  getEntityBreadcrumbs(vRes, EntityType.PIPELINE)
                );
                setIsVersionLoading(false);
              })
              .catch((err: AxiosError) => {
                showErrorToast(
                  err,
                  t('server.entity-fetch-version-error', {
                    entity: entityFQN,
                    version: version,
                  })
                );
              });
          })
          .catch((err: AxiosError) => {
            showErrorToast(
              err,
              t('server.entity-fetch-version-error', {
                entity: entityFQN,
                version: version,
              })
            );
          });

        break;
      }

      case EntityType.MLMODEL: {
        getMlModelByFQN(
          getPartialNameFromFQN(
            entityFQN,
            ['service', 'database'],
            FQN_SEPARATOR_CHAR
          ),
          MlModelFields
        )
          .then((res) => {
            const { id } = res;
            getMlModelVersion(id, version)
              .then((vRes) => {
                const { owner, tags = [] } = vRes;
                setEntityState(
                  tags,
                  owner,
                  vRes,
                  getEntityBreadcrumbs(vRes, EntityType.MLMODEL)
                );
                setIsVersionLoading(false);
              })
              .catch((err: AxiosError) => {
                showErrorToast(
                  err,
                  t('server.entity-fetch-version-error', {
                    entity: entityFQN,
                    version: version,
                  })
                );
              });
          })
          .catch((err: AxiosError) => {
            showErrorToast(
              err,
              t('server.entity-fetch-version-error', {
                entity: entityFQN,
                version: version,
              })
            );
          });

        break;
      }
      case EntityType.CONTAINER: {
        try {
          const response = await getContainerByName(
            getPartialNameFromFQN(
              entityFQN,
              ['service', 'database'],
              FQN_SEPARATOR_CHAR
            ),
            'dataModel,owner,tags'
          );
          const { id } = response;
          const currentVersion = await getContainerVersion(id, version);
          const { owner, tags = [] } = currentVersion;

          setEntityState(
            tags,
            owner,
            currentVersion,
            getEntityBreadcrumbs(currentVersion, EntityType.CONTAINER)
          );
        } catch (err) {
          showErrorToast(
            err as AxiosError,
            t('server.entity-fetch-version-error', {
              entity: entityFQN,
              version: '',
            })
          );
        } finally {
          setIsVersionLoading(false);
        }

        break;
      }

      case EntityType.DASHBOARD_DATA_MODEL: {
        getDataModelDetailsByFQN(entityFQN, [])
          .then((res) => {
            const { id } = res;
            getDataModelVersion(id ?? '', version)
              .then((vRes) => {
                const { owner, tags = [] } = vRes;

                setEntityState(
                  tags,
                  owner,
                  vRes,
                  getEntityBreadcrumbs(vRes, EntityType.DASHBOARD_DATA_MODEL)
                );
                setIsVersionLoading(false);
              })
              .catch((err: AxiosError) => {
                showErrorToast(
                  err,
                  t('server.entity-fetch-version-error', {
                    entity: entityFQN,
                    version: version,
                  })
                );
              });
          })
          .catch((err: AxiosError) => {
            showErrorToast(
              err,
              t('server.entity-fetch-version-error', {
                entity: entityFQN,
                version: version,
              })
            );
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
            deleted={currentVersionData.deleted}
            isVersionLoading={isVersionLoading}
            owner={owner}
            slashedTableName={slashedEntityName}
            tier={tier as TagLabel}
            version={Number(version)}
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
            deleted={currentVersionData.deleted}
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
            deleted={currentVersionData.deleted}
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
            deleted={currentVersionData.deleted}
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

      case EntityType.MLMODEL: {
        return (
          <MlModelVersion
            backHandler={backHandler}
            currentVersionData={currentVersionData}
            deleted={currentVersionData.deleted}
            isVersionLoading={isVersionLoading}
            owner={owner}
            slashedMlModelName={slashedEntityName}
            tier={tier as TagLabel}
            topicFQN={entityFQN}
            version={version}
            versionHandler={versionHandler}
            versionList={versionList}
          />
        );
      }
      case EntityType.CONTAINER: {
        return (
          <ContainerVersion
            backHandler={backHandler}
            breadCrumbList={slashedEntityName}
            containerFQN={entityFQN}
            currentVersionData={currentVersionData}
            deleted={currentVersionData.deleted}
            isVersionLoading={isVersionLoading}
            owner={owner}
            tier={tier as TagLabel}
            version={Number(version)}
            versionHandler={versionHandler}
            versionList={versionList}
          />
        );
      }

      case EntityType.DASHBOARD_DATA_MODEL: {
        return (
          <DataModelVersion
            backHandler={backHandler}
            currentVersionData={currentVersionData}
            dataModelFQN={entityFQN}
            deleted={currentVersionData.deleted}
            isVersionLoading={isVersionLoading}
            owner={owner}
            slashedDataModelName={slashedEntityName}
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

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: getEntityName(currentVersionData),
      })}>
      <div className="page-container">
        {isLoading ? <Loader /> : versionComponent()}
      </div>
    </PageLayoutV1>
  );
};

export default EntityVersionPage;
