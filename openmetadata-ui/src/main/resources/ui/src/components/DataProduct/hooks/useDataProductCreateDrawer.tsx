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
import { CreateDataProduct } from '../../../generated/api/domains/createDataProduct';
import {
  addDataProducts,
  patchDataProduct,
} from '../../../rest/dataProductAPI';
import { createEntityWithCoverImage } from '../../../utils/CoverImageUploadUtils';
import {
  setCreateEntityFieldError,
  submitAndClose,
} from '../../../utils/FormDrawerUtils';
import { useFormDrawerWithHook } from '../../common/atoms/drawer';
import AddDomainForm, {
  DOMAIN_FORM_DEFAULTS,
  transformDomainFormData,
} from '../../Domain/AddDomainForm/AddDomainForm.component';
import { DomainFormValues } from '../../Domain/AddDomainForm/AddDomainForm.interface';
import { DomainFormType } from '../../Domain/DomainPage.interface';

/**
 * Encapsulates the "create data product" drawer — form, submit (with
 * cover-image upload), and the drawer chrome — so any surface (the data
 * products list page, the Data Marketplace overview "Add New" menu) can open
 * the same drawer. `onCreated` runs after a successful create.
 */
export const useDataProductCreateDrawer = (onCreated?: () => void) => {
  const { t } = useTranslation();
  const form = useForm<DomainFormValues>({
    defaultValues: DOMAIN_FORM_DEFAULTS,
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(
    async (data: DomainFormValues) => {
      const formData = transformDomainFormData(
        data,
        DomainFormType.DATA_PRODUCT
      ) as CreateDataProduct;
      setIsLoading(true);
      try {
        await createEntityWithCoverImage({
          formData,
          entityType: EntityType.DATA_PRODUCT,
          entityLabel: t('label.data-product'),
          entityPluralLabel: 'data-products',
          createEntity: addDataProducts,
          patchEntity: patchDataProduct,
          onSuccess: () => {
            form.reset();
          },
          t,
          suppressErrorToast: true,
        });
      } catch (error) {
        setCreateEntityFieldError(
          error,
          form,
          'name',
          t('message.entity-with-name-already-exists', {
            entity: t('label.data-product'),
          }),
          t('server.add-entity-error', {
            entity: t('label.data-product').toLowerCase(),
          })
        );

        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [form, t]
  );

  const { formDrawer, openDrawer, closeDrawer } =
    useFormDrawerWithHook<DomainFormValues>({
      title: t('label.add-entity', { entity: t('label.data-product') }),
      width: 670,
      closeOnEscape: false,
      className: 'tw:z-[20]',
      hookForm: form,
      form: (
        <AddDomainForm
          isFormInDialog
          form={form}
          loading={isLoading}
          type={DomainFormType.DATA_PRODUCT}
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
