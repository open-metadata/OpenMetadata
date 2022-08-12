import { Button, Col, Row, Space, Switch } from 'antd';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { BotListV1 } from '../../components/BotListV1/BotListV1.component';
import { getCreateUserPath } from '../../constants/constants';

export const BotsPageV1 = () => {
  const history = useHistory();
  const [showDeleted, setShowDeleted] = useState(false);

  const handleAddBotClick = () => {
    history.push(getCreateUserPath(true));
  };

  const handleShowDeleted = (checked: boolean) => {
    setShowDeleted(checked);
  };

  return (
    <Row gutter={[16, 16]}>
      <Col flex={1} />
      <Col>
        <Space size={24}>
          <Space align="center">
            <Switch
              checked={showDeleted}
              id="switch-deleted"
              onClick={handleShowDeleted}
            />
            <label htmlFor="switch-deleted">Show deleted</label>
          </Space>
          <Button type="primary" onClick={handleAddBotClick}>
            Add Bot
          </Button>
        </Space>
      </Col>
      <Col span={24}>
        <BotListV1 showDeleted={showDeleted} />
      </Col>
    </Row>
  );
};

export default BotsPageV1;
