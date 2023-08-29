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
  const USERId = getCurrentUserId();
  const history = useHistory();
  const { storedProceduresFQN } = useParams<{ storedProceduresFQN: string }>();
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [storedProcedures, setStoredProcedures] = useState<StoredProcedure>();
  const [storedProceduresPermissions, setStoredProceduresPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const fetchResourcePermission = useCallback(async () => {
    try {
      const permission = await getEntityPermissionByFqn(
        ResourceEntity.STORED_PROCEDURE,
        storedProceduresFQN
      );

      setStoredProceduresPermissions(permission);
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
        storedProceduresFQN,
        STORED_PROCEDURE_DEFAULT_FIELDS
      );

      setStoredProcedures(response);
    } catch (error) {
      // Error here
    } finally {
      setIsLoading(false);
    }
  };

  const {
    id: storedProceduresId = '',
    followers,
    owner,
    tags,
    version,
  } = useMemo(() => {
    if (storedProcedures) {
      return {
        ...storedProcedures,
        tier: getTierTags(storedProcedures.tags ?? []),
        tags: getTagsWithoutTier(storedProcedures.tags || []),
      };
    }

    return {} as StoredProcedure;
  }, [storedProcedures]);

  const { isFollowing } = useMemo(() => {
    return {
      isFollowing: followers?.some(({ id }) => id === USERId),
    };
  }, [followers, USERId]);

  const versionHandler = useCallback(() => {
    version &&
      history.push(
        getVersionPath(
          EntityType.STORED_PROCEDURE,
          storedProceduresFQN,
          version + ''
        )
      );
  }, [version]);

  const saveUpdatedStoredProceduresData = useCallback(
    (updatedData: StoredProcedure) => {
      if (!storedProcedures) {
        return updatedData;
      }
      const jsonPatch = compare(storedProcedures ?? '', updatedData);

      return patchStoredProceduresDetails(storedProceduresId ?? '', jsonPatch);
    },
    [storedProcedures]
  );

  const handleStoreProceduresUpdate = async (
    updatedData: StoredProcedure,
    key: keyof StoredProcedure
  ) => {
    try {
      const res = await saveUpdatedStoredProceduresData(updatedData);

      setStoredProcedures((previous) => {
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
      //   getEntityFeedCount();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const followStoredProcedure = useCallback(async () => {
    try {
      const res = await addStoredProceduresFollower(storedProceduresId, USERId);
      const { newValue } = res.changeDescription.fieldsAdded[0];
      const newFollowers = [...(followers ?? []), ...newValue];
      setStoredProcedures((prev) => {
        if (!prev) {
          return prev;
        }

        return { ...prev, followers: newFollowers };
      });
      //   getEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(storedProcedures),
        })
      );
    }
  }, [USERId, storedProceduresId]);

  const unFollowStoredProcedure = useCallback(async () => {
    try {
      const res = await removeStoredProceduresFollower(
        storedProceduresId,
        USERId
      );
      const { oldValue } = res.changeDescription.fieldsDeleted[0];
      setStoredProcedures((pre) => {
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
      //   getEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: getEntityName(storedProcedures),
        })
      );
    }
  }, [USERId, storedProceduresId]);

  const handleDisplayNameUpdate = async (data: EntityName) => {
    if (!storedProcedures) {
      return;
    }
    const updatedData = { ...storedProcedures, displayName: data.displayName };
    await handleStoreProceduresUpdate(updatedData, 'displayName');
  };

  const handleFollow = useCallback(async () => {
    isFollowing
      ? await unFollowStoredProcedure()
      : await followStoredProcedure();
  }, [isFollowing, followStoredProcedure, unFollowStoredProcedure]);

  const handleUpdateOwner = useCallback(
    async (newOwner?: StoredProcedure['owner']) => {
      if (!storedProcedures) {
        return;
      }
      const updatedTableDetails = {
        ...storedProcedures,
        owner: newOwner
          ? {
              ...owner,
              ...newOwner,
            }
          : undefined,
      };
      await handleStoreProceduresUpdate(updatedTableDetails, 'owner');
    },
    [owner, storedProcedures]
  );

  const handleToggleDelete = () => {
    setStoredProcedures((prev) => {
      if (!prev) {
        return prev;
      }

      return { ...prev, deleted: !prev?.deleted };
    });
  };

  const handleRestoreStoredProcedures = async () => {
    try {
      await restoreStoredProcedures(storedProceduresId);
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.table'),
        }),
        2000
      );
      handleToggleDelete();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.table'),
        })
      );
    }
  };

  const onTierUpdate = useCallback(
    async (newTier?: string) => {
      if (storedProcedures) {
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
          ...storedProcedures,
          tags: tierTag,
        };

        await handleStoreProceduresUpdate(updatedDetails, 'tags');
      }
    },
    [storedProcedures, tags]
  );

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) =>
      isSoftDelete ? handleToggleDelete() : history.push('/'),
    []
  );

  useEffect(() => {
    if (storedProceduresFQN) {
      fetchResourcePermission();
    }
  }, [storedProceduresFQN]);

  useEffect(() => {
    if (
      storedProceduresPermissions.ViewAll ||
      storedProceduresPermissions.ViewBasic
    ) {
      fetchStoredProceduresDetails();
      // getEntityFeedCount();
    }
  }, [storedProceduresFQN, storedProceduresPermissions]);

  if (isLoading) {
    return <Loader />;
  }

  if (
    !(
      storedProceduresPermissions.ViewAll ||
      storedProceduresPermissions.ViewBasic
    )
  ) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  if (!storedProcedures) {
    return <ErrorPlaceHolder className="m-0" />;
  }

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle="storedProcedures details"
      title="storedProcedures details">
      <Row gutter={[0, 12]}>
        {/* Entity Heading */}
        <Col className="p-x-lg" data-testid="entity-page-header" span={24}>
          <DataAssetsHeader
            afterDeleteAction={afterDeleteAction}
            dataAsset={storedProcedures}
            entityType={EntityType.STORED_PROCEDURE}
            permissions={storedProceduresPermissions}
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
