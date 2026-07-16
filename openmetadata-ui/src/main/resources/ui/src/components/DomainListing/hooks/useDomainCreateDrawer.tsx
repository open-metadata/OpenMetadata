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
import { EntityType } from '../../../enums/entity.enum';
import { CreateDomain } from '../../../generated/api/domains/createDomain';
import { addDomains, patchDomains } from '../../../rest/domainAPI';
import { createEntityWithCoverImage } from '../../../utils/CoverImageUploadUtils';
import { submitAndClose } from '../../../utils/FormDrawerUtils';
import { useFormDrawerWithHook } from '../../common/atoms/drawer';
import AddDomainForm, {
  DOMAIN_FORM_DEFAULTS,
  transformDomainFormData,
} from '../../Domain/AddDomainForm/AddDomainForm.component';
import { DomainFormValues } from '../../Domain/AddDomainForm/AddDomainForm.interface';
import { DomainFormType } from '../../Domain/DomainPage.interface';

/**
 * Encapsulates the "create domain" drawer — form, submit (with cover-image
 * upload), and the drawer chrome — so any surface (the domains list page, the
 * Data Marketplace overview "Add New" menu) can open the same drawer.
 * `onCreated` runs after a successful create (e.g. the list page refetches).
 */
export const useDomainCreateDrawer = (onCreated?: () => void) => {
  const { t } = useTranslation();
  const form = useForm<DomainFormValues>({
    defaultValues: DOMAIN_FORM_DEFAULTS,
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(
    async (data: DomainFormValues) => {
      const formData = transformDomainFormData(
        data,
        DomainFormType.DOMAIN
      ) as CreateDomain;
      setIsLoading(true);
      try {
        await createEntityWithCoverImage({
          formData,
          entityType: EntityType.DOMAIN,
          entityLabel: t('label.domain'),
          entityPluralLabel: 'domains',
          createEntity: addDomains,
          patchEntity: patchDomains,
          onSuccess: () => {
            form.reset();
          },
          t,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [form, t]
  );

  const { formDrawer, openDrawer, closeDrawer } =
    useFormDrawerWithHook<DomainFormValues>({
      title: t('label.add-entity', { entity: t('label.domain') }),
      width: 670,
      closeOnEscape: false,
      className: 'tw:z-[20]',
      hookForm: form,
      form: (
        <AddDomainForm
          isFormInDialog
          form={form}
          loading={isLoading}
          type={DomainFormType.DOMAIN}
          onCancel={() => {}}
          onSubmit={(data: DomainFormValues): Promise<void> =>
            submitAndClose(data, handleSubmit, closeDrawer, onCreated)
          }
        />
      ),
      onSubmit: (data: DomainFormValues): Promise<void> =>
        submitAndClose(data, handleSubmit, closeDrawer, onCreated),
      loading: isLoading,
    });

  return { formDrawer, openDrawer, closeDrawer };
};
