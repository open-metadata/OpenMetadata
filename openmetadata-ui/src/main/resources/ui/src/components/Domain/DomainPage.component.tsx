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

import PageLayoutV1 from 'components/containers/PageLayoutV1';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DomainsLeftPanel from './DomainLeftPanel/DomainLeftPanel.component';

import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import { PAGE_SIZE_LARGE, ROUTES } from 'constants/constants';
import { GLOSSARIES_DOCS } from 'constants/docs.constants';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { Domain } from 'generated/entity/domains/domain';
import { Operation } from 'generated/entity/policies/policy';
import { useHistory, useParams } from 'react-router-dom';
import { getDomainByName, getDomainList } from 'rest/domainAPI';
import { checkPermission } from 'utils/PermissionsUtils';
import { getDecodedFqn } from 'utils/StringsUtils';
import { showErrorToast } from 'utils/ToastUtils';
import DomainDetailsPage from './DomainDetailsPage/DomainDetailsPage.component';

const DomainPage = () => {
  const { t } = useTranslation();
  const { fqn } = useParams<{ fqn: string }>();
  const history = useHistory();
  const { permissions } = usePermissionProvider();
  const [isLoading, setIsLoading] = useState(true);
  const [isMainContentLoading, setIsMainContentLoading] = useState(true);
  const [domains, setDomains] = useState<Domain[]>([]);
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

  const fetchDomainList = async () => {
    setIsLoading(true);
    try {
      const { data } = await getDomainList({
        limit: PAGE_SIZE_LARGE,
      });
      setDomains(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDomainByName = async (fqn: string) => {
    setIsMainContentLoading(true);
    try {
      const data = await getDomainByName(fqn, 'children,owner,parent,experts');
      setActiveDomain(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsMainContentLoading(false);
    }
  };

  useEffect(() => {
    fetchDomainList();
  }, []);

  useEffect(() => {
    if (domainFqn) {
      fetchDomainByName(getDecodedFqn(domainFqn));
    }
  }, [domainFqn]);

  if (isLoading) {
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

  if (domains.length === 0 && !isLoading) {
    return (
      <ErrorPlaceHolder
        buttonId="add-domain"
        className="mt-0-important"
        doc={GLOSSARIES_DOCS} // Need to replace with domain docs
        heading={t('label.domain')}
        permission={createDomainPermission}
        type={
          createDomainPermission
            ? ERROR_PLACEHOLDER_TYPE.CREATE
            : ERROR_PLACEHOLDER_TYPE.NO_DATA
        }
        onClick={handleAddDomainClick}
      />
    );
  }

  return (
    <PageLayoutV1
      className="glossary-page-layout"
      leftPanel={<DomainsLeftPanel domains={domains} />}
      pageTitle={t('label.glossary')}>
      {activeDomain && (
        <DomainDetailsPage
          domain={activeDomain}
          loading={isMainContentLoading}
        />
      )}
    </PageLayoutV1>
  );
};

export default DomainPage;
