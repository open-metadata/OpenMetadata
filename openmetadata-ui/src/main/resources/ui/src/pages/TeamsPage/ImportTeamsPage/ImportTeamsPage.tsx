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
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { EntityImport } from '../../../components/common/EntityImport/EntityImport.component';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import { TeamImportResult } from '../../../components/Settings/Team/TeamImportResult/TeamImportResult.component';
import { UserImportResult } from '../../../components/Settings/Team/UserImportResult/UserImportResult.component';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { Team, TeamType } from '../../../generated/entity/teams/team';
import { CSVImportResult } from '../../../generated/type/csvImportResult';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { useEntityPermissions } from '../../../hooks/useEntityPermissions/useEntityPermissions';
import { useFqn } from '../../../hooks/useFqn';
import {
  getTeamByName,
  importTeam,
  importUserInTeam,
} from '../../../rest/teamsAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getTeamsWithFqnPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { ImportType } from './ImportTeamsPage.interface';

const ImportTeamsPage = () => {
  const { fqn } = useFqn();
  const navigate = useNavigate();
  const location = useCustomLocation();
  const { t } = useTranslation();

  // Full fetch-owner conversion (TeamsPage.tsx / useTestSuiteDetailsPage.tsx precedent). No
  // `deleted` option — the old raw reads were never gated on the team's own `deleted` either.
  const {
    canCreate,
    canEditAll,
    isLoading: permissionsLoading,
    error: permissionsError,
  } = useEntityPermissions(ResourceEntity.TEAM, fqn);

  useEffect(() => {
    if (permissionsError) {
      showErrorToast(permissionsError as AxiosError);
    }
  }, [permissionsError]);

  const { type } = useMemo(() => {
    const param = location.search;
    const searchData = QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData as { type: ImportType };
  }, [location.search]);

  const [isPageLoading, setIsPageLoading] = useState<boolean>(true);
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

  const handleCsvImportResultUpdate = (result: CSVImportResult) => {
    setCsvImportResult(result);
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
      navigate({
        pathname: getTeamsWithFqnPath(team.fullyQualifiedName ?? team.name),
        search: QueryString.stringify({ activeTab: type }),
      });
    }
  };

  const handleImportCsv = async (name: string, data: string, dryRun = true) => {
    const api = type === ImportType.USERS ? importUserInTeam : importTeam;
    try {
      const response = await api(name, data, dryRun);

      return response;
    } catch (error) {
      showErrorToast(error as AxiosError);

      return;
    }
  };

  // Reactive replacement for the old fetchPermissions()-then-fetchTeamByFqn() sequence
  // (TeamsPage.tsx precedent): fetchTeamByFqn already manages isPageLoading internally via
  // its own try/finally, matching the granted-permission path exactly. The denied path needs
  // the separate effect below since nothing else would otherwise flip isPageLoading back to
  // false (also covers the old `!fqn` early-exit — with no fqn, useEntityPermissions never
  // fetches, so permissionsLoading resolves to `false` immediately with denied flags).
  useEffect(() => {
    if (canCreate || canEditAll) {
      fetchTeamByFqn(fqn);
    }
  }, [canCreate, canEditAll, fqn]);

  useEffect(() => {
    if (!permissionsLoading && !canCreate && !canEditAll) {
      setIsPageLoading(false);
    }
  }, [permissionsLoading, canCreate, canEditAll]);

  if (isPageLoading) {
    return <Loader />;
  }
  // it will fetch permission 1st, if its not allowed will show no permission placeholder
  if (!canCreate || !canEditAll) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.create-entity', {
          entity: t('label.import-entity', {
            entity:
              type === ImportType.USERS
                ? t('label.user-plural')
                : t('label.team-plural'),
          }),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
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
        className="import-teams w-full"
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
            onCsvResultUpdate={handleCsvImportResultUpdate}
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
