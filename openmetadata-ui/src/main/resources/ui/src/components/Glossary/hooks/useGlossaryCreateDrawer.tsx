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
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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

export const GLOSSARY_FORM_DRAWER_WIDTH = '40vw';

/**
 * The "create glossary" drawer: form, submit and drawer chrome. On success
 * it navigates to the new glossary and runs `onCreated` (e.g. to refresh the
 * glossary list the page already holds).
 */
export const useGlossaryCreateDrawer = (onCreated?: () => void) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();
  const { activeDomainEntityRef } = useDomainStore();
  const form = useForm<GlossaryFormValues>({
    defaultValues: GLOSSARY_FORM_DEFAULTS,
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(
    async (values: GlossaryFormValues) => {
      setIsLoading(true);
      try {
        const glossary = await addGlossaries(
          transformGlossaryFormData(values, currentUser?.id)
        );
        onCreated?.();
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
      } finally {
        setIsLoading(false);
      }
    },
    [currentUser?.id, form, navigate, onCreated, t]
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
          onSubmit={(values: GlossaryFormValues): Promise<void> =>
            submitAndClose(values, handleSubmit, closeDrawer)
          }
        />
      ),
      onSubmit: (values: GlossaryFormValues): Promise<void> =>
        submitAndClose(values, handleSubmit, closeDrawer),
      loading: isLoading,
    });

  // Defaults are rebuilt on every open so the active domain is always current.
  const openCreateDrawer = useCallback(() => {
    form.reset({
      ...GLOSSARY_FORM_DEFAULTS,
      domains: activeDomainEntityRef
        ? [toEntityReferenceOption(activeDomainEntityRef)]
        : [],
    });
    openDrawer();
  }, [activeDomainEntityRef, form, openDrawer]);

  return { formDrawer, openDrawer: openCreateDrawer, closeDrawer };
};
