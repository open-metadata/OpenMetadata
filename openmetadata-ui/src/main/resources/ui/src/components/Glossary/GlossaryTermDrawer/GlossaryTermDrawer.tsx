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
import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ERROR_MESSAGE } from '../../../constants/constants';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getGlossaryTermByFQN } from '../../../rest/glossaryAPI';
import { getIsErrorMatch } from '../../../utils/APIUtils';
import { setCreateEntityFieldError } from '../../../utils/FormDrawerUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useFormDrawerWithHook } from '../../common/atoms/drawer/useFormDrawer';
import { EntityAttachmentProvider } from '../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import Loader from '../../common/Loader/Loader';
import AddGlossaryTermForm from '../AddGlossaryTermForm/AddGlossaryTermForm.component';
import { GlossaryTermFormValues } from '../AddGlossaryTermForm/AddGlossaryTermForm.interface';
import {
  buildGlossaryTermSavePayload,
  getGlossaryTermFormValues,
  GLOSSARY_TERM_FORM_DEFAULTS,
} from '../AddGlossaryTermForm/AddGlossaryTermForm.utils';
import { GLOSSARY_FORM_DRAWER_WIDTH } from '../hooks/useGlossaryCreateDrawer';
import { useGlossaryTermIntakeForm } from '../hooks/useGlossaryTermIntakeForm';
import { GlossaryTermDrawerProps } from './GlossaryTermDrawer.types';

const GLOSSARY_TERM_FIELDS = [
  TabSpecificField.OWNERS,
  TabSpecificField.REVIEWERS,
  TabSpecificField.TAGS,
  TabSpecificField.RELATED_TERMS,
];

/** Add / edit glossary term drawer; opens on mount and reports every close via `onCancel`. */
const GlossaryTermDrawer = ({
  editMode,
  glossaryTermFQN,
  onSave,
  onCancel,
}: GlossaryTermDrawerProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const termQuery = useQuery({
    queryKey: ['glossary-term-form', 'term', glossaryTermFQN],
    queryFn: () =>
      getGlossaryTermByFQN(glossaryTermFQN, { fields: GLOSSARY_TERM_FIELDS }),
    enabled: editMode,
    // Fresh on every open, and never refetched mid-edit.
    staleTime: Infinity,
    gcTime: 0,
  });
  const glossaryTerm = termQuery.data;
  const termFormValues = useMemo(
    () => glossaryTerm && getGlossaryTermFormValues(glossaryTerm),
    [glossaryTerm]
  );
  const form = useForm<GlossaryTermFormValues>({
    defaultValues: GLOSSARY_TERM_FORM_DEFAULTS,
    values: termFormValues,
  });
  const intake = useGlossaryTermIntakeForm(editMode);

  useEffect(() => {
    if (termQuery.error) {
      showErrorToast(termQuery.error as AxiosError);
      // Saving an unloaded term would overwrite it with blank values.
      onCancel();
    }
  }, [termQuery.error, onCancel]);

  // Field errors show inline, others as a toast; rethrown to keep the drawer open.
  const mapSaveErrorToField = useCallback(
    (error: unknown, name: string) => {
      if (
        getIsErrorMatch(error as AxiosError, ERROR_MESSAGE.mutuallyExclusive)
      ) {
        // The server message names the conflicting tags, so it is shown as is.
        form.setError('tags', {
          type: 'server',
          message: (error as AxiosError<{ message?: string }>).response?.data
            ?.message,
        });

        return;
      }

      setCreateEntityFieldError(
        error,
        form,
        'name',
        t('server.entity-already-exist', {
          entity: t('label.glossary-term'),
          entityPlural: t('label.glossary-term-lowercase-plural'),
          name,
        }),
        editMode
          ? t('server.entity-updating-error', {
              entity: t('label.glossary-term-lowercase'),
            })
          : t('server.add-entity-error', {
              entity: t('label.glossary-term-lowercase'),
            })
      );
    },
    [editMode, form, t]
  );

  const handleSubmit = useCallback(
    async (values: GlossaryTermFormValues) => {
      try {
        await onSave(
          buildGlossaryTermSavePayload({
            values,
            editMode,
            glossaryTerm,
            currentUserId: currentUser?.id,
            customProperties: intake.customProperties,
          })
        );
      } catch (error) {
        mapSaveErrorToField(error, values.name);

        throw error;
      }
    },
    [
      currentUser?.id,
      editMode,
      glossaryTerm,
      intake.customProperties,
      mapSaveErrorToField,
      onSave,
    ]
  );

  const isLoading = (editMode && termQuery.isPending) || !intake.isLoaded;

  const { formDrawer } = useFormDrawerWithHook<GlossaryTermFormValues>({
    title: editMode
      ? t('label.edit-entity', { entity: t('label.glossary-term') })
      : t('label.add-entity', { entity: t('label.glossary-term') }),
    width: GLOSSARY_FORM_DRAWER_WIDTH,
    defaultOpen: true,
    closeOnEscape: false,
    className: 'tw:z-[20]',
    testId: 'glossary-term-drawer',
    submitTestId: 'save-glossary-term',
    cancelTestId: 'cancel-glossary-term',
    hookForm: form,
    form: (
      <EntityAttachmentProvider
        entityFqn={glossaryTermFQN}
        entityType={EntityType.GLOSSARY_TERM}>
        {isLoading ? (
          <Loader />
        ) : (
          <AddGlossaryTermForm
            editMode={editMode}
            form={form}
            glossaryTerm={glossaryTerm}
            intake={intake}
            onSubmit={handleSubmit}
          />
        )}
      </EntityAttachmentProvider>
    ),
    onClose: onCancel,
    onSubmit: handleSubmit,
    loading: form.formState.isSubmitting,
    submitLoading: isLoading,
  });

  return formDrawer;
};

export default GlossaryTermDrawer;
