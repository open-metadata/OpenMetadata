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
import { noop, toString } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import { Domain } from '../../../generated/entity/domains/domain';
import { EntityHistory } from '../../../generated/type/entityHistory';
import { useFqn } from '../../../hooks/useFqn';
import {
  getDomainByName,
  getDomainVersionData,
  getDomainVersionsList,
} from '../../../rest/domainAPI';
import {
  getDomainPath,
  getDomainVersionsPath,
} from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import EntityVersionTimeLine from '../../Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import DomainDetailsPage from '../DomainDetailsPage/DomainDetailsPage.component';

const DomainVersion = () => {
  const navigate = useNavigate();
  const { version } = useRequiredParams<{ version: string }>();
  const { fqn } = useFqn();
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState<Domain>();
  const [versionList, setVersionList] = useState<EntityHistory>(
    {} as EntityHistory
  );
  const [selectedData, setSelectedData] = useState<Domain>();

  const { t } = useTranslation();

  const fetchVersionsInfo = useCallback(async () => {
    if (!domain) {
      return;
    }

    try {
      const res = await getDomainVersionsList(domain.id);
      setVersionList(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [domain]);

  const fetchActiveVersion = useCallback(async () => {
    if (!domain) {
      return;
    }
    setLoading(true);
    try {
      const res = await getDomainVersionData(domain.id, version);
      setSelectedData(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  }, [domain, version]);

  const fetchDomainData = useCallback(async () => {
    try {
      const res = await getDomainByName(fqn);
      setDomain(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [fqn]);

  const onVersionChange = (selectedVersion: string) => {
    const path = getDomainVersionsPath(fqn, selectedVersion);
    navigate(path);
  };

  const onBackHandler = () => {
    const path = getDomainPath(selectedData?.fullyQualifiedName);
    navigate(path);
  };

  const domainPageRender = useMemo(() => {
    if (loading) {
      return <Loader />;
    } else if (!selectedData) {
      return <ErrorPlaceHolder />;
    } else {
      return (
        <DomainDetailsPage
          isVersionsView
          domain={selectedData}
          onDelete={noop}
          onUpdate={() => Promise.resolve()}
        />
      );
    }
  }, [loading, selectedData]);

  useEffect(() => {
    fetchDomainData();
  }, [fqn]);

  useEffect(() => {
    fetchVersionsInfo();
  }, [domain]);

  useEffect(() => {
    fetchActiveVersion();
  }, [domain, version]);

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-version', { entity: t('label.domain') })}>
      <div className="version-data page-container p-0">{domainPageRender}</div>
      <EntityVersionTimeLine
        currentVersion={toString(version)}
        entityType={EntityType.DOMAIN}
        versionHandler={onVersionChange}
        versionList={versionList}
        onBack={onBackHandler}
      />
    </PageLayoutV1>
  );
};

export default DomainVersion;
