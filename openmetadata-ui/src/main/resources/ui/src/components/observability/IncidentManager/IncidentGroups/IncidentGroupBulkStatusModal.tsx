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
import {
  BULK_STATUS_TITLE_KEY,
  INCIDENT_FAILURE_REASON_OPTIONS,
} from './IncidentGroups.constants';
import {
  BulkStatusFormValues,
  IncidentGroupBulkStatusModalProps,
  PendingBulkChange,
} from './IncidentGroups.types';
import IncidentSeverityBadge from './IncidentSeverityBadge';

/** The modal's title for each change it confirms. */
const getTitleKey = (change?: PendingBulkChange) => {
  if (change?.kind === 'severity') {
    return 'label.set-severity';
  }

  return BULK_STATUS_TITLE_KEY[change?.status ?? CreateStatusTypes.ACK];
};

/**
 * Confirms a bulk change before it touches every incident of the selected
 * groups, and collects what a move to Assigned or Resolved needs on top of
 * the status — an assignee, or a reason and a comment.
 */
const IncidentGroupBulkStatusModal = ({
  change,
  incidentCount,
  isApplying,
  onCancel,
  onApply,
}: IncidentGroupBulkStatusModalProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const assigneePicker = useUserTeamOptions();
  const form = useForm<BulkStatusFormValues>({ mode: 'onSubmit' });
  const status = change?.kind === 'status' ? change.status : undefined;
  // Only these two carry more than the status, and ask for it here.
  const detailStatus =
    status === CreateStatusTypes.Assigned ||
    status === CreateStatusTypes.Resolved
      ? status
      : undefined;
  const isAssign = detailStatus === CreateStatusTypes.Assigned;

  // Each opening starts from an empty form. The fields are remounted too: the
  // pickers keep what they last showed in state of their own.
  const [opening, setOpening] = useState(0);
  useEffect(() => {
    if (change) {
      form.reset({});
      setOpening((count) => count + 1);
    }
  }, [form, change]);

  const required = (field: string) => ({
    required: t('label.field-required', { field }),
  });

  const statusFields: FieldProp[] = isAssign
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

  const fields = detailStatus ? statusFields : [];

  const handleSubmit = (values: BulkStatusFormValues) =>
    onApply(
      detailStatus
        ? toBulkStatusDetails(
            detailStatus,
            values,
            currentUser &&
              getEntityReferenceFromEntity(currentUser, EntityType.USER)
          )
        : undefined
    );

  return (
    <SimpleModal
      data-testid="incident-groups-bulk-status-modal"
      isOkLoading={isApplying}
      isOpen={Boolean(change)}
      okText={t('label.apply')}
      title={t(getTitleKey(change))}
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
        {change?.kind === 'severity' && (
          <IncidentSeverityBadge severity={change.severity} />
        )}
        {fields.map((field) => (
          <Fragment key={field.name}>{getField(field)}</Fragment>
        ))}
      </HookForm>
    </SimpleModal>
  );
};

export default IncidentGroupBulkStatusModal;
