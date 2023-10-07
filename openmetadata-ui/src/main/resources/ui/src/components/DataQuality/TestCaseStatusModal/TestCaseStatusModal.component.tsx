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
import { startCase } from 'lodash';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppState from '../../../AppState';
import RichTextEditor from '../../../components/common/rich-text-editor/RichTextEditor';
import { EditorContentRef } from '../../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor.interface';
import {
  TestCaseFailureReason,
  TestCaseFailureStatus,
  TestCaseFailureStatusType,
} from '../../../generated/tests/testCase';
import { getCurrentMillis } from '../../../utils/date-time/DateTimeUtils';
import { TestCaseStatusModalProps } from './TestCaseStatusModal.interface';

export const TestCaseStatusModal = ({
  open,
  data,
  onSubmit,
  onCancel,
}: TestCaseStatusModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const markdownRef = useRef<EditorContentRef>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const statusType = Form.useWatch('testCaseFailureStatusType', form);

  const handleFormSubmit = (data: TestCaseFailureStatus) => {
    const updatedData: TestCaseFailureStatus = {
      ...data,
      updatedAt: getCurrentMillis(),
      updatedBy: AppState.getCurrentUserDetails()?.fullyQualifiedName,
    };
    onSubmit(updatedData).finally(() => {
      setIsLoading(false);
    });
  };

  return (
    <Modal
      cancelText={t('label.cancel')}
      closable={false}
      okButtonProps={{
        form: 'update-status-form',
        htmlType: 'submit',
        loading: isLoading,
      }}
      okText={t('label.submit')}
      open={open}
      title={t('label.update-entity', { entity: t('label.status') })}
      width={750}
      onCancel={onCancel}>
      <Form<TestCaseFailureStatus>
        data-testid="update-status-form"
        form={form}
        id="update-status-form"
        initialValues={data}
        layout="vertical"
        onFinish={handleFormSubmit}>
        <Form.Item
          label={t('label.status')}
          name="testCaseFailureStatusType"
          rules={[
            {
              required: true,
              message: t('label.field-required', {
                field: t('label.status'),
              }),
            },
          ]}>
          <Select
            placeholder={t('label.please-select-entity', {
              entity: t('label.status'),
            })}>
            {Object.values(TestCaseFailureStatusType).map((value) => (
              <Select.Option key={value}>{value}</Select.Option>
            ))}
          </Select>
        </Form.Item>
        {statusType === TestCaseFailureStatusType.Resolved && (
          <>
            <Form.Item
              label={t('label.reason')}
              name="testCaseFailureReason"
              rules={[
                {
                  required: true,
                  message: t('label.field-required', {
                    field: t('label.reason'),
                  }),
                },
              ]}>
              <Select
                placeholder={t('label.please-select-entity', {
                  entity: t('label.reason'),
                })}>
                {Object.values(TestCaseFailureReason).map((value) => (
                  <Select.Option key={value}>{startCase(value)}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              label={t('label.comment')}
              name="testCaseFailureComment"
              rules={[
                {
                  required: true,
                  message: t('label.field-required', {
                    field: t('label.comment'),
                  }),
                },
              ]}>
              <RichTextEditor
                height="200px"
                initialValue={data?.testCaseFailureComment ?? ''}
                placeHolder={t('message.write-your-text', {
                  text: t('label.comment'),
                })}
                ref={markdownRef}
                onTextChange={(value) =>
                  form.setFieldValue('testCaseFailureComment', value)
                }
              />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
};
