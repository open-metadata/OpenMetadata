/*
 *  Copyright 2021 Collate
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

import { Button, Col, Empty, Row, Space, Switch } from 'antd';
import React, { useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import BotListV1 from '../../components/BotListV1/BotListV1.component';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import { getCreateUserPath } from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import { getPermissions } from '../../utils/PermissionsUtils';

export const BotsPageV1 = () => {
  const { permissions } = usePermissionProvider();
  const history = useHistory();
  const [showDeleted, setShowDeleted] = useState(false);

  const handleAddBotClick = () => {
    history.push(getCreateUserPath(true));
  };

  const handleShowDeleted = (checked: boolean) => {
    setShowDeleted(checked);
  };

  const botPermissions = useMemo(
    () => getPermissions(EntityType.BOT, permissions),
    [permissions]
  );

  return (
    <Row gutter={[16, 16]}>
      {botPermissions.ViewAll ? (
        <>
          <Col flex={1} />
          <Col>
            <Space size={16}>
              <Space align="end" size={5}>
                <Switch
                  checked={showDeleted}
                  id="switch-deleted"
                  size="small"
                  onClick={handleShowDeleted}
                />
                <label htmlFor="switch-deleted">Show deleted</label>
              </Space>

              {botPermissions.Create && (
                <Button type="primary" onClick={handleAddBotClick}>
                  Add Bot
                </Button>
              )}
            </Space>
          </Col>
          <Col span={24}>
            <BotListV1 permissions={botPermissions} showDeleted={showDeleted} />
          </Col>
        </>
      ) : (
        <Empty description="You do not have permission to view data" />
      )}
    </Row>
  );
};

export default BotsPageV1;
