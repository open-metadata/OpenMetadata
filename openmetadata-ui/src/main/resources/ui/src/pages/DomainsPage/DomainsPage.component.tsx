/*
 *  Copyright 2025 Collate.
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
import { Key, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb.component';
import EntityTable from '../../components/common/EntityTable/EntityTable.component';
import { EntityTableFilters } from '../../components/common/EntityTable/EntityTable.interface';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import HeaderCard from '../../components/common/HeaderCard/HeaderCard.component';
import AddEntityFormV2 from '../../components/Domains/AddEntityForm/AddEntityForm.component';
import { ES_MAX_PAGE_SIZE, ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../enums/common.enum';
import { TabSpecificField } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { CreateDataProduct } from '../../generated/api/domains/createDataProduct';
import { CreateDomain } from '../../generated/api/domains/createDomain';
import { Domain } from '../../generated/entity/domains/domain';
import { Operation } from '../../generated/entity/policies/policy';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useDomainStore } from '../../hooks/useDomainStore';
import { useDynamicEntitySearch } from '../../hooks/useDynamicEntitySearch';
import { useFqn } from '../../hooks/useFqn';
import {
  addDomains,
  getDomainByName,
  patchDomains,
} from '../../rest/domainAPI';
import { searchQuery } from '../../rest/searchAPI';
import { createFormConfig } from '../../utils/AddEntityFormUtils';
import { checkPermission } from '../../utils/PermissionsUtils';
import { getDomainsPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

import './domains-page.less';

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
  const [isAddDomainPanelOpen, setIsAddDomainPanelOpen] = useState(false);
  const [isDomainFormLoading, setIsDomainFormLoading] = useState(false);

  // Use dynamic search hook for handling search and filtering
  const {
    data: searchResults,
    loading: searchLoading,
    total,
    searchTerm,
    filters,
    setSearchTerm,
    setFilters,
    refetch,
  } = useDynamicEntitySearch<Domain>({
    searchIndex: SearchIndex.DOMAIN,
    pageSize: ES_MAX_PAGE_SIZE,
    enableFilters: true,
    enableSearch: true,
  });

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

      // Also refetch search results to keep them in sync
      refetch();
    } catch {
      // silent fail
    } finally {
      updateDomainLoading(false);
    }
  }, [updateDomains, updateDomainLoading, refetch]);

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
    setIsAddDomainPanelOpen(true);
  }, []);

  const handleAddDomainPanelClose = useCallback(() => {
    setIsAddDomainPanelOpen(false);
  }, []);

  const handleDomainSave = useCallback(
    async (values: CreateDomain | CreateDataProduct) => {
      setIsDomainFormLoading(true);
      try {
        // Create new domain using addDomains API
        await addDomains(values as CreateDomain);

        // Close the panel after successful creation
        setIsAddDomainPanelOpen(false);

        // Refresh domains list to show the new domain
        await refreshDomains();
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsDomainFormLoading(false);
      }
    },
    [refreshDomains]
  );

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
          navigate(getDomainsPath(response.fullyQualifiedName));
          refreshDomains();
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };

  const handleDomainDelete = async (id: string) => {
    try {
      // TODO: Implement actual delete API call
      // eslint-disable-next-line no-console
      console.log('Delete domain:', id);
      await refreshDomains();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleBulkDomainDelete = async (ids: Key[]) => {
    try {
      // TODO: Implement actual bulk delete API calls
      // eslint-disable-next-line no-console
      console.log('Bulk delete domains:', ids);
      await refreshDomains();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  // Handle search term changes from EntityTable
  const handleSearchChange = useCallback(
    (newSearchTerm: string) => {
      setSearchTerm(newSearchTerm);
    },
    [setSearchTerm]
  );

  // Handle filter changes from EntityTable
  const handleFiltersUpdate = useCallback(
    (newFilters: EntityTableFilters) => {
      setFilters(newFilters);
    },
    [setFilters]
  );

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

  useEffect(() => {
    if (domainFqn) {
      fetchDomainByName(domainFqn);
    }
  }, [domainFqn]);

  // Breadcrumb items for the domains page
  const breadcrumbItems = useMemo(
    () => [
      {
        name: t('label.domain-plural'),
        url: ROUTES.DOMAINS,
      },
    ],
    [t]
  );

  // Load domains when component mounts
  useEffect(() => {
    refreshDomains();
  }, [refreshDomains]);

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

  if (isEmpty(rootDomains) && !searchLoading) {
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
    <div className="domains-page-container">
      <Breadcrumb titleLinks={breadcrumbItems} />
      <HeaderCard
        addLabel={t('label.add-entity', {
          entity: t('label.domain'),
        })}
        description="Test description"
        disabled={!createDomainPermission}
        title={t('label.domain-plural')}
        onAdd={handleAddDomainClick}
      />
      <EntityTable
        data={searchResults}
        filters={filters}
        loading={searchLoading || domainLoading}
        searchIndex={SearchIndex.DOMAIN}
        searchTerm={searchTerm}
        total={total}
        type="domains"
        onBulkDelete={handleBulkDomainDelete}
        onDelete={handleDomainDelete}
        onFiltersUpdate={handleFiltersUpdate}
        onSearchChange={handleSearchChange}
      />
      <AddEntityFormV2<CreateDomain>
        config={createFormConfig.domain({
          onSubmit: handleDomainSave,
        })}
        loading={isDomainFormLoading}
        open={isAddDomainPanelOpen}
        onClose={handleAddDomainPanelClose}
      />
    </div>
  );
};

export default withPageLayout(DomainPage);
