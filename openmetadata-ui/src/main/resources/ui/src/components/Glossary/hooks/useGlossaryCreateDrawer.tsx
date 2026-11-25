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
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TargetEntityType } from '../../../generated/governance/intakeForm';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useDomainStore } from '../../../hooks/useDomainStore';
import { addGlossaries } from '../../../rest/glossaryAPI';
import {
  setCreateEntityFieldError,
  submitAndClose,
} from '../../../utils/FormDrawerUtils';
import { getGlossaryPath } from '../../../utils/RouterUtils';
import { useFormDrawerWithHook } from '../../common/atoms/drawer/useFormDrawer';
import AddGlossary from '../AddGlossary/AddGlossary.component';
import { GlossaryFormValues } from '../AddGlossary/AddGlossary.interface';
import {
  GLOSSARY_FORM_DEFAULTS,
  toEntityReferenceOption,
  transformGlossaryFormData,
} from '../AddGlossary/AddGlossary.utils';
import { useGlossaryIntakeForm } from './useGlossaryTermIntakeForm';

export const GLOSSARY_FORM_DRAWER_WIDTH = '40vw';

/** Create-glossary drawer; on success navigates to the new glossary and calls `onCreated`. */
export const useGlossaryCreateDrawer = (
  onCreated?: (newFqn?: string) => void | Promise<void>
) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();
  const { activeDomainEntityRef } = useDomainStore();
  const queryClient = useQueryClient();
  // The intake form is fetched on first open, not when the host page mounts.
  const [loadIntake, setLoadIntake] = useState(false);
  const intake = useGlossaryIntakeForm(loadIntake);
  const form = useForm<GlossaryFormValues>({
    defaultValues: GLOSSARY_FORM_DEFAULTS,
  });
  const handleSubmit = useCallback(
    async (values: GlossaryFormValues) => {
      try {
        const glossary = await addGlossaries(
          transformGlossaryFormData(
            values,
            currentUser?.id,
            intake.customProperties
          )
        );
        // Await the list refresher before navigating so the sidebar is
        // repopulated (page-1 fetch) by the time the URL changes to the new
        // glossary, avoiding a navigation/refetch race.
        await onCreated?.(glossary.fullyQualifiedName);
        navigate(getGlossaryPath(glossary.fullyQualifiedName));
      } catch (error) {
        setCreateEntityFieldError(
          error,
          form,
          'name',
          t('server.entity-already-exist', {
            entity: t('label.glossary'),
            entityPlural: t('label.glossary-lowercase-plural'),
            name: values.name,
          }),
          t('server.add-entity-error', {
            entity: t('label.glossary-lowercase'),
          })
        );

        throw error;
      }
    },
    [currentUser?.id, form, intake.customProperties, navigate, onCreated, t]
  );

  const { formDrawer, openDrawer, closeDrawer } =
    useFormDrawerWithHook<GlossaryFormValues>({
      title: t('label.add-entity', { entity: t('label.glossary') }),
      width: GLOSSARY_FORM_DRAWER_WIDTH,
      closeOnEscape: false,
      className: 'tw:z-[20]',
      testId: 'add-glossary-drawer',
      submitTestId: 'save-glossary',
      cancelTestId: 'cancel-glossary',
      hookForm: form,
      form: (
        <AddGlossary
          form={form}
          intake={intake}
          onSubmit={(values: GlossaryFormValues): Promise<void> =>
            submitAndClose(values, handleSubmit, closeDrawer)
          }
        />
      ),
      onSubmit: (values: GlossaryFormValues): Promise<void> =>
        submitAndClose(values, handleSubmit, closeDrawer),
      loading: form.formState.isSubmitting || !intake.isLoaded,
    });

  // Defaults are rebuilt on every open so the active domain is always current.
  const openCreateDrawer = useCallback(() => {
    setLoadIntake(true);
    // Refetch on every open so an intake form edited since the last open applies.
    void queryClient.invalidateQueries({
      queryKey: ['intake', TargetEntityType.Glossary],
    });
    form.reset({
      ...GLOSSARY_FORM_DEFAULTS,
      domains: activeDomainEntityRef
        ? [toEntityReferenceOption(activeDomainEntityRef)]
        : [],
    });
    openDrawer();
  }, [activeDomainEntityRef, form, openDrawer, queryClient]);

  return { formDrawer, openDrawer: openCreateDrawer, closeDrawer };
};
