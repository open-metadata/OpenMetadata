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
import React from 'react';
import { MangeButtonItemLabelProps } from './ManageButtonItemLabel.interface';

export const ManageButtonItemLabel = ({
  name,
  onClick,
  icon,
  description,
  id,
}: MangeButtonItemLabelProps) => {
  return (
    <Row className="cursor-pointer" data-testid={id} onClick={onClick}>
      <Col className="self-center" data-testid={`${id}-icon`} span={3}>
        {icon}
      </Col>
      <Col
        className="text-left"
        data-testid={`${id}-details-container`}
        span={21}>
        <Typography.Paragraph
          className="font-medium m-b-0"
          data-testid={`${id}-title`}>
          {name}
        </Typography.Paragraph>
        <Typography.Paragraph
          className="text-grey-muted text-xs m-b-0 break-word"
          data-testid={`${id}-description`}>
          {description}
        </Typography.Paragraph>
      </Col>
    </Row>
  );
};
