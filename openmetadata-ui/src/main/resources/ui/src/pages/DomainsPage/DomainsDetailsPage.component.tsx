/*
 *  Copyright 2024 Collate.
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
import { useNavigate, useParams } from 'react-router-dom';
import DomainDetailsPage from '../../components/Domain/DomainDetailsPage/DomainDetailsPage.component';
import { EntityTabs, TabSpecificField } from '../../enums/entity.enum';
import { Domain } from '../../generated/entity/domains/domain';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import {
  addFollower,
  getDomainByName,
  patchDomains,
  removeFollower,
} from '../../rest/domainAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { getDomainPath, getDomainsDetailsPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const DomainsDetailsPage = () => {
  const { fqn: domainFqn } = useFqn();
  const { tab } = useParams<{ tab?: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();
  const currentUserId = currentUser?.id ?? '';
  const [isMainContentLoading, setIsMainContentLoading] = useState(false);
  const [activeDomain, setActiveDomain] = useState<Domain>();
  const [isFollowingLoading, setIsFollowingLoading] = useState<boolean>(false);

  // Redirect to documentation tab if no tab is specified
  useEffect(() => {
    if (domainFqn && !tab) {
      navigate(getDomainsDetailsPath(domainFqn, EntityTabs.DOCUMENTATION), {
        replace: true,
      });
    }
  }, [domainFqn, tab, navigate]);

  const { isFollowing } = useMemo(() => {
    return {
      isFollowing: activeDomain?.followers?.some(
        ({ id }) => id === currentUserId
      ),
    };
  }, [activeDomain?.followers, currentUserId]);

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

  const handleDomainUpdate = async (updatedData: Domain) => {
    if (activeDomain) {
      const jsonPatch = compare(activeDomain, updatedData);
      try {
        const response = await patchDomains(activeDomain.id, jsonPatch);
        setActiveDomain(response);

        if (activeDomain?.name !== updatedData.name) {
          navigate(getDomainPath(response.fullyQualifiedName));
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };

  const handleDomainDelete = (_id: string) => {
    navigate(getDomainPath());
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

  if (isMainContentLoading || !activeDomain) {
    return null;
  }

  return (
    <DomainDetailsPage
      domain={activeDomain}
      handleFollowingClick={handleFollowingClick}
      isFollowing={isFollowing}
      isFollowingLoading={isFollowingLoading}
      onDelete={handleDomainDelete}
      onUpdate={handleDomainUpdate}
    />
  );
};

export default withPageLayout(DomainsDetailsPage);
