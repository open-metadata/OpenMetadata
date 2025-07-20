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
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { ES_MAX_PAGE_SIZE, ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';

import Loader from '../../components/common/Loader/Loader';
import ResizableLeftPanels from '../../components/common/ResizablePanels/ResizableLeftPanels';
import DomainDetailsPage from '../../components/Domain/DomainDetailsPage/DomainDetailsPage.component';
import DomainsLeftPanel from '../../components/Domain/DomainLeftPanel/DomainLeftPanel.component';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../enums/common.enum';
import { TabSpecificField } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { Domain } from '../../generated/entity/domains/domain';
import { Operation } from '../../generated/entity/policies/policy';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useDomainStore } from '../../hooks/useDomainStore';
import { useFqn } from '../../hooks/useFqn';
import {
  addFollower,
  getDomainByName,
  patchDomains,
  removeFollower,
} from '../../rest/domainAPI';
import { searchQuery } from '../../rest/searchAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { checkPermission } from '../../utils/PermissionsUtils';
import { getDomainPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './domain.less';

const DomainPage = () => {
  const { fqn: domainFqn } = useFqn();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();
  const currentUserId = currentUser?.id ?? '';
  const { permissions } = usePermissionProvider();
  const { domains, updateDomains, domainLoading, updateDomainLoading } =
    useDomainStore();
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

  const rootDomains = useMemo(() => {
    return domains.filter((domain) => domain.parent == null);
  }, [domains]);

  const refreshDomains = useCallback(async () => {
    try {
      updateDomainLoading(true);

      const response = await searchQuery({
        query: '',
        pageNumber: 1,
        pageSize: ES_MAX_PAGE_SIZE,
        searchIndex: SearchIndex.DOMAIN,
        includeDeleted: false,
        trackTotalHits: true,
        fetchSource: true,
      });

      const domainsFromSearch = response.hits.hits.map(
        (hit: { _source: Domain }) => hit._source
      );

      updateDomains(domainsFromSearch);
    } catch {
      // silent fail
    } finally {
      updateDomainLoading(false);
    }
  }, []);

  const [
    createDomainPermission,
    viewBasicDomainPermission,
    viewAllDomainPermission,
  ] = useMemo(() => {
    return [
      checkPermission(Operation.Create, ResourceEntity.DOMAIN, permissions),
      checkPermission(Operation.ViewBasic, ResourceEntity.DOMAIN, permissions),
      checkPermission(Operation.ViewAll, ResourceEntity.DOMAIN, permissions),
    ];
  }, [permissions]);

  const handleAddDomainClick = useCallback(() => {
    navigate(ROUTES.ADD_DOMAIN);
  }, [navigate]);

  const handleDomainUpdate = async (updatedData: Domain) => {
    if (activeDomain) {
      const jsonPatch = compare(activeDomain, updatedData);
      try {
        const response = await patchDomains(activeDomain.id, jsonPatch);

        setActiveDomain(response);

        const updatedDomains = rootDomains.map((item: Domain) => {
          if (item.name === response.name) {
            return response;
          } else {
            return item;
          }
        });

        updateDomains(updatedDomains, false);

        if (activeDomain?.name !== updatedData.name) {
          navigate(getDomainPath(response.fullyQualifiedName));
          refreshDomains();
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };

  const handleDomainDelete = (id: string) => {
    const updatedDomains = rootDomains.find((item) => item.id !== id);
    const domainPath = updatedDomains
      ? getDomainPath(updatedDomains.fullyQualifiedName)
      : getDomainPath();

    refreshDomains();
    navigate(domainPath);
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

  const domainPageRender = useMemo(() => {
    if (isMainContentLoading) {
      return <Loader />;
    } else if (!activeDomain) {
      return <ErrorPlaceHolder />;
    } else {
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
    }
  }, [
    isMainContentLoading,
    activeDomain,
    handleDomainUpdate,
    handleDomainDelete,
    isFollowing,
    isFollowingLoading,
    handleFollowingClick,
  ]);

  useEffect(() => {
    if (domainFqn) {
      fetchDomainByName(domainFqn);
    }
  }, [domainFqn]);

  if (domainLoading) {
    return <Loader />;
  }

  if (!(viewBasicDomainPermission || viewAllDomainPermission)) {
    return (
      <div className="d-flex justify-center items-center full-height">
        <ErrorPlaceHolder
          className="mt-0-important border-none"
          permissionValue={t('label.view-entity', {
            entity: t('label.domain'),
          })}
          size={SIZE.X_LARGE}
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
        />
      </div>
    );
  }

  if (isEmpty(rootDomains)) {
    return (
      <div className="d-flex justify-center items-center full-height">
        <ErrorPlaceHolder
          buttonId="add-domain"
          className="mt-0-important border-none"
          heading={t('label.domain')}
          permission={createDomainPermission}
          permissionValue={
            createDomainPermission
              ? t('label.create-entity', {
                  entity: t('label.domain'),
                })
              : ''
          }
          size={SIZE.X_LARGE}
          type={
            createDomainPermission
              ? ERROR_PLACEHOLDER_TYPE.CREATE
              : ERROR_PLACEHOLDER_TYPE.CUSTOM
          }
          onClick={handleAddDomainClick}>
          {t('message.domains-not-configured')}
        </ErrorPlaceHolder>
      </div>
    );
  }

  return (
    <ResizableLeftPanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container',
        minWidth: 280,
        flex: 0.13,
        title: t('label.domain-plural'),
        children: <DomainsLeftPanel domains={rootDomains} />,
      }}
      pageTitle={t('label.domain')}
      secondPanel={{
        children: domainPageRender,
        className: 'content-resizable-panel-container',
        minWidth: 800,
        flex: 0.87,
      }}
    />
  );
};

export default withPageLayout(DomainPage);
