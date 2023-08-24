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

import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import ContainerVersion from 'components/ContainerVersion/ContainerVersion.component';
import DashboardVersion from 'components/DashboardVersion/DashboardVersion.component';
import DataModelVersion from 'components/DataModelVersion/DataModelVersion.component';
import Loader from 'components/Loader/Loader';
import MlModelVersion from 'components/MlModelVersion/MlModelVersion.component';
import PipelineVersion from 'components/PipelineVersion/PipelineVersion.component';
import TableVersion from 'components/TableVersion/TableVersion.component';
import TopicVersion from 'components/TopicVersion/TopicVersion.component';
import { Container } from 'generated/entity/data/container';
import { DashboardDataModel } from 'generated/entity/data/dashboardDataModel';
import { Mlmodel } from 'generated/entity/data/mlmodel';
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
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
  getTableTabPath,
  getTopicDetailsPath,
  getVersionPath,
  getVersionPathWithTab,
} from '../../constants/constants';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { Pipeline } from '../../generated/entity/data/pipeline';
import { Table } from '../../generated/entity/data/table';
import { Topic } from '../../generated/entity/data/topic';
import { EntityHistory } from '../../generated/type/entityHistory';
import { TagLabel } from '../../generated/type/tagLabel';
import { getPartialNameFromFQN } from '../../utils/CommonUtils';

import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { isEmpty } from 'lodash';
import { DEFAULT_ENTITY_PERMISSION } from 'utils/PermissionsUtils';
import { getTierTags } from '../../utils/TableUtils';
import './EntityVersionPage.less';

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
  const { tab } = useParams<{ tab: EntityTabs }>();
  const history = useHistory();
  const [tier, setTier] = useState<TagLabel>();
  const [owner, setOwner] = useState<
    Table['owner'] & { displayName?: string }
  >();
  const [entityId, setEntityId] = useState<string>('');
  const [currentVersionData, setCurrentVersionData] = useState<VersionData>(
    {} as VersionData
  );

  const { entityType, version, entityFQN } =
    useParams<{ entityType: string; version: string; entityFQN: string }>();

  const { getEntityPermissionByFqn } = usePermissionProvider();
  const [entityPermissions, setEntityPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [versionList, setVersionList] = useState<EntityHistory>(
    {} as EntityHistory
  );
  const [isVersionLoading, setIsVersionLoading] = useState<boolean>(true);
  const [slashedEntityName, setSlashedEntityName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  const backHandler = useCallback(() => {
    switch (entityType) {
      case EntityType.TABLE:
        history.push(getTableTabPath(entityFQN, tab));

        break;

      case EntityType.TOPIC:
        history.push(getTopicDetailsPath(entityFQN, tab));

        break;

      case EntityType.DASHBOARD:
        history.push(getDashboardDetailsPath(entityFQN, tab));

        break;

      case EntityType.PIPELINE:
        history.push(getPipelineDetailsPath(entityFQN, tab));

        break;

      case EntityType.MLMODEL:
        history.push(getMlModelDetailsPath(entityFQN, tab));

        break;

      case EntityType.CONTAINER:
        history.push(getContainerDetailPath(entityFQN, tab));

        break;
      case EntityType.DASHBOARD_DATA_MODEL:
        history.push(getDataModelDetailsPath(entityFQN, tab));

        break;

      default:
        break;
    }
  }, [entityType, entityFQN, tab]);

  const versionHandler = useCallback(
    (newVersion = version) => {
      if (tab) {
        history.push(
          getVersionPathWithTab(entityType, entityFQN, newVersion, tab)
        );
      } else {
        history.push(getVersionPath(entityType, entityFQN, newVersion));
      }
    },
    [entityType, entityFQN, tab]
  );

  const setEntityState = useCallback(
    (
      tags: TagLabel[],
      owner: Table['owner'],
      data: VersionData,
      titleBreadCrumb: TitleBreadcrumbProps['titleLinks']
    ) => {
      setTier(getTierTags(tags));
      setOwner(owner);
      setCurrentVersionData(data);
      setSlashedEntityName(titleBreadCrumb);
    },
    []
  );

  const fetchResourcePermission = useCallback(
    async (resourceEntity: ResourceEntity) => {
      if (!isEmpty(entityFQN)) {
        try {
          const permission = await getEntityPermissionByFqn(
            resourceEntity,
            entityFQN
          );

          setEntityPermissions(permission);
        } catch (error) {
          //
        }
      }
    },
    [entityFQN, getEntityPermissionByFqn, setEntityPermissions]
  );

  const fetchEntityPermissions = useCallback(async () => {
    setIsLoading(true);
    try {
      switch (entityType) {
        case EntityType.TABLE: {
          await fetchResourcePermission(ResourceEntity.TABLE);

          break;
        }
        case EntityType.TOPIC: {
          await fetchResourcePermission(ResourceEntity.TOPIC);

          break;
        }
        case EntityType.DASHBOARD: {
          await fetchResourcePermission(ResourceEntity.DASHBOARD);

          break;
        }
        case EntityType.PIPELINE: {
          await fetchResourcePermission(ResourceEntity.PIPELINE);

          break;
        }
        case EntityType.MLMODEL: {
          await fetchResourcePermission(ResourceEntity.ML_MODEL);

          break;
        }
        case EntityType.CONTAINER: {
          await fetchResourcePermission(ResourceEntity.CONTAINER);

          break;
        }
        case EntityType.DASHBOARD_DATA_MODEL: {
          await fetchResourcePermission(ResourceEntity.DASHBOARD_DATA_MODEL);

          break;
        }
        default: {
          break;
        }
      }
    } catch {
      // Error
    }
  }, [entityType, fetchResourcePermission]);

  const viewVersionPermission = useMemo(
    () => entityPermissions.ViewAll || entityPermissions.ViewBasic,
    [entityPermissions]
  );

  const fetchEntityVersions = useCallback(async () => {
    setIsLoading(true);
    try {
      if (viewVersionPermission) {
        switch (entityType) {
          case EntityType.TABLE: {
            const { id } = await getTableDetailsByFQN(entityFQN, '');

            setEntityId(id);

            const versions = await getTableVersions(id);

            setVersionList(versions);

            break;
          }

          case EntityType.TOPIC: {
            const { id } = await getTopicByFqn(
              getPartialNameFromFQN(
                entityFQN,
                ['service', 'database'],
                FQN_SEPARATOR_CHAR
              ),
              ''
            );

            setEntityId(id);

            const versions = await getTopicVersions(id);

            setVersionList(versions);

            break;
          }

          case EntityType.DASHBOARD: {
            const { id } = await getDashboardByFqn(
              getPartialNameFromFQN(
                entityFQN,
                ['service', 'database'],
                FQN_SEPARATOR_CHAR
              ),
              ''
            );

            setEntityId(id);

            const versions = await getDashboardVersions(id);

            setVersionList(versions);

            break;
          }

          case EntityType.PIPELINE: {
            const { id } = await getPipelineByFqn(
              getPartialNameFromFQN(
                entityFQN,
                ['service', 'database'],
                FQN_SEPARATOR_CHAR
              ),
              ''
            );

            setEntityId(id);

            const versions = await getPipelineVersions(id);

            setVersionList(versions);

            break;
          }

          case EntityType.MLMODEL: {
            const { id } = await getMlModelByFQN(
              getPartialNameFromFQN(
                entityFQN,
                ['service', 'database'],
                FQN_SEPARATOR_CHAR
              ),
              ''
            );

            setEntityId(id);

            const versions = await getMlModelVersions(id);

            setVersionList(versions);

            break;
          }

          case EntityType.CONTAINER: {
            const { id } = await getContainerByName(entityFQN, '');

            setEntityId(id);

            const versions = await getContainerVersions(id);

            setVersionList(versions);

            break;
          }

          case EntityType.DASHBOARD_DATA_MODEL: {
            const { id } = await getDataModelDetailsByFQN(entityFQN, '');

            setEntityId(id ?? '');

            const versions = await getDataModelVersionsList(id ?? '');

            setVersionList(versions);

            break;
          }

          default:
            break;
        }
      }
    } catch (err) {
      // Error
    } finally {
      setIsLoading(false);
    }
  }, [entityType, entityFQN, viewVersionPermission]);

  const fetchCurrentVersion = useCallback(
    async (id: string) => {
      setIsVersionLoading(true);
      try {
        if (viewVersionPermission) {
          switch (entityType) {
            case EntityType.TABLE: {
              const currentVersion = await getTableVersion(id, version);

              const { owner, tags = [] } = currentVersion;

              setEntityState(
                tags,
                owner,
                currentVersion,
                getEntityBreadcrumbs(currentVersion, EntityType.TABLE)
              );

              break;
            }

            case EntityType.TOPIC: {
              const currentVersion = await getTopicVersion(id, version);

              const { owner, tags = [] } = currentVersion;

              setEntityState(
                tags,
                owner,
                currentVersion,
                getEntityBreadcrumbs(currentVersion, EntityType.TOPIC)
              );

              break;
            }
            case EntityType.DASHBOARD: {
              const currentVersion = await getDashboardVersion(id, version);

              const { owner, tags = [] } = currentVersion;

              setEntityState(
                tags,
                owner,
                currentVersion,
                getEntityBreadcrumbs(currentVersion, EntityType.DASHBOARD)
              );

              break;
            }
            case EntityType.PIPELINE: {
              const currentVersion = await getPipelineVersion(id, version);

              const { owner, tags = [] } = currentVersion;

              setEntityState(
                tags,
                owner,
                currentVersion,
                getEntityBreadcrumbs(currentVersion, EntityType.PIPELINE)
              );

              break;
            }

            case EntityType.MLMODEL: {
              const currentVersion = await getMlModelVersion(id, version);

              const { owner, tags = [] } = currentVersion;
              setEntityState(
                tags,
                owner,
                currentVersion,
                getEntityBreadcrumbs(currentVersion, EntityType.MLMODEL)
              );

              break;
            }
            case EntityType.CONTAINER: {
              const currentVersion = await getContainerVersion(id, version);
              const { owner, tags = [] } = currentVersion;

              setEntityState(
                tags,
                owner,
                currentVersion,
                getEntityBreadcrumbs(currentVersion, EntityType.CONTAINER)
              );

              break;
            }

            case EntityType.DASHBOARD_DATA_MODEL: {
              const currentVersion = await getDataModelVersion(id, version);

              const { owner, tags = [] } = currentVersion;

              setEntityState(
                tags,
                owner,
                currentVersion,
                getEntityBreadcrumbs(
                  currentVersion,
                  EntityType.DASHBOARD_DATA_MODEL
                )
              );

              break;
            }

            default:
              break;
          }
        }
      } finally {
        setIsVersionLoading(false);
      }
    },
    [entityType, version, setEntityState, viewVersionPermission]
  );

  const versionComponent = () => {
    if (isLoading) {
      return <Loader />;
    }

    if (!viewVersionPermission) {
      return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
    }

    switch (entityType) {
      case EntityType.TABLE: {
        return (
          <TableVersion
            backHandler={backHandler}
            currentVersionData={currentVersionData}
            datasetFQN={entityFQN}
            deleted={currentVersionData.deleted}
            entityPermissions={entityPermissions}
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
            deleted={currentVersionData.deleted}
            entityPermissions={entityPermissions}
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
            entityPermissions={entityPermissions}
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
            entityPermissions={entityPermissions}
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
            entityPermissions={entityPermissions}
            isVersionLoading={isVersionLoading}
            owner={owner}
            slashedMlModelName={slashedEntityName}
            tier={tier as TagLabel}
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
            entityPermissions={entityPermissions}
            isVersionLoading={isVersionLoading}
            owner={owner}
            tier={tier as TagLabel}
            version={version}
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
    fetchEntityPermissions();
  }, [entityFQN]);

  useEffect(() => {
    fetchEntityVersions();
  }, [entityFQN, viewVersionPermission]);

  useEffect(() => {
    if (entityId) {
      fetchCurrentVersion(entityId);
    }
  }, [version, entityId]);

  return (
    <PageLayoutV1
      className="version-page-container"
      pageTitle={t('label.entity-detail-plural', {
        entity: getEntityName(currentVersionData),
      })}>
      {versionComponent()}
    </PageLayoutV1>
  );
};

export default EntityVersionPage;
