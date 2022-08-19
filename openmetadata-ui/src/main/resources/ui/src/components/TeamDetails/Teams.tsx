/*
 *  Copyright 2022 Collate
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

import { Button, Col, Row, Space, Switch } from 'antd';
import React, { FC } from 'react';
import { Team } from '../../generated/entity/teams/team';
import TeamHierarchy from './TeamHierarchy';
import './teams.less';

interface TeamsProps {
  showDeletedTeam: boolean;
  onShowDeletedTeamChange: (checked: boolean) => void;
  data: Team[];
  onAddTeamClick: (value: boolean) => void;
  onTeamExpand: (
    isPageLoading?: boolean,
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
  return (
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
          <Button type="primary" onClick={() => onAddTeamClick(true)}>
            Add Team
          </Button>
        </Space>
      </Col>
      <Col span={24}>
        <TeamHierarchy data={data} onTeamExpand={onTeamExpand} />
      </Col>
    </Row>
  );
};

export default Teams;
