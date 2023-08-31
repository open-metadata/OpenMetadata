/*
 *  Copyright 2023 Collate.
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
import { Col, Row } from 'antd';
import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import { DataAssetsHeader } from 'components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import Loader from 'components/Loader/Loader';
import { EntityName } from 'components/Modals/EntityNameModal/EntityNameModal.interface';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import { getVersionPath } from 'constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { EntityType } from 'enums/entity.enum';
import { compare } from 'fast-json-patch';
import { StoredProcedure } from 'generated/entity/data/storedProcedure';
import { LabelType, State } from 'generated/type/tagLabel';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import {
  addStoredProceduresFollower,
  getStoredProceduresDetailsByFQN,
  patchStoredProceduresDetails,
  removeStoredProceduresFollower,
  restoreStoredProcedures,
} from 'rest/storedProceduresAPI';
import { getCurrentUserId, sortTagsCaseInsensitive } from 'utils/CommonUtils';
import { getEntityName } from 'utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from 'utils/PermissionsUtils';
import { STORED_PROCEDURE_DEFAULT_FIELDS } from 'utils/StoredProceduresUtils';
import { getTagsWithoutTier, getTierTags } from 'utils/TableUtils';
import { showErrorToast, showSuccessToast } from 'utils/ToastUtils';

const StoredProcedurePage = () => {
  const { t } = useTranslation();
  const USER_ID = getCurrentUserId();
  const history = useHistory();
  const { storedProcedureFQN } = useParams<{ storedProcedureFQN: string }>();
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [storedProcedure, setStoredProcedure] = useState<StoredProcedure>();
  const [storedProcedurePermissions, setStoredProcedurePermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const {
    id: storedProcedureId = '',
    followers,
    owner,
    tags,
    version,
  } = useMemo(() => {
    return {
      ...storedProcedure,
      tier: getTierTags(storedProcedure?.tags ?? []),
      tags: getTagsWithoutTier(storedProcedure?.tags || []),
    };
  }, [storedProcedure]);

  const { isFollowing } = useMemo(() => {
    return {
      isFollowing: followers?.some(({ id }) => id === USER_ID),
    };
  }, [followers, USER_ID]);

  const fetchResourcePermission = useCallback(async () => {
    try {
      const permission = await getEntityPermissionByFqn(
        ResourceEntity.STORED_PROCEDURE,
        storedProcedureFQN
      );

      setStoredProcedurePermissions(permission);
    } catch (error) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.resource-permission-lowercase'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  }, [getEntityPermissionByFqn]);

  const fetchStoredProceduresDetails = async () => {
    setIsLoading(true);
    try {
      const response = await getStoredProceduresDetailsByFQN(
        storedProcedureFQN,
        STORED_PROCEDURE_DEFAULT_FIELDS
      );

      setStoredProcedure(response);
    } catch (error) {
      // Error here
    } finally {
      setIsLoading(false);
    }
  };

  const versionHandler = useCallback(() => {
    version &&
      history.push(
        getVersionPath(
          EntityType.STORED_PROCEDURE,
          storedProcedureFQN,
          version + ''
        )
      );
  }, [version]);

  const saveUpdatedStoredProceduresData = useCallback(
    (updatedData: StoredProcedure) => {
      if (!storedProcedure) {
        return updatedData;
      }
      const jsonPatch = compare(storedProcedure ?? '', updatedData);

      return patchStoredProceduresDetails(storedProcedureId ?? '', jsonPatch);
    },
    [storedProcedure]
  );

  const handleStoreProcedureUpdate = async (
    updatedData: StoredProcedure,
    key: keyof StoredProcedure
  ) => {
    try {
      const res = await saveUpdatedStoredProceduresData(updatedData);

      setStoredProcedure((previous) => {
        if (!previous) {
          return;
        }
        if (key === 'tags') {
          return {
            ...previous,
            version: res.version,
            [key]: sortTagsCaseInsensitive(res.tags ?? []),
          };
        }

        return {
          ...previous,
          version: res.version,
          [key]: res[key],
        };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const followEntity = useCallback(async () => {
    try {
      const res = await addStoredProceduresFollower(storedProcedureId, USER_ID);
      const { newValue } = res.changeDescription.fieldsAdded[0];
      const newFollowers = [...(followers ?? []), ...newValue];
      setStoredProcedure((prev) => {
        if (!prev) {
          return prev;
        }

        return { ...prev, followers: newFollowers };
      });
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(storedProcedure),
        })
      );
    }
  }, [USER_ID, storedProcedureId]);

  const unFollowEntity = useCallback(async () => {
    try {
      const res = await removeStoredProceduresFollower(
        storedProcedureId,
        USER_ID
      );
      const { oldValue } = res.changeDescription.fieldsDeleted[0];
      setStoredProcedure((pre) => {
        if (!pre) {
          return pre;
        }

        return {
          ...pre,
          followers: pre.followers?.filter(
            (follower) => follower.id !== oldValue[0].id
          ),
        };
      });
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: getEntityName(storedProcedure),
        })
      );
    }
  }, [USER_ID, storedProcedureId]);

  const handleDisplayNameUpdate = async (data: EntityName) => {
    if (!storedProcedure) {
      return;
    }
    const updatedData = { ...storedProcedure, displayName: data.displayName };
    await handleStoreProcedureUpdate(updatedData, 'displayName');
  };

  const handleFollow = useCallback(async () => {
    isFollowing ? await unFollowEntity() : await followEntity();
  }, [isFollowing, followEntity, unFollowEntity]);

  const handleUpdateOwner = useCallback(
    async (newOwner?: StoredProcedure['owner']) => {
      if (!storedProcedure) {
        return;
      }
      const updatedEntityDetails = {
        ...storedProcedure,
        owner: newOwner
          ? {
              ...owner,
              ...newOwner,
            }
          : undefined,
      };
      await handleStoreProcedureUpdate(updatedEntityDetails, 'owner');
    },
    [owner, storedProcedure]
  );

  const handleToggleDelete = () => {
    setStoredProcedure((prev) => {
      if (!prev) {
        return prev;
      }

      return { ...prev, deleted: !prev?.deleted };
    });
  };

  const handleRestoreStoredProcedures = async () => {
    try {
      await restoreStoredProcedures(storedProcedureId);
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.stored-procedure'),
        }),
        2000
      );
      handleToggleDelete();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.stored-procedure'),
        })
      );
    }
  };

  const onTierUpdate = useCallback(
    async (newTier?: string) => {
      if (storedProcedure) {
        const tierTag: StoredProcedure['tags'] = newTier
          ? [
              ...getTagsWithoutTier(tags ?? []),
              {
                tagFQN: newTier,
                labelType: LabelType.Manual,
                state: State.Confirmed,
              },
            ]
          : getTagsWithoutTier(tags ?? []);
        const updatedDetails = {
          ...storedProcedure,
          tags: tierTag,
        };

        await handleStoreProcedureUpdate(updatedDetails, 'tags');
      }
    },
    [storedProcedure, tags]
  );

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) =>
      isSoftDelete ? handleToggleDelete() : history.push('/'),
    []
  );

  useEffect(() => {
    if (storedProcedureFQN) {
      fetchResourcePermission();
    }
  }, [storedProcedureFQN]);

  useEffect(() => {
    if (
      storedProcedurePermissions.ViewAll ||
      storedProcedurePermissions.ViewBasic
    ) {
      fetchStoredProceduresDetails();
    }
  }, [storedProcedureFQN, storedProcedurePermissions]);

  if (isLoading) {
    return <Loader />;
  }

  if (
    !(
      storedProcedurePermissions.ViewAll || storedProcedurePermissions.ViewBasic
    )
  ) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  if (!storedProcedure) {
    return <ErrorPlaceHolder />;
  }

  return (
    <PageLayoutV1 className="bg-white" pageTitle={t('label.stored-procedure')}>
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" data-testid="entity-page-header" span={24}>
          <DataAssetsHeader
            afterDeleteAction={afterDeleteAction}
            dataAsset={storedProcedure}
            entityType={EntityType.STORED_PROCEDURE}
            permissions={storedProcedurePermissions}
            onDisplayNameUpdate={handleDisplayNameUpdate}
            onFollowClick={handleFollow}
            onOwnerUpdate={handleUpdateOwner}
            onRestoreDataAsset={handleRestoreStoredProcedures}
            onTierUpdate={onTierUpdate}
            onVersionClick={versionHandler}
          />
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default StoredProcedurePage;
