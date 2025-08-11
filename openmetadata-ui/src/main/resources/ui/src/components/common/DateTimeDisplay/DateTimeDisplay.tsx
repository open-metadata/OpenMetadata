/*
 *  Copyright 2025 Collate.
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
import { Fragment } from 'react';
import { ReactComponent as TimeDateIcon } from '../../../assets/svg/time-date.svg';
import { formatDateTimeLong } from '../../../utils/date-time/DateTimeUtils';

const DateTimeDisplay = ({ timestamp }: { timestamp?: number }) => {
  const dateValue = formatDateTimeLong(timestamp, 'MMMM dd, yyyy,');
  const timeValue = formatDateTimeLong(timestamp, 'h:mm a');
  const utcValue = formatDateTimeLong(timestamp, "'(UTC'ZZ')'");

  return timestamp ? (
    <Row gutter={[8, 8]} wrap={false}>
      <Col>
        <TimeDateIcon className="m-t-xss" height={20} width={20} />
      </Col>
      <Col>
        <Row className="line-height-16">
          <Col span={24}>
            <Typography.Text
              className="font-medium"
              data-testid="schedule-primary-details">
              {dateValue}
            </Typography.Text>
          </Col>
          <Col span={24}>
            <Typography.Text
              className="text-xs"
              data-testid="schedule-primary-details">
              {timeValue}
            </Typography.Text>{' '}
            <Typography.Text
              className="text-xs text-grey-muted"
              data-testid="schedule-secondary-details">
              {utcValue}
            </Typography.Text>
          </Col>
        </Row>
      </Col>
    </Row>
  ) : (
    <Fragment>--</Fragment>
  );
};

export default DateTimeDisplay;
