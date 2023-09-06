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

import { DownOutlined, UpOutlined } from '@ant-design/icons';
import { Button, Card, Col, Row, Typography } from 'antd';
import SchemaEditor from 'components/schema-editor/SchemaEditor';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const MessageCard = ({ message }: { message: string }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card
      data-testid="message-card"
      onClick={() => setIsExpanded((pre) => !pre)}>
      <Row align="top" gutter={[8, 8]}>
        <Col className="cursor-pointer">
          {isExpanded ? (
            <UpOutlined className="text-xs" />
          ) : (
            <DownOutlined className="text-xs" />
          )}
        </Col>
        {isExpanded ? (
          <Col>
            <Button
              className="active"
              data-testid="value"
              id="sampleData-value">
              {t('label.value')}
            </Button>
            <SchemaEditor
              className="m-t-xs"
              editorClass="topic-sample-data"
              options={{
                styleActiveLine: false,
              }}
              value={message.replace(/'/g, '"')}
            />
          </Col>
        ) : (
          <Col>
            <Typography.Text ellipsis className="text-primary">
              {message}
            </Typography.Text>
          </Col>
        )}
      </Row>
    </Card>
  );
};

export default MessageCard;
