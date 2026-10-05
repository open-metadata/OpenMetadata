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

/* eslint-disable openmetadata-imports/no-lower-layer-page-imports -- shared settings widget reused here */
import { Box, Button } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CreateIntakeForm } from '../../../../../../generated/api/governance/createIntakeForm';
import {
  IntakeForm,
  TargetEntityType,
} from '../../../../../../generated/governance/intakeForm';
import IntakeFormDesignerBody, {
  IntakeFormDesignerBodyHandle,
} from '../../../../../../pages/IntakeForms/IntakeFormDesignerBody';
import {
  createIntakeForm,
  createOrUpdateIntakeForm,
  getIntakeFormById,
} from '../../../../../../rest/intakeFormsAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import { GovernanceView } from './Governance.types';

const INTAKE_FORM_ENTITY = 'label.intake-form';
const VIEW_INTAKE_LIST = 'intake-list' as const;

interface GovernanceIntakeFormPageProps {
  /** Entity type for create flow. */
  entityType?: TargetEntityType;
  /** Intake form ID for edit flow. */
  editId?: string;
  onNavigate: (view: GovernanceView) => void;
}

const GovernanceIntakeFormPage: FC<GovernanceIntakeFormPageProps> = ({
  entityType,
  editId,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const bodyRef = useRef<IntakeFormDesignerBodyHandle>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [existing, setExisting] = useState<IntakeForm | null>(null);
  const [resolvedEntityType, setResolvedEntityType] = useState<
    TargetEntityType | undefined
  >(entityType);

  useEffect(() => {
    if (!editId) {
      return;
    }
    setIsLoadingExisting(true);
    getIntakeFormById(editId, 'owners,formFields,requiredFields')
      .then((form) => {
        setExisting(form);
        setResolvedEntityType(form.entityType);
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          t('server.entity-fetch-error', { entity: t(INTAKE_FORM_ENTITY) })
        );
        onNavigate({ type: VIEW_INTAKE_LIST });
      })
      .finally(() => setIsLoadingExisting(false));
  }, [editId, t, onNavigate]);

  const handleSubmit = useCallback(
    async (payload: CreateIntakeForm) => {
      setIsSaving(true);
      try {
        if (existing) {
          await createOrUpdateIntakeForm(payload);
          showSuccessToast(t('message.intake-form-updated-successfully'));
        } else {
          await createIntakeForm(payload);
          showSuccessToast(t('message.intake-form-created-successfully'));
        }
        onNavigate({ type: VIEW_INTAKE_LIST });
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setIsSaving(false);
      }
    },
    [existing, onNavigate, t]
  );

  if (isLoadingExisting || !resolvedEntityType) {
    return (
      <div className="tw:flex tw:flex-1 tw:items-center tw:justify-center tw:p-8 tw:text-sm tw:text-tertiary">
        {t('label.loading')}
      </div>
    );
  }

  return (
    <Box
      className="tw:h-full tw:overflow-hidden"
      data-testid="intake-form-page"
      direction="col">
      <div className="tw:flex-1 tw:overflow-y-auto">
        <IntakeFormDesignerBody
          open
          entityType={resolvedEntityType}
          initialValue={existing}
          ref={bodyRef}
          onSubmit={handleSubmit}
        />
      </div>

      <Box
        className="tw:shrink-0 tw:border-t tw:border-secondary tw:bg-surface tw:px-8 tw:py-4 tw:shadow-sm"
        direction="row"
        gap={3}
        justify="end">
        <Button
          color="tertiary"
          data-testid="intake-form-cancel"
          isDisabled={isSaving}
          type="button"
          onPress={() => onNavigate({ type: VIEW_INTAKE_LIST })}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="intake-form-submit"
          isLoading={isSaving}
          type="button"
          onPress={() => bodyRef.current?.submit()}>
          {existing ? t('label.save') : t('label.create')}
        </Button>
      </Box>
    </Box>
  );
};

export default GovernanceIntakeFormPage;
