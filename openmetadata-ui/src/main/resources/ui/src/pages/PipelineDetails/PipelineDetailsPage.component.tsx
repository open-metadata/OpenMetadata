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
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import PipelineDetails from 'components/PipelineDetails/PipelineDetails.component';
import { compare, Operation } from 'fast-json-patch';
import { isUndefined, omitBy } from 'lodash';
import { observer } from 'mobx-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import {
  addFollower,
  getPipelineByFqn,
  patchPipelineDetails,
  removeFollower,
} from 'rest/pipelineAPI';
import {
  getServiceDetailsPath,
  getVersionPath,
} from '../../constants/constants';
import { NO_PERMISSION_TO_VIEW } from '../../constants/HelperTextUtil';
import { EntityType } from '../../enums/entity.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { Pipeline } from '../../generated/entity/data/pipeline';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import jsonData from '../../jsons/en';
import {
  addToRecentViewed,
  getCurrentUserId,
  getEntityMissingError,
  sortTagsCaseInsensitive,
} from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import {
  defaultFields,
  getFormattedPipelineDetails,
} from '../../utils/PipelineDetailsUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const PipelineDetailsPage = () => {
  const USERId = getCurrentUserId();
  const history = useHistory();

  const { pipelineFQN } = useParams<{ pipelineFQN: string }>();
  const [pipelineDetails, setPipelineDetails] = useState<Pipeline>(
    {} as Pipeline
  );

  const [isLoading, setLoading] = useState<boolean>(true);
  const [followers, setFollowers] = useState<Array<EntityReference>>([]);

  const [slashedPipelineName, setSlashedPipelineName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  const [isError, setIsError] = useState(false);

  const [paging] = useState<Paging>({} as Paging);

  const [pipelinePermissions, setPipelinePermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const { getEntityPermissionByFqn } = usePermissionProvider();

  const fetchResourcePermission = async (entityFqn: string) => {
    setLoading(true);
    try {
      const entityPermission = await getEntityPermissionByFqn(
        ResourceEntity.PIPELINE,
        entityFqn
      );
      setPipelinePermissions(entityPermission);
    } catch (error) {
      showErrorToast(
        jsonData['api-error-messages']['fetch-entity-permissions-error']
      );
    } finally {
      setLoading(false);
    }
  };

  const { pipelineId, currentVersion } = useMemo(() => {
    return {
      pipelineId: pipelineDetails.id,
      currentVersion: pipelineDetails.version + '',
    };
  }, [pipelineDetails]);

  const saveUpdatedPipelineData = useCallback(
    (updatedData: Pipeline) => {
      const jsonPatch = compare(
        omitBy(pipelineDetails, isUndefined),
        updatedData
      );

      return patchPipelineDetails(pipelineId, jsonPatch);
    },
    [pipelineDetails]
  );

  const fetchPipelineDetail = (pipelineFQN: string) => {
    setLoading(true);
    getPipelineByFqn(pipelineFQN, defaultFields)
      .then((res) => {
        if (res) {
          const { id, fullyQualifiedName, service, serviceType } = res;

          setPipelineDetails(res);
          const serviceName = service.name ?? '';
          setSlashedPipelineName([
            {
              name: serviceName,
              url: serviceName
                ? getServiceDetailsPath(
                    serviceName,
                    ServiceCategory.PIPELINE_SERVICES
                  )
                : '',
              imgSrc: serviceType ? serviceTypeLogo(serviceType) : undefined,
            },
            {
              name: getEntityName(res),
              url: '',
              activeTitle: true,
            },
          ]);

          addToRecentViewed({
            displayName: getEntityName(res),
            entityType: EntityType.PIPELINE,
            fqn: fullyQualifiedName ?? '',
            serviceType: serviceType,
            timestamp: 0,
            id: id,
          });
        } else {
          setIsError(true);

          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        if (err.response?.status === 404) {
          setIsError(true);
        } else {
          showErrorToast(
            err,
            jsonData['api-error-messages']['fetch-pipeline-details-error']
          );
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const followPipeline = () => {
    addFollower(pipelineId, USERId)
      .then((res) => {
        if (res) {
          const { newValue } = res.changeDescription.fieldsAdded[0];

          setFollowers([...followers, ...newValue]);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-entity-follow-error']
        );
      });
  };

  const unfollowPipeline = () => {
    removeFollower(pipelineId, USERId)
      .then((res) => {
        if (res) {
          const { oldValue } = res.changeDescription.fieldsDeleted[0];

          setFollowers(
            followers.filter((follower) => follower.id !== oldValue[0].id)
          );
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-entity-unfollow-error']
        );
      });
  };

  const descriptionUpdateHandler = async (updatedPipeline: Pipeline) => {
    try {
      const response = await saveUpdatedPipelineData(updatedPipeline);
      if (response) {
        setPipelineDetails(response);
      } else {
        throw jsonData['api-error-messages']['unexpected-server-response'];
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const settingsUpdateHandler = (updatedPipeline: Pipeline): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      saveUpdatedPipelineData(updatedPipeline)
        .then((res) => {
          if (res) {
            setPipelineDetails({ ...res, tags: res.tags ?? [] });

            resolve();
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['update-entity-error']
          );
          reject();
        });
    });
  };

  const onTagUpdate = async (updatedPipeline: Pipeline) => {
    try {
      const res = await saveUpdatedPipelineData(updatedPipeline);

      setPipelineDetails({
        ...res,
        tags: sortTagsCaseInsensitive(res.tags || []),
      });
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        jsonData['api-error-messages']['update-tags-error']
      );
    }
  };

  const onTaskUpdate = async (jsonPatch: Array<Operation>) => {
    try {
      const response = await patchPipelineDetails(pipelineId, jsonPatch);

      if (response) {
        const formattedPipelineDetails = getFormattedPipelineDetails(response);
        setPipelineDetails(formattedPipelineDetails);
      } else {
        throw jsonData['api-error-messages']['unexpected-server-response'];
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const versionHandler = () => {
    history.push(
      getVersionPath(EntityType.PIPELINE, pipelineFQN, currentVersion as string)
    );
  };

  const handleExtensionUpdate = async (updatedPipeline: Pipeline) => {
    try {
      const data = await saveUpdatedPipelineData(updatedPipeline);

      if (data) {
        setPipelineDetails(data);
      } else {
        throw jsonData['api-error-messages']['update-entity-error'];
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['update-entity-error']
      );
    }
  };

  useEffect(() => {
    if (pipelinePermissions.ViewAll || pipelinePermissions.ViewBasic) {
      fetchPipelineDetail(pipelineFQN);
    }
  }, [pipelinePermissions, pipelineFQN]);

  useEffect(() => {
    fetchResourcePermission(pipelineFQN);
  }, [pipelineFQN]);

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : isError ? (
        <ErrorPlaceHolder>
          {getEntityMissingError('pipeline', pipelineFQN)}
        </ErrorPlaceHolder>
      ) : (
        <>
          {pipelinePermissions.ViewAll || pipelinePermissions.ViewBasic ? (
            <PipelineDetails
              descriptionUpdateHandler={descriptionUpdateHandler}
              followPipelineHandler={followPipeline}
              followers={followers}
              paging={paging}
              pipelineDetails={pipelineDetails}
              pipelineFQN={pipelineFQN}
              settingsUpdateHandler={settingsUpdateHandler}
              slashedPipelineName={slashedPipelineName}
              tagUpdateHandler={onTagUpdate}
              taskUpdateHandler={onTaskUpdate}
              unfollowPipelineHandler={unfollowPipeline}
              versionHandler={versionHandler}
              onExtensionUpdate={handleExtensionUpdate}
            />
          ) : (
            <ErrorPlaceHolder>{NO_PERMISSION_TO_VIEW}</ErrorPlaceHolder>
          )}
        </>
      )}
    </>
  );
};

export default observer(PipelineDetailsPage);
