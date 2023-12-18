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
import { AxiosError } from 'axios';
import { startCase } from 'lodash';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import RichTextEditor from '../../../components/common/RichTextEditor/RichTextEditor';
import { EditorContentRef } from '../../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor.interface';
import { EntityType } from '../../../enums/entity.enum';
import { CreateTestCaseResolutionStatus } from '../../../generated/api/tests/createTestCaseResolutionStatus';
import { TestCaseFailureReasonType } from '../../../generated/tests/resolved';
import { TestCaseResolutionStatusTypes } from '../../../generated/tests/testCaseResolutionStatus';
import Assignees from '../../../pages/TasksPage/shared/Assignees';
import { Option } from '../../../pages/TasksPage/TasksPage.interface';
import { postTestCaseIncidentStatus } from '../../../rest/incidentManagerAPI';
import {
  getEntityName,
  getEntityReferenceFromEntity,
} from '../../../utils/EntityUtils';
import { fetchOptions } from '../../../utils/TasksUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useAuthContext } from '../../Auth/AuthProviders/AuthProvider';
import { TestCaseStatusModalProps } from './TestCaseStatusModal.interface';

export const TestCaseStatusModal = ({
  open,
  data,
  testCaseFqn,
  onSubmit,
  onCancel,
}: TestCaseStatusModalProps) => {
  const { t } = useTranslation();
  const { currentUser } = useAuthContext();
  const [form] = Form.useForm();
  const markdownRef = useRef<EditorContentRef>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [options, setOptions] = useState<Option[]>([]);

  const statusType = Form.useWatch('testCaseResolutionStatusType', form);
  const updatedAssignees = Form.useWatch(
    ['testCaseResolutionStatusDetails', 'assignee'],
    form
  );

  const statusOptions = useMemo(() => {
    const status =
      data?.testCaseResolutionStatusType ===
      TestCaseResolutionStatusTypes.Assigned
        ? [
            TestCaseResolutionStatusTypes.Assigned,
            TestCaseResolutionStatusTypes.Resolved,
          ]
        : Object.values(TestCaseResolutionStatusTypes);

    return status.map((value) => ({
      label: value,
      value,
    }));
  }, [data]);

  const handleFormSubmit = async (data: CreateTestCaseResolutionStatus) => {
    setIsLoading(true);
    const updatedData: CreateTestCaseResolutionStatus = {
      ...data,
      testCaseReference: testCaseFqn,
    };

    switch (data.testCaseResolutionStatusType) {
      case TestCaseResolutionStatusTypes.Resolved:
        updatedData.testCaseResolutionStatusDetails = {
          ...data.testCaseResolutionStatusDetails,
          resolvedBy: currentUser
            ? getEntityReferenceFromEntity(currentUser, EntityType.USER)
            : undefined,
        };

        break;

      case TestCaseResolutionStatusTypes.Assigned:
        if (updatedAssignees.length > 0) {
          updatedData.testCaseResolutionStatusDetails = {
            ...data.testCaseResolutionStatusDetails,
            assignee: {
              id: updatedAssignees[0].value,
              type: EntityType.USER,
            },
          };
        }

        break;
      default:
        break;
    }
    try {
      const data = await postTestCaseIncidentStatus(updatedData);
      onSubmit(data);
      onCancel();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const assignee = data?.testCaseResolutionStatusDetails?.assignee;
    if (
      data?.testCaseResolutionStatusType ===
        TestCaseResolutionStatusTypes.Assigned &&
      assignee
    ) {
      form.setFieldValue(
        ['testCaseResolutionStatusDetails', 'assignee'],
        [assignee.id]
      );
      setOptions([
        {
          label: getEntityName(assignee),
          value: assignee.id,
          type: assignee.type,
          name: assignee.name,
        },
      ]);
    }
  }, [data]);

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
      <Form<CreateTestCaseResolutionStatus>
        data-testid="update-status-form"
        form={form}
        id="update-status-form"
        initialValues={data}
        layout="vertical"
        onFinish={handleFormSubmit}>
        <Form.Item
          label={t('label.status')}
          name="testCaseResolutionStatusType"
          rules={[
            {
              required: true,
              message: t('label.field-required', {
                field: t('label.status'),
              }),
            },
          ]}>
          <Select
            options={statusOptions}
            placeholder={t('label.please-select-entity', {
              entity: t('label.status'),
            })}
          />
        </Form.Item>
        {statusType === TestCaseResolutionStatusTypes.Resolved && (
          <>
            <Form.Item
              label={t('label.reason')}
              name={[
                'testCaseResolutionStatusDetails',
                'testCaseFailureReason',
              ]}
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
                {Object.values(TestCaseFailureReasonType).map((value) => (
                  <Select.Option key={value}>{startCase(value)}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              label={t('label.comment')}
              name={[
                'testCaseResolutionStatusDetails',
                'testCaseFailureComment',
              ]}
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
                initialValue={
                  data?.testCaseResolutionStatusDetails
                    ?.testCaseFailureComment ?? ''
                }
                placeHolder={t('message.write-your-text', {
                  text: t('label.comment'),
                })}
                ref={markdownRef}
                onTextChange={(value) =>
                  form.setFieldValue(
                    [
                      'testCaseResolutionStatusDetails',
                      'testCaseFailureComment',
                    ],
                    value
                  )
                }
              />
            </Form.Item>
          </>
        )}
        {statusType === TestCaseResolutionStatusTypes.Assigned && (
          <Form.Item
            label={t('label.assignee')}
            name={['testCaseResolutionStatusDetails', 'assignee']}
            rules={[
              {
                required: true,
                message: t('label.field-required', {
                  field: t('label.assignee'),
                }),
              },
            ]}>
            <Assignees
              allowClear
              isSingleSelect
              options={options}
              value={updatedAssignees}
              onChange={(values) =>
                form.setFieldValue(
                  ['testCaseResolutionStatusDetails', 'assignee'],
                  values
                )
              }
              onSearch={(query) => fetchOptions(query, setOptions, true)}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};
