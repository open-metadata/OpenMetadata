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

import { Col, Row } from 'antd';
import classNames from 'classnames';
import { lowerCase } from 'lodash';
import React from 'react';

interface CardProps {
  children: React.ReactElement;
  heading: string;
  className?: string;
  action?: React.ReactElement;
}

const Card = ({ children, heading, action, className }: CardProps) => {
  return (
    <div
      className={classNames(
        'tw-bg-white tw-border tw-border-border-gray tw-rounded-md tw-w-full',
        className
      )}
      data-testid={`${lowerCase(heading)}-card-container`}>
      <Row
        align="middle"
        className="tw-border-b tw-px-4 tw-py-2 tw-w-full"
        justify="space-between">
        <Col>
          <span className="tw-font-medium">{heading}</span>
        </Col>
        <Col>{action}</Col>
      </Row>
      <div className="tw-px-4 tw-py-2">{children}</div>
    </div>
  );
};

export default Card;
