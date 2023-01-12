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

import { Button, Col, Row, Space } from 'antd';
import { t } from 'i18next';
import React, { useEffect, useState } from 'react';
import CronEditor from '../../common/CronEditor/CronEditor';
import { TestSuiteSchedulerProps } from '../AddDataQualityTest.interface';

const TestSuiteScheduler: React.FC<TestSuiteSchedulerProps> = ({
  initialData,
  onCancel,
  onSubmit,
}) => {
  const [repeatFrequency, setRepeatFrequency] = useState<string | undefined>(
    initialData
  );

  useEffect(() => {
    if (initialData) {
      setRepeatFrequency(initialData);
    }
  }, [initialData]);

  return (
    <Row gutter={[16, 32]}>
      <Col span={24}>
        <CronEditor
          value={repeatFrequency}
          onChange={(value: string) => setRepeatFrequency(value)}
        />
      </Col>
      <Col span={24}>
        <Space className="tw-w-full tw-justify-end" size={16}>
          <Button onClick={onCancel}>{t('label.back')}</Button>
          <Button
            data-testid="deploy-button"
            type="primary"
            onClick={() => onSubmit(repeatFrequency || '')}>
            {t('label.submit')}
          </Button>
        </Space>
      </Col>
    </Row>
  );
};

export default TestSuiteScheduler;
