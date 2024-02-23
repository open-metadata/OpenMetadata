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
import { Col, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import QueryString from 'qs';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation } from 'react-router-dom';
import { EntityImport } from '../../../components/common/EntityImport/EntityImport.component';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import { TeamImportResult } from '../../../components/Settings/Team/TeamImportResult/TeamImportResult.component';
import { UserImportResult } from '../../../components/Settings/Team/UserImportResult/UserImportResult.component';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { Team, TeamType } from '../../../generated/entity/teams/team';
import { CSVImportResult } from '../../../generated/type/csvImportResult';
import { useFqn } from '../../../hooks/useFqn';
import {
  getTeamByName,
  importTeam,
  importUserInTeam,
} from '../../../rest/teamsAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { getTeamsWithFqnPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { ImportType } from './ImportTeamsPage.interface';

const ImportTeamsPage = () => {
  const { fqn } = useFqn();
  const history = useHistory();
  const location = useLocation();
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const { type } = useMemo(() => {
    const param = location.search;
    const searchData = QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData as { type: ImportType };
  }, [location.search]);

  const [isPageLoading, setIsPageLoading] = useState<boolean>(true);
  const [permission, setPermission] = useState<OperationPermission>();
  const [csvImportResult, setCsvImportResult] = useState<CSVImportResult>();
  const [team, setTeam] = useState<Team>();

  const breadcrumb: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      team
        ? [
            {
              name: getEntityName(team),
              url: getTeamsWithFqnPath(team.fullyQualifiedName ?? team.name),
            },
          ]
        : [],
    [team]
  );

  const importResult = useMemo(() => {
    if (isUndefined(csvImportResult)) {
      return <></>;
    }

    if (type === ImportType.USERS) {
      return <UserImportResult csvImportResult={csvImportResult} />;
    }

    return <TeamImportResult csvImportResult={csvImportResult} />;
  }, [csvImportResult, type]);

  const fetchPermissions = async (entityFqn: string) => {
    setIsPageLoading(true);
    try {
      const perms = await getEntityPermissionByFqn(
        ResourceEntity.TEAM,
        entityFqn
      );
      setPermission(perms);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsPageLoading(false);
    }
  };
  const fetchTeamByFqn = async (name: string) => {
    setIsPageLoading(true);
    try {
      const data = await getTeamByName(name);

      setTeam(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsPageLoading(false);
    }
  };

  const handleViewClick = () => {
    if (team) {
      history.push({
        pathname: getTeamsWithFqnPath(team.fullyQualifiedName ?? team.name),
        search: QueryString.stringify({ activeTab: type }),
      });
    }
  };

  const handleImportCsv = async (name: string, data: string, dryRun = true) => {
    const api = type === ImportType.USERS ? importUserInTeam : importTeam;
    try {
      const response = await api(name, data, dryRun);
      setCsvImportResult(response);

      return response;
    } catch (error) {
      showErrorToast(error as AxiosError);

      return;
    }
  };

  useEffect(() => {
    if (fqn) {
      fetchPermissions(fqn);
    } else {
      setIsPageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (permission?.Create || permission?.EditAll) {
      fetchTeamByFqn(fqn);
    }
  }, [permission]);

  if (isPageLoading) {
    return <Loader />;
  }
  // it will fetch permission 1st, if its not allowed will show no permission placeholder
  if (!permission?.Create || !permission?.EditAll) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  if (isUndefined(team)) {
    return <ErrorPlaceHolder />;
  }

  if (team.teamType === TeamType.Group && type === ImportType.TEAMS) {
    return (
      <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
        <div className="m-t-sm text-center text-sm font-normal">
          <Typography.Paragraph className="w-80">
            {t('message.group-type-team-not-allowed-to-have-sub-team')}
          </Typography.Paragraph>
        </div>
      </ErrorPlaceHolder>
    );
  }

  return (
    <PageLayoutV1
      pageTitle={t('label.import-entity', {
        entity:
          type === ImportType.USERS
            ? t('label.user-plural')
            : t('label.team-plural'),
      })}>
      <Row
        className="import-teams w-full page-container"
        data-testid="import-teams"
        gutter={[16, 8]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumb} />
        </Col>
        <Col span={24}>
          <Typography.Title data-testid="title" level={5}>
            {t('label.import-entity', {
              entity:
                type === ImportType.USERS
                  ? t('label.user-plural')
                  : t('label.team-plural'),
            })}
          </Typography.Title>
        </Col>
        <Col span={24}>
          <EntityImport
            entityName={team.name}
            onCancel={handleViewClick}
            onImport={handleImportCsv}
            onSuccess={handleViewClick}>
            {importResult}
          </EntityImport>
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default ImportTeamsPage;
