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
import {
  Box,
  Button,
  FormField,
  HintText,
  HookForm,
  Label,
  Select,
  SimpleModal,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { startCase, unionBy } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { TestCaseFailureReasonType } from '../../../generated/tests/resolved';
import { TestCaseResolutionStatusTypes } from '../../../generated/tests/testCaseResolutionStatus';
import Assignees from '../../../pages/TasksPage/shared/Assignees';
import { Option } from '../../../pages/TasksPage/TasksPage.interface';
import {
  getListTestCaseIncidentByStateId,
  transitionIncident,
} from '../../../rest/incidentManagerAPI';
import { ResolveTask, TaskResolutionType } from '../../../rest/tasksAPI';
import { reopenResolvedIncident } from '../../../utils/DataQuality/IncidentManagerUtils';
import { getEntityReferenceListFromEntities } from '../../../utils/EntityReferenceUtils';
import {
  fetchOptions,
  generateOptions,
} from '../../../utils/TaskAssigneeUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

import { PAGE_SIZE_MEDIUM } from '../../../constants/constants';
import { TEST_CASE_RESOLUTION_STATUS_LABELS } from '../../../constants/TestSuite.constant';
import { EntityReference } from '../../../generated/tests/testCase';
import { getUsers } from '../../../rest/userAPI';
import RichTextEditor from '../../common/RichTextEditor/RichTextEditor';
import {
  TestCaseStatusFormValues,
  TestCaseStatusModalProps,
} from './TestCaseStatusModal.interface';

const FORM_ID = 'update-status-form';

const FAILURE_REASON_ITEMS = Object.values(TestCaseFailureReasonType).map(
  (value) => ({ id: value, label: startCase(value) })
);

export const TestCaseStatusModal = ({
  open,
  data,
  testCaseFqn: _testCaseFqn,
  onSubmit,
  onCancel,
}: TestCaseStatusModalProps) => {
  const { t } = useTranslation();
  const form = useForm<TestCaseStatusFormValues>({
    defaultValues: {
      testCaseResolutionStatusType: data?.testCaseResolutionStatusType,
      testCaseResolutionStatusDetails: {
        testCaseFailureReason:
          data?.testCaseResolutionStatusDetails?.testCaseFailureReason,
        testCaseFailureComment:
          data?.testCaseResolutionStatusDetails?.testCaseFailureComment,
      },
    },
  });
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

  const statusType = form.watch('testCaseResolutionStatusType');
  const updatedAssignees = form.watch(
    'testCaseResolutionStatusDetails.assignee'
  );
  const requiredMessage = (fieldText: string) =>
    t('message.field-text-is-required', { fieldText });

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
      id: value,
      label: TEST_CASE_RESOLUTION_STATUS_LABELS[value],
    }));
  }, [data]);

  const handleReopenFromResolved = async (
    targetStatus: TestCaseResolutionStatusTypes,
    formData: TestCaseStatusFormValues
  ) => {
    const testCaseFqn = data?.testCaseReference?.fullyQualifiedName;
    const testCaseName = data?.testCaseReference?.name;
    if (!testCaseFqn || !testCaseName) {
      return;
    }

    const assignee = updatedAssignees?.[0];
    const latest = await reopenResolvedIncident({
      testCaseFqn,
      testCaseName,
      targetStatus,
      currentStateId: data?.stateId,
      details: {
        assignee: assignee
          ? {
              id: assignee.value,
              type: EntityType.USER,
              name: assignee.name,
              fullyQualifiedName: assignee.name,
              displayName: assignee.displayName,
            }
          : undefined,
        reason: formData.testCaseResolutionStatusDetails?.testCaseFailureReason,
        comment:
          formData.testCaseResolutionStatusDetails?.testCaseFailureComment,
      },
    });

    if (latest) {
      onSubmit(latest);
    }
    onCancel();
  };

  const buildAssignedResolveRequest = (): ResolveTask => {
    const transitionId =
      data?.testCaseResolutionStatusType ===
      TestCaseResolutionStatusTypes.Assigned
        ? 'reassign'
        : 'assign';
    const assignee = updatedAssignees?.[0];

    return {
      transitionId,
      payload: assignee
        ? {
            assignees: [
              {
                id: assignee.value,
                type: EntityType.USER,
                name: assignee.name,
                fullyQualifiedName: assignee.name,
                displayName: assignee.displayName,
              },
            ],
          }
        : undefined,
    };
  };

  const buildResolvedResolveRequest = (
    formData: TestCaseStatusFormValues
  ): ResolveTask => {
    return {
      transitionId: 'resolve',
      resolutionType: TaskResolutionType.Completed,
      comment: formData.testCaseResolutionStatusDetails?.testCaseFailureComment,
      payload: formData.testCaseResolutionStatusDetails?.testCaseFailureReason
        ? {
            testCaseFailureReason:
              formData.testCaseResolutionStatusDetails.testCaseFailureReason,
          }
        : undefined,
    };
  };

  const buildResolveRequest = (
    status: TestCaseResolutionStatusTypes,
    formData: TestCaseStatusFormValues
  ): ResolveTask | null => {
    if (status === TestCaseResolutionStatusTypes.New) {
      return { transitionId: 'new' };
    }
    if (status === TestCaseResolutionStatusTypes.ACK) {
      return { transitionId: 'ack' };
    }
    if (status === TestCaseResolutionStatusTypes.Assigned) {
      return buildAssignedResolveRequest();
    }
    if (status === TestCaseResolutionStatusTypes.Resolved) {
      return buildResolvedResolveRequest(formData);
    }

    return null;
  };

  const handleFormSubmit = async (formData: TestCaseStatusFormValues) => {
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
      form.setValue(
        'testCaseResolutionStatusDetails.assignee',
        generateOptions([assignee])
      );
    }
    setOptions(assigneeOptions);
  }, [data, assigneeOptions]);

  return (
    // Not dismissable: the editor's menus and the assignee dropdown render in
    // portals, so a press inside them would count as an outside click.
    <SimpleModal
      footer={
        <>
          <Button color="secondary" onPress={onCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            form={FORM_ID}
            id="update-status-button"
            isLoading={isLoading}
            type="submit">
            {t('label.save')}
          </Button>
        </>
      }
      isDismissable={false}
      isOpen={open}
      title={t('label.update-entity', { entity: t('label.status') })}
      width={750}
      onCancel={onCancel}>
      <HookForm
        className="tw:flex tw:flex-col tw:gap-5"
        data-testid={FORM_ID}
        form={form}
        id={FORM_ID}
        onSubmit={form.handleSubmit(handleFormSubmit)}>
        <FormField
          control={form.control}
          name="testCaseResolutionStatusType"
          rules={{ required: requiredMessage(t('label.status')) }}>
          {({ field, fieldState }) => (
            <Select
              isRequired
              data-testid="test-case-resolution-status-type"
              hint={fieldState.error?.message}
              isInvalid={Boolean(fieldState.error)}
              items={statusOptions}
              label={t('label.status')}
              placeholder={t('label.please-select-entity', {
                entity: t('label.status'),
              })}
              selectedKey={field.value ?? null}
              validationBehavior="aria"
              onSelectionChange={field.onChange}>
              {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
            </Select>
          )}
        </FormField>
        {statusType === TestCaseResolutionStatusTypes.Resolved && (
          <>
            <FormField
              control={form.control}
              name="testCaseResolutionStatusDetails.testCaseFailureReason"
              rules={{ required: requiredMessage(t('label.reason')) }}>
              {({ field, fieldState }) => (
                <Select
                  isRequired
                  data-testid="test-case-failure-reason"
                  hint={fieldState.error?.message}
                  isInvalid={Boolean(fieldState.error)}
                  items={FAILURE_REASON_ITEMS}
                  label={t('label.reason')}
                  placeholder={t('label.please-select-entity', {
                    entity: t('label.reason'),
                  })}
                  selectedKey={field.value ?? null}
                  validationBehavior="aria"
                  onSelectionChange={field.onChange}>
                  {(item) => (
                    <Select.Item id={item.id}>{item.label}</Select.Item>
                  )}
                </Select>
              )}
            </FormField>
            <FormField
              control={form.control}
              name="testCaseResolutionStatusDetails.testCaseFailureComment"
              rules={{ required: requiredMessage(t('label.comment')) }}>
              {({ field, fieldState }) => (
                <Box className="tw:gap-1.5" direction="col">
                  <Label isRequired>{t('label.comment')}</Label>
                  <RichTextEditor
                    data-testid="description"
                    initialValue={
                      data?.testCaseResolutionStatusDetails
                        ?.testCaseFailureComment ?? ''
                    }
                    placeHolder={t('message.write-your-text', {
                      text: t('label.comment'),
                    })}
                    onTextChange={field.onChange}
                  />
                  {fieldState.error && (
                    <HintText isInvalid>{fieldState.error.message}</HintText>
                  )}
                </Box>
              )}
            </FormField>
          </>
        )}
        {statusType === TestCaseResolutionStatusTypes.Assigned && (
          <FormField
            control={form.control}
            name="testCaseResolutionStatusDetails.assignee"
            rules={{ required: requiredMessage(t('label.assignee')) }}>
            {({ field, fieldState }) => (
              <Box className="tw:gap-1.5" direction="col">
                <Label isRequired>{t('label.assignee')}</Label>
                <Assignees
                  allowClear
                  isSingleSelect
                  options={options}
                  value={field.value ?? []}
                  onChange={field.onChange}
                  onSearch={(query) =>
                    fetchOptions({
                      query,
                      setOptions,
                      onlyUsers: true,
                      initialOptions: assigneeOptions,
                    })
                  }
                />
                {fieldState.error && (
                  <HintText isInvalid>{fieldState.error.message}</HintText>
                )}
              </Box>
            )}
          </FormField>
        )}
      </HookForm>
    </SimpleModal>
  );
};
