/*
 *  Copyright 2022 Collate.
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

import { Button, Col, Row, Space, Switch, Tooltip } from 'antd';
import { AxiosError } from 'axios';
import React, { FC, useEffect, useMemo, useState } from 'react';
import {
  NO_PERMISSION_FOR_ACTION,
  NO_PERMISSION_TO_VIEW,
} from '../../constants/HelperTextUtil';
import { Team } from '../../generated/entity/teams/team';
import jsonData from '../../jsons/en';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../PermissionProvider/PermissionProvider.interface';
import TeamHierarchy from './TeamHierarchy';
import './teams.less';

interface TeamsProps {
  showDeletedTeam: boolean;
  onShowDeletedTeamChange: (checked: boolean) => void;
  data: Team[];
  onAddTeamClick: (value: boolean) => void;
  onTeamExpand: (
    loading?: boolean,
    parentTeam?: string,
    updateChildNode?: boolean
  ) => void;
}

const Teams: FC<TeamsProps> = ({
  data,
  showDeletedTeam,
  onShowDeletedTeamChange,
  onAddTeamClick,
  onTeamExpand,
}) => {
  const { getResourcePermission } = usePermissionProvider();
  const [resourcePermissions, setResourcePermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const filteredData = useMemo(
    () =>
      data.filter(
        (d) =>
          (showDeletedTeam && d.deleted) || (!showDeletedTeam && !d.deleted)
      ),
    [data, showDeletedTeam]
  );

  const fetchPermissions = async () => {
    try {
      const perms = await getResourcePermission(ResourceEntity.TEAM);
      setResourcePermissions(perms);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['fetch-user-permission-error']
      );
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  return resourcePermissions.ViewAll || resourcePermissions.ViewBasic ? (
    <Row className="team-list-container" gutter={[16, 16]}>
      <Col span={24}>
        <Space align="center" className="tw-w-full tw-justify-end" size={16}>
          <Space align="end" size={5}>
            <Switch
              checked={showDeletedTeam}
              size="small"
              onClick={onShowDeletedTeamChange}
            />
            <span>Deleted Teams</span>
          </Space>
          <Tooltip
            placement="bottom"
            title={
              resourcePermissions.Create ? 'Add Team' : NO_PERMISSION_FOR_ACTION
            }>
            <Button
              disabled={!resourcePermissions.Create}
              type="primary"
              onClick={() => onAddTeamClick(true)}>
              Add Team
            </Button>
          </Tooltip>
        </Space>
      </Col>
      <Col span={24}>
        <TeamHierarchy data={filteredData} onTeamExpand={onTeamExpand} />
      </Col>
    </Row>
  ) : (
    <Row align="middle" className="tw-h-full">
      <Col span={24}>
        <ErrorPlaceHolder>
          <p>{NO_PERMISSION_TO_VIEW}</p>
        </ErrorPlaceHolder>
      </Col>
    </Row>
  );
};

export default Teams;
