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
import { Form, Modal, Select } from 'antd';
import { TestCaseFailureStatus } from 'generated/tests/testCase';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TestCaseStatusModalProps } from './TestCaseStatusModal.interface';

export const TestCaseStatusModal = ({
  open,
  data,
}: TestCaseStatusModalProps) => {
  const { t } = useTranslation();

  return (
    <Modal open={open} title={t('label.update')}>
      <Form<TestCaseFailureStatus> initialValues={data} layout="vertical">
        <Form.Item label={t('label.status')} name="testCaseFailureStatusType">
          <Select
            placeholder={t('label.select-entity', {
              entity: t('label.status'),
            })}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
