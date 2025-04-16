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

import { Col, Row, Typography } from 'antd';
import { isNil, round } from 'lodash';
import { useTranslation } from 'react-i18next';

interface CustomStatisticProps {
  value: number | string;
  label?: string;
  changeInValue?: number;
  duration?: number;
}

const CustomStatistic = ({
  value,
  label,
  changeInValue,
  duration,
}: CustomStatisticProps) => {
  const { t } = useTranslation();

  return (
    <Row justify="space-between">
      <Col>
        <Typography.Paragraph className="font-medium m-b-0">
          {label}
        </Typography.Paragraph>
        <Typography.Paragraph className="font-bold text-2xl m-b-0">
          {value}
        </Typography.Paragraph>
      </Col>
      <Col className="text-right">
        {!isNil(changeInValue) && (
          <Typography.Paragraph className="m-b-0">
            <Typography.Text
              className="d-block"
              type={changeInValue >= 0 ? 'success' : 'danger'}>
              {`${changeInValue >= 0 ? '+' : ''}${round(
                changeInValue || 0,
                2
              )}%`}
            </Typography.Text>
            <Typography.Text className="d-block">
              {!isNil(duration) &&
                t('label.days-change-lowercase', {
                  days: duration,
                })}
            </Typography.Text>
          </Typography.Paragraph>
        )}
      </Col>
    </Row>
  );
};

export default CustomStatistic;
