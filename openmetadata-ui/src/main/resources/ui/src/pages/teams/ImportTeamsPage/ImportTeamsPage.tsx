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
import { EntityImport } from 'components/common/EntityImport/EntityImport.component';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import { TeamImportResult } from 'components/TeamImportResult/TeamImportResult.component';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { Team } from 'generated/entity/teams/team';
import { CSVImportResult } from 'generated/type/csvImportResult';
import { isUndefined } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getTeamByName, importTeam } from 'rest/teamsAPI';
import { getEntityName } from 'utils/EntityUtils';
import { getTeamsWithFqnPath } from 'utils/RouterUtils';
import { showErrorToast } from 'utils/ToastUtils';

const ImportTeamsPage = () => {
  const { fqn } = useParams<{ fqn: string }>();
  const history = useHistory();
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();

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
      history.push(getTeamsWithFqnPath(team.fullyQualifiedName ?? team.name));
    }
  };

  const handleImportCsv = async (name: string, data: string, dryRun = true) => {
    try {
      const response = await importTeam(name, data, dryRun);
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
    if (permission?.Create) {
      fetchTeamByFqn(fqn);
    }
  }, [permission]);

  if (isPageLoading) {
    return <Loader />;
  }

  if (isUndefined(team)) {
    return <ErrorPlaceHolder />;
  }

  if (!permission?.Create) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <Row
      className="import-teams w-full"
      data-testid="import-teams"
      gutter={[16, 8]}>
      <Col span={24}>
        <TitleBreadcrumb titleLinks={breadcrumb} />
      </Col>
      <Col span={24}>
        <Typography.Title data-testid="title" level={5}>
          {t('label.import-entity', {
            entity: t('label.team-plural'),
          })}
        </Typography.Title>
      </Col>
      <Col span={24}>
        <EntityImport
          entityName={team.name}
          onCancel={handleViewClick}
          onImport={handleImportCsv}
          onSuccess={handleViewClick}>
          {csvImportResult ? (
            <TeamImportResult csvImportResult={csvImportResult} />
          ) : (
            <></>
          )}
        </EntityImport>
      </Col>
    </Row>
  );
};

export default ImportTeamsPage;
