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
import { AxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getGlossaryTermByFQN } from '../../../rest/glossaryAPI';
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

/**
 * Add / edit glossary term drawer. It opens on mount and reports every close
 * through `onCancel`, so the parent controls it by mounting it.
 */
const GlossaryTermDrawer = ({
  editMode,
  glossaryTermFQN,
  onSave,
  onCancel,
}: GlossaryTermDrawerProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const form = useForm<GlossaryTermFormValues>({
    defaultValues: GLOSSARY_TERM_FORM_DEFAULTS,
  });
  const intake = useGlossaryTermIntakeForm(editMode);
  const [glossaryTerm, setGlossaryTerm] = useState<GlossaryTerm>();
  const [isTermLoading, setIsTermLoading] = useState(editMode);

  useEffect(() => {
    if (!editMode) {
      return;
    }

    let cancelled = false;
    setIsTermLoading(true);

    getGlossaryTermByFQN(glossaryTermFQN, { fields: GLOSSARY_TERM_FIELDS })
      .then((term) => {
        if (!cancelled) {
          setGlossaryTerm(term);
          form.reset(getGlossaryTermFormValues(term));
        }
      })
      .catch((error: AxiosError) => {
        if (!cancelled) {
          showErrorToast(error);
          // Saving an unloaded term would overwrite it with blank values.
          onCancel();
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsTermLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [editMode, form, glossaryTermFQN, onCancel]);

  // Surfaces the server's field-level rejections inline and toasts the rest;
  // the error is rethrown so the drawer stays open for a retry.
  const mapSaveErrorToField = useCallback(
    (error: unknown) => {
      const response = (error as AxiosError<{ message?: string }>)?.response;
      const message = response?.data?.message ?? '';

      if (response?.status === 400 && message.includes('already exists')) {
        form.setError('name', { type: 'server', message });
      } else if (
        response?.status === 400 &&
        message.includes('mutually exclusive')
      ) {
        form.setError('tags', { type: 'server', message });
      } else {
        showErrorToast(error as AxiosError);
      }
    },
    [form]
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
        mapSaveErrorToField(error);

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

  const isLoading = isTermLoading || !intake.isLoaded;

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
    submitLoading: isLoading,
  });

  return formDrawer;
};

export default GlossaryTermDrawer;
