/*
 *  Copyright 2026 Collate.
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
  FieldProp,
  FieldTypes,
  getField,
  HookForm,
  SimpleModal,
  Typography,
} from '@openmetadata/ui-core-components';
import { Fragment, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../enums/entity.enum';
import { TestCaseResolutionStatusTypes as CreateStatusTypes } from '../../../../generated/api/tests/createTestCaseResolutionStatus';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getEntityReferenceFromEntity } from '../../../../utils/EntityReferenceUtils';
import { useUserTeamOptions } from '../../../Glossary/hooks/useEntityReferenceOptions';
import { toBulkStatusDetails } from './IncidentGroupBulk.utils';
import { INCIDENT_FAILURE_REASON_OPTIONS } from './IncidentGroups.constants';
import {
  BulkStatusFormValues,
  IncidentGroupBulkStatusModalProps,
} from './IncidentGroups.types';

/**
 * Collects what a bulk move to Assigned or Resolved needs on top of the
 * status — an assignee, or a reason and a comment — once for every incident
 * of the selected groups.
 */
const IncidentGroupBulkStatusModal = ({
  status,
  incidentCount,
  isApplying,
  onCancel,
  onApply,
}: IncidentGroupBulkStatusModalProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const assigneePicker = useUserTeamOptions();
  const form = useForm<BulkStatusFormValues>({ mode: 'onSubmit' });
  const isAssign = status === CreateStatusTypes.Assigned;

  // Each opening starts from an empty form. The fields are remounted too: the
  // pickers keep what they last showed in state of their own.
  const [opening, setOpening] = useState(0);
  useEffect(() => {
    if (status) {
      form.reset({});
      setOpening((count) => count + 1);
    }
  }, [form, status]);

  const required = (field: string) => ({
    required: t('label.field-required', { field }),
  });

  const fields: FieldProp[] = isAssign
    ? [
        {
          id: 'root/assignee',
          label: t('label.assignee'),
          name: 'assignee',
          placeholder: t('label.select-field', {
            field: t('label.assignee'),
          }),
          props: {
            'data-testid': 'bulk-status-assignee',
            // The server already filtered the options by the search text.
            filterOption: () => true,
            multiple: false,
            onFocus: assigneePicker.onFocus,
            onSearchChange: assigneePicker.onSearchChange,
            options: assigneePicker.options,
          },
          required: true,
          rules: required(t('label.assignee')),
          type: FieldTypes.USER_TEAM_SELECT_INPUT,
        },
      ]
    : [
        {
          id: 'root/testCaseFailureReason',
          label: t('label.reason'),
          name: 'testCaseFailureReason',
          placeholder: t('label.select-field', { field: t('label.reason') }),
          props: {
            'data-testid': 'bulk-status-reason',
            options: INCIDENT_FAILURE_REASON_OPTIONS.map((option) => ({
              ...option,
              label: t(option.label),
            })),
          },
          required: true,
          rules: required(t('label.reason')),
          type: FieldTypes.SELECT,
        },
        {
          id: 'root/testCaseFailureComment',
          label: t('label.comment'),
          name: 'testCaseFailureComment',
          props: { 'data-testid': 'bulk-status-comment' },
          required: true,
          rules: {
            ...required(t('label.comment')),
            // Spaces alone would be stored as the comment.
            validate: (value?: string) =>
              Boolean(value?.trim()) ||
              t('label.field-required', { field: t('label.comment') }),
          },
          type: FieldTypes.TEXTAREA,
        },
      ];

  const handleSubmit = (values: BulkStatusFormValues) =>
    status &&
    onApply(
      toBulkStatusDetails(
        status,
        values,
        currentUser &&
          getEntityReferenceFromEntity(currentUser, EntityType.USER)
      )
    );

  return (
    <SimpleModal
      data-testid="incident-groups-bulk-status-modal"
      isOkLoading={isApplying}
      isOpen={Boolean(status)}
      okText={t('label.apply')}
      title={isAssign ? t('label.assign-to') : t('label.resolve')}
      onCancel={onCancel}
      onOk={form.handleSubmit(handleSubmit)}>
      <HookForm
        className="tw:flex tw:flex-col tw:gap-4"
        form={form}
        key={opening}>
        <Typography
          as="p"
          className="tw:text-tertiary"
          data-testid="bulk-status-scope"
          size="text-sm">
          {t('message.bulk-incident-scope', { count: incidentCount })}
        </Typography>
        {fields.map((field) => (
          <Fragment key={field.name}>{getField(field)}</Fragment>
        ))}
      </HookForm>
    </SimpleModal>
  );
};

export default IncidentGroupBulkStatusModal;
