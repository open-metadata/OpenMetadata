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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { ES_MAX_PAGE_SIZE, ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../enums/common.enum';
import { TabSpecificField } from '../../enums/entity.enum';
import { Domain } from '../../generated/entity/domains/domain';
import { Operation } from '../../generated/entity/policies/policy';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useDomainStore } from '../../hooks/useDomainStore';
import { useFqn } from '../../hooks/useFqn';
import {
  getDomainByName,
  getDomainList,
  patchDomains,
} from '../../rest/domainAPI';
import i18n from '../../utils/i18next/LocalUtil';
import { checkPermission } from '../../utils/PermissionsUtils';
import { getDomainPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import Loader from '../common/Loader/Loader';
import ResizableLeftPanels from '../common/ResizablePanels/ResizableLeftPanels';
import './domain.less';
import DomainDetailsPage from './DomainDetailsPage/DomainDetailsPage.component';
import DomainsLeftPanel from './DomainLeftPanel/DomainLeftPanel.component';

const DomainPage = () => {
  const { fqn: domainFqn } = useFqn();
  const { t } = useTranslation();
  const history = useHistory();
  const { permissions } = usePermissionProvider();
  const { domains, updateDomains, domainLoading, updateDomainLoading } =
    useDomainStore();
  const [isMainContentLoading, setIsMainContentLoading] = useState(false);
  const [activeDomain, setActiveDomain] = useState<Domain>();

  const rootDomains = useMemo(() => {
    return domains.filter((domain) => domain.parent == null);
  }, [domains]);

  const refreshDomains = useCallback(async () => {
    try {
      updateDomainLoading(true);
      const { data } = await getDomainList({
        limit: ES_MAX_PAGE_SIZE,
        fields: 'parent',
      });
      updateDomains(data);
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
    history.push(ROUTES.ADD_DOMAIN);
  }, [history]);

  const handleDomainUpdate = async (updatedData: Domain) => {
    if (activeDomain) {
      const jsonPatch = compare(activeDomain, updatedData);
      try {
        const response = await patchDomains(activeDomain.id, jsonPatch);

        setActiveDomain(response);

        const updatedDomains = rootDomains.map((item) => {
          if (item.name === response.name) {
            return response;
          } else {
            return item;
          }
        });

        updateDomains(updatedDomains, false);

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
    const updatedDomains = rootDomains.find((item) => item.id !== id);
    const domainPath = updatedDomains
      ? getDomainPath(updatedDomains.fullyQualifiedName)
      : getDomainPath();

    refreshDomains();
    history.push(domainPath);
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
        ],
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
    if (domainFqn) {
      fetchDomainByName(domainFqn);
    }
  }, [domainFqn]);

  useEffect(() => {
    if (rootDomains.length > 0 && !domainFqn && !domainLoading) {
      history.push(getDomainPath(rootDomains[0].fullyQualifiedName));
    }
  }, [rootDomains, domainFqn]);

  if (domainLoading) {
    return <Loader />;
  }

  if (!(viewBasicDomainPermission || viewAllDomainPermission)) {
    return (
      <div className="d-flex justify-center items-center full-height">
        <ErrorPlaceHolder
          className="mt-0-important border-none"
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
    <div>
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
          className: 'content-resizable-panel-container p-t-sm',
          minWidth: 800,
          flex: 0.87,
        }}
      />
    </div>
  );
};

export default withPageLayout(i18n.t('label.domain'))(DomainPage);
