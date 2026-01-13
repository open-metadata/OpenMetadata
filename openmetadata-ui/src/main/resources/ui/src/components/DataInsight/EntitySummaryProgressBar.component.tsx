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
import { Col, Progress, Row, Typography } from 'antd';
import classNames from 'classnames';
import { round } from 'lodash';
import { ReactNode } from 'react';
import { GRAYED_OUT_COLOR } from '../../constants/constants';

type EntitySummaryProgressBarProps = {
  pluralize?: boolean;
  isActive?: boolean;
  progress: number;
  entity: string;
  label?: ReactNode;
  strokeColor?: string;
};

const EntitySummaryProgressBar = ({
  isActive = true,
  pluralize = true,
  entity,
  progress,
  label,
  strokeColor,
}: EntitySummaryProgressBarProps) => {
  const pluralizeName = (entity: string) => {
    return entity + 's';
  };

  return (
    <Row
      className={classNames({
        'non-active-details': !isActive,
      })}
      data-testid="entity-summary-container">
      <Col
        className="d-flex justify-between items-center text-xs"
        md={12}
        sm={24}>
        <Typography.Paragraph
          className="m-b-0 entity-summary-name break-all"
          data-testid="entity-name">
          {pluralize ? pluralizeName(entity) : entity}
        </Typography.Paragraph>

        <Typography.Paragraph
          className="m-b-0 entity-summary-value"
          data-testid="entity-value">
          {label ?? round(progress || 0, 2)}
        </Typography.Paragraph>
      </Col>
      <Col md={12} sm={24}>
        <Progress
          className="p-l-xss"
          data-testid="progress-bar"
          percent={progress}
          showInfo={false}
          size="small"
          strokeColor={isActive ? strokeColor : GRAYED_OUT_COLOR}
        />
      </Col>
    </Row>
  );
};

export default EntitySummaryProgressBar;
