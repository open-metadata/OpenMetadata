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

import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import { TabSpecificField } from '../../../enums/entity.enum';
import { Domain } from '../../../generated/entity/domains/domain';
import { Operation } from '../../../generated/entity/policies/policy';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useDomainStore } from '../../../hooks/useDomainStore';
import { useFqn } from '../../../hooks/useFqn';
import {
  addFollower,
  getDomainByName,
  patchDomains,
  removeFollower,
} from '../../../rest/domainAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { getDomainPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import '../domain.less';
import DomainDetails from '../DomainDetails/DomainDetails.component';

const DomainDetailPage = () => {
  const { fqn: domainFqn } = useFqn();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();
  const currentUserId = currentUser?.id ?? '';
  const { permissions } = usePermissionProvider();
  const { updateDomains } = useDomainStore();
  const [isMainContentLoading, setIsMainContentLoading] = useState(false);
  const [activeDomain, setActiveDomain] = useState<Domain>();
  const [isFollowingLoading, setIsFollowingLoading] = useState<boolean>(false);

  const { isFollowing } = useMemo(() => {
    return {
      isFollowing: activeDomain?.followers?.some(
        ({ id }) => id === currentUserId
      ),
    };
  }, [activeDomain?.followers, currentUserId]);

  const [viewBasicDomainPermission, viewAllDomainPermission] = useMemo(() => {
    return [
      checkPermission(Operation.ViewBasic, ResourceEntity.DOMAIN, permissions),
      checkPermission(Operation.ViewAll, ResourceEntity.DOMAIN, permissions),
    ];
  }, [permissions]);

  const handleDomainUpdate = async (updatedData: Domain) => {
    if (activeDomain) {
      const jsonPatch = compare(activeDomain, updatedData);
      try {
        const response = await patchDomains(activeDomain.id, jsonPatch);

        setActiveDomain(response);
        updateDomains([response], false);

        if (activeDomain?.name !== updatedData.name) {
          navigate(getDomainPath(response.fullyQualifiedName));
        }
      } catch (error) {
        showErrorToast(error as AxiosError);

        throw error as AxiosError;
      }
    }
  };

  const handleDomainDelete = () => {
    // Navigate back to domains listing page after deletion
    navigate(ROUTES.DOMAIN);
  };

  const fetchDomainByName = async (domainFqn: string) => {
    setIsMainContentLoading(true);
    try {
      const data = await getDomainByName(domainFqn, {
        fields: [
          TabSpecificField.CHILDREN,
          TabSpecificField.OWNERS,
          TabSpecificField.PARENT,
          TabSpecificField.EXPERTS,
          TabSpecificField.TAGS,
          TabSpecificField.FOLLOWERS,
          TabSpecificField.EXTENSION,
        ],
      });
      setActiveDomain(data);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.domain-lowercase'),
        })
      );
    } finally {
      setIsMainContentLoading(false);
    }
  };

  const followDomain = async () => {
    try {
      if (!activeDomain?.id) {
        return;
      }
      const res = await addFollower(activeDomain.id, currentUserId);
      const { newValue } = res.changeDescription.fieldsAdded[0];
      setActiveDomain(
        (prev) =>
          ({
            ...prev,
            followers: [...(prev?.followers ?? []), ...newValue],
          } as Domain)
      );
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(activeDomain),
        })
      );
    }
  };

  const unFollowDomain = async () => {
    try {
      if (!activeDomain?.id) {
        return;
      }
      const res = await removeFollower(activeDomain.id, currentUserId);
      const { oldValue } = res.changeDescription.fieldsDeleted[0];

      const filteredFollowers = activeDomain.followers?.filter(
        (follower) => follower.id !== oldValue[0].id
      );

      setActiveDomain(
        (prev) =>
          ({
            ...prev,
            followers: filteredFollowers ?? [],
          } as Domain)
      );
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: getEntityName(activeDomain),
        })
      );
    }
  };

  const handleFollowingClick = useCallback(async () => {
    setIsFollowingLoading(true);
    isFollowing ? await unFollowDomain() : await followDomain();
    setIsFollowingLoading(false);
  }, [isFollowing, unFollowDomain, followDomain]);

  useEffect(() => {
    if (domainFqn) {
      fetchDomainByName(domainFqn);
    }
  }, [domainFqn]);

  // If no domain FQN is provided, redirect to domains listing
  useEffect(() => {
    if (!domainFqn) {
      navigate(ROUTES.DOMAIN);
    }
  }, [domainFqn, navigate]);

  if (!(viewBasicDomainPermission || viewAllDomainPermission)) {
    return (
      <ErrorPlaceHolder
        className="mt-0-important"
        permissionValue={t('label.view-entity', {
          entity: t('label.domain'),
        })}
        size={SIZE.LARGE}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  if (isMainContentLoading) {
    return <Loader />;
  }

  if (!activeDomain) {
    return <ErrorPlaceHolder />;
  }

  return (
    <PageLayoutV1 pageTitle={getEntityName(activeDomain)}>
      <DomainDetails
        domain={activeDomain}
        handleFollowingClick={handleFollowingClick}
        isFollowing={isFollowing}
        isFollowingLoading={isFollowingLoading}
        onDelete={handleDomainDelete}
        onUpdate={handleDomainUpdate}
      />
    </PageLayoutV1>
  );
};

export default DomainDetailPage;
