/*
 *  Copyright 2024 Collate.
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

import { Card, Col, Row, Typography } from 'antd';
import classNames from 'classnames';
import './form-card-section.less';
import { FormCardSectionProps } from './FormCardSection.interface';

function FormCardSection({
  heading,
  subHeading,
  children,
  childrenContainerClassName = '',
  className = '',
}: Readonly<FormCardSectionProps>) {
  return (
    <Card
      className={classNames('form-card-section-container', className)}
      data-testid={`${heading}-container`}>
      <Row gutter={[8, 8]}>
        <Col span={24}>
          <Typography.Text className="font-medium">{heading}</Typography.Text>
        </Col>
        <Col span={24}>
          <Typography.Text className="text-xs text-grey-muted">
            {subHeading}
          </Typography.Text>
        </Col>
        <Col
          className={classNames('p-t-sm', childrenContainerClassName)}
          span={24}>
          {children}
        </Col>
      </Row>
    </Card>
  );
}

export default FormCardSection;
