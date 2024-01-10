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
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/Loader/Loader';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../components/PermissionProvider/PermissionProvider.interface';
import { ROUTES } from '../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { Domain } from '../../generated/entity/domains/domain';
import { Operation } from '../../generated/entity/policies/policy';
import { getDomainByName, patchDomains } from '../../rest/domainAPI';
import { checkPermission } from '../../utils/PermissionsUtils';
import { getDomainPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './domain.less';
import DomainDetailsPage from './DomainDetailsPage/DomainDetailsPage.component';
import DomainsLeftPanel from './DomainLeftPanel/DomainLeftPanel.component';
import { useDomainProvider } from './DomainProvider/DomainProvider';

const DomainPage = () => {
  const { t } = useTranslation();
  const { fqn } = useParams<{ fqn: string }>();
  const history = useHistory();
  const { permissions } = usePermissionProvider();
  const { domains, refreshDomains, updateDomains, domainLoading } =
    useDomainProvider();
  const [isMainContentLoading, setIsMainContentLoading] = useState(true);
  const [activeDomain, setActiveDomain] = useState<Domain>();
  const domainFqn = fqn ? decodeURIComponent(fqn) : null;

  const createDomainPermission = useMemo(
    () => checkPermission(Operation.Create, ResourceEntity.DOMAIN, permissions),
    [permissions]
  );

  const viewBasicDomainPermission = useMemo(
    () =>
      checkPermission(Operation.ViewBasic, ResourceEntity.DOMAIN, permissions),
    [permissions]
  );

  const viewAllDomainPermission = useMemo(
    () =>
      checkPermission(Operation.ViewAll, ResourceEntity.DOMAIN, permissions),
    [permissions]
  );

  const handleAddDomainClick = () => {
    history.push(ROUTES.ADD_DOMAIN);
  };

  const handleDomainUpdate = async (updatedData: Domain) => {
    if (activeDomain) {
      const jsonPatch = compare(activeDomain, updatedData);
      try {
        const response = await patchDomains(activeDomain.id, jsonPatch);

        setActiveDomain(response);

        const updatedDomains = domains.map((item) => {
          if (item.name === response.name) {
            return response;
          } else {
            return item;
          }
        });

        updateDomains(updatedDomains);

        if (activeDomain?.name !== updatedData.name) {
          history.push(getDomainPath(response.fullyQualifiedName));
          refreshDomains();
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };

  const handleDomainDelete = (id: string) => {
    const updatedDomains = domains.find((item) => item.id !== id);
    const domainPath = updatedDomains
      ? getDomainPath(updatedDomains.fullyQualifiedName)
      : getDomainPath();

    refreshDomains();
    history.push(domainPath);
  };

  const fetchDomainByName = async (fqn: string) => {
    setIsMainContentLoading(true);
    try {
      const data = await getDomainByName(encodeURIComponent(fqn), {
        fields: 'children,owner,parent,experts',
      });
      setActiveDomain(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsMainContentLoading(false);
    }
  };

  const domainPageRender = useMemo(() => {
    if (isMainContentLoading) {
      return <Loader />;
    } else if (!activeDomain) {
      return <ErrorPlaceHolder />;
    } else {
      return (
        <DomainDetailsPage
          domain={activeDomain}
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
  ]);

  useEffect(() => {
    if (domainFqn && domains.length > 0) {
      fetchDomainByName(domainFqn);
    }
  }, [domainFqn, domains]);

  useEffect(() => {
    if (domains.length > 0 && !domainFqn && !domainLoading) {
      history.push(getDomainPath(domains[0].fullyQualifiedName));
    }
  }, [domains, domainFqn]);

  if (domainLoading) {
    return <Loader />;
  }

  if (!(viewBasicDomainPermission || viewAllDomainPermission)) {
    return (
      <ErrorPlaceHolder
        className="mt-0-important"
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  if (isEmpty(domains)) {
    return (
      <ErrorPlaceHolder
        buttonId="add-domain"
        className="mt-0-important"
        heading={t('label.domain')}
        permission={createDomainPermission}
        type={
          createDomainPermission
            ? ERROR_PLACEHOLDER_TYPE.CREATE
            : ERROR_PLACEHOLDER_TYPE.CUSTOM
        }
        onClick={handleAddDomainClick}>
        {t('message.domains-not-configured')}
      </ErrorPlaceHolder>
    );
  }

  return (
    <PageLayoutV1
      className="domain-parent-page-layout"
      leftPanel={<DomainsLeftPanel domains={domains} />}
      pageTitle={t('label.domain')}>
      {domainPageRender}
    </PageLayoutV1>
  );
};

export default DomainPage;
