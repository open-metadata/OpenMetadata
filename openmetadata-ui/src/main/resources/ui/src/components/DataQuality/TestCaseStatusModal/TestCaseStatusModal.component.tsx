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
import { startCase, unionBy } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { CreateTestCaseResolutionStatus } from '../../../generated/api/tests/createTestCaseResolutionStatus';
import { TestCaseFailureReasonType } from '../../../generated/tests/resolved';
import { TestCaseResolutionStatusTypes } from '../../../generated/tests/testCaseResolutionStatus';
import Assignees from '../../../pages/TasksPage/shared/Assignees';
import { Option } from '../../../pages/TasksPage/TasksPage.interface';
import {
  getListTestCaseIncidentByStateId,
  postTestCaseIncidentStatus,
  transitionIncident,
} from '../../../rest/incidentManagerAPI';
import {
  createTask,
  ResolveTask,
  TaskCategory,
  TaskEntityType,
  TaskResolutionType,
} from '../../../rest/tasksAPI';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';
import { getEntityReferenceListFromEntities } from '../../../utils/EntityReferenceUtils';
import {
  fetchOptions,
  generateOptions,
} from '../../../utils/TaskAssigneeUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

import {
  PAGE_SIZE_MEDIUM,
  VALIDATION_MESSAGES,
} from '../../../constants/constants';
import { TEST_CASE_RESOLUTION_STATUS_LABELS } from '../../../constants/TestSuite.constant';
import { EntityReference } from '../../../generated/tests/testCase';
import { FieldProp, FieldTypes } from '../../../interface/FormUtils.interface';
import { getUsers } from '../../../rest/userAPI';
import { generateFormFields } from '../../../utils/formUtils';
import { TestCaseStatusModalProps } from './TestCaseStatusModal.interface';

export const TestCaseStatusModal = ({
  open,
  data,
  testCaseFqn: _testCaseFqn,
  onSubmit,
  onCancel,
}: TestCaseStatusModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [usersList, setUsersList] = useState<EntityReference[]>([]);

  const { assigneeOptions } = useMemo(() => {
    const initialAssignees = data?.testCaseResolutionStatusDetails?.assignee
      ? generateOptions([data.testCaseResolutionStatusDetails.assignee])
      : [];
    const assigneeOptions = unionBy(
      [...initialAssignees, ...generateOptions(usersList ?? [])],
      'value'
    );

    return { initialAssignees, assigneeOptions };
  }, [data, usersList]);

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
      label: TEST_CASE_RESOLUTION_STATUS_LABELS[value],
      value,
    }));
  }, [data]);

  // The outer `data` prop is the current TCRS record. In task-first mode
  // its stateId equals the Task UUID. Reopening a Resolved incident with
  // Ack/Assigned goes through the legacy TCRS endpoint: the backend reopens
  // the SAME incident task (same stateId) and restarts its workflow. Only an
  // explicit `New` starts a fresh incident (new task).
  const handleReopenFromResolved = async (
    targetStatus: TestCaseResolutionStatusTypes,
    formData: CreateTestCaseResolutionStatus
  ) => {
    const testCaseFqn = data?.testCaseReference?.fullyQualifiedName;
    const testCaseName = data?.testCaseReference?.name;
    if (!testCaseFqn || !testCaseName) {
      return;
    }

    if (targetStatus === TestCaseResolutionStatusTypes.New) {
      const newTask = await createTask({
        name: `Incident: ${testCaseName}`,
        category: TaskCategory.Incident,
        type: TaskEntityType.TestCaseResolution,
        about: getEntityFeedLink('testCase', testCaseFqn),
      });

      const refreshed = await getListTestCaseIncidentByStateId(newTask.id);
      const latest = refreshed?.data?.[0];
      if (latest) {
        onSubmit(latest);
      }
      onCancel();

      return;
    }

    const assignee = updatedAssignees?.length > 0 ? updatedAssignees[0] : null;
    let statusDetails: CreateTestCaseResolutionStatus['testCaseResolutionStatusDetails'];
    if (targetStatus === TestCaseResolutionStatusTypes.Assigned && assignee) {
      statusDetails = {
        assignee: {
          id: assignee.value ?? assignee.id,
          type: EntityType.USER,
          name: assignee.name,
          fullyQualifiedName: assignee.fullyQualifiedName ?? assignee.name,
          displayName: assignee.displayName,
        },
      };
    } else if (targetStatus === TestCaseResolutionStatusTypes.Resolved) {
      statusDetails = formData.testCaseResolutionStatusDetails;
    }

    const reopened = await postTestCaseIncidentStatus({
      testCaseReference: testCaseFqn,
      testCaseResolutionStatusType: targetStatus,
      testCaseResolutionStatusDetails: statusDetails,
    });

    const stateId = reopened?.stateId ?? data?.stateId;
    if (stateId) {
      const refreshed = await getListTestCaseIncidentByStateId(stateId);
      const latest = refreshed?.data?.[0];
      if (latest) {
        onSubmit(latest);
      }
    }
    onCancel();
  };

  const buildResolveRequest = (
    status: TestCaseResolutionStatusTypes,
    formData: CreateTestCaseResolutionStatus
  ): ResolveTask | null => {
    if (status === TestCaseResolutionStatusTypes.New) {
      return { transitionId: 'new' };
    }
    if (status === TestCaseResolutionStatusTypes.ACK) {
      return { transitionId: 'ack' };
    }
    if (status === TestCaseResolutionStatusTypes.Assigned) {
      const transitionId =
        data?.testCaseResolutionStatusType ===
        TestCaseResolutionStatusTypes.Assigned
          ? 'reassign'
          : 'assign';
      const assignee =
        updatedAssignees?.length > 0 ? updatedAssignees[0] : null;

      return {
        transitionId,
        payload: assignee
          ? {
              assignees: [
                {
                  id: assignee.value ?? assignee.id,
                  type: EntityType.USER,
                  name: assignee.name,
                  fullyQualifiedName:
                    assignee.fullyQualifiedName ?? assignee.name,
                  displayName: assignee.displayName,
                },
              ],
            }
          : undefined,
      };
    }
    if (status === TestCaseResolutionStatusTypes.Resolved) {
      return {
        transitionId: 'resolve',
        resolutionType: TaskResolutionType.Completed,
        comment:
          formData.testCaseResolutionStatusDetails?.testCaseFailureComment,
        payload: formData.testCaseResolutionStatusDetails?.testCaseFailureReason
          ? {
              testCaseFailureReason:
                formData.testCaseResolutionStatusDetails.testCaseFailureReason,
            }
          : undefined,
      };
    }

    return null;
  };

  const handleFormSubmit = async (formData: CreateTestCaseResolutionStatus) => {
    const currentStatus = data?.testCaseResolutionStatusType;
    const status = formData.testCaseResolutionStatusType;

    setIsLoading(true);

    try {
      if (currentStatus === TestCaseResolutionStatusTypes.Resolved) {
        await handleReopenFromResolved(status, formData);

        return;
      }

      const taskId = data?.stateId;
      if (!taskId) {
        return;
      }

      const resolveRequest = buildResolveRequest(status, formData);
      if (!resolveRequest) {
        return;
      }

      await transitionIncident(taskId, resolveRequest);
      const refreshed = await getListTestCaseIncidentByStateId(taskId);
      const latest = refreshed?.data?.[0];
      if (latest) {
        onSubmit(latest);
      }
      onCancel();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const descriptionField: FieldProp = useMemo(
    () => ({
      name: ['testCaseResolutionStatusDetails', 'testCaseFailureComment'],
      required: true,
      label: t('label.comment'),
      id: 'root/description',
      type: FieldTypes.DESCRIPTION,
      rules: [
        {
          required: true,
        },
      ],
      props: {
        'data-testid': 'description',
        initialValue:
          data?.testCaseResolutionStatusDetails?.testCaseFailureComment ?? '',
        placeHolder: t('message.write-your-text', {
          text: t('label.comment'),
        }),

        onTextChange: (value: string) =>
          form.setFieldValue(
            ['testCaseResolutionStatusDetails', 'testCaseFailureComment'],
            value
          ),
      },
    }),
    [data?.testCaseResolutionStatusDetails?.testCaseFailureComment]
  );
  const fetchInitialAssign = useCallback(async () => {
    try {
      const { data } = await getUsers({
        limit: PAGE_SIZE_MEDIUM,

        isBot: false,
      });
      const filterData = getEntityReferenceListFromEntities(
        data,
        EntityType.USER
      );
      setUsersList(filterData);
    } catch {
      setUsersList([]);
    }
  }, []);

  useEffect(() => {
    // fetch users once and store in state
    fetchInitialAssign();
  }, []);

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
    }
    setOptions(assigneeOptions);
  }, [data, assigneeOptions]);

  return (
    <Modal
      cancelText={t('label.cancel')}
      closable={false}
      okButtonProps={{
        id: 'update-status-button',
        form: 'update-status-form',
        htmlType: 'submit',
        loading: isLoading,
      }}
      okText={t('label.save')}
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
        validateMessages={VALIDATION_MESSAGES}
        onFinish={handleFormSubmit}>
        <Form.Item
          label={t('label.status')}
          name="testCaseResolutionStatusType"
          rules={[
            {
              required: true,
            },
          ]}>
          <Select
            data-testid="test-case-resolution-status-type"
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
                },
              ]}>
              <Select
                data-testid="test-case-failure-reason"
                placeholder={t('label.please-select-entity', {
                  entity: t('label.reason'),
                })}>
                {Object.values(TestCaseFailureReasonType).map((value) => (
                  <Select.Option key={value}>{startCase(value)}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            {generateFormFields([descriptionField])}
          </>
        )}
        {statusType === TestCaseResolutionStatusTypes.Assigned && (
          <Form.Item
            label={t('label.assignee')}
            name={['testCaseResolutionStatusDetails', 'assignee']}
            rules={[
              {
                required: true,
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
              onSearch={(query) =>
                fetchOptions({
                  query,
                  setOptions,
                  onlyUsers: true,
                  initialOptions: assigneeOptions,
                })
              }
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};
