/*
 *  Copyright 2024 Collate.
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

import { ReactNode, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CompositeDrawerConfig,
  useCompositeDrawer,
} from './useCompositeDrawer';

export interface FormDrawerConfig<T = any>
  extends Omit<CompositeDrawerConfig, 'header' | 'footer' | 'body'> {
  title: string | ReactNode;
  form: ReactNode;
  onSubmit: (data: T) => Promise<void> | void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  submitTestId?: string;
  cancelTestId?: string;
  headerActions?: ReactNode;
  footerAlign?: 'left' | 'center' | 'right' | 'space-between';
}

/**
 * Specialized drawer hook for forms with submit/cancel pattern
 *
 * @description
 * High-level hook specifically designed for form drawers.
 * Handles common form patterns like submit, cancel, and loading states.
 *
 * @param config.title - Form title
 * @param config.form - Form component to render
 * @param config.onSubmit - Submit handler
 * @param config.onCancel - Cancel handler
 * @param config.submitLabel - Submit button label
 * @param config.cancelLabel - Cancel button label
 * @param config.loading - Loading state
 * @param config.headerActions - Optional header actions
 * @param config.footerAlign - Footer button alignment
 *
 * @example
 * ```typescript
 * const formDrawer = useFormDrawer({
 *   title: 'Create User',
 *   form: <UserForm ref={formRef} />,
 *   onSubmit: async (data) => {
 *     await createUser(data);
 *   },
 *   loading: isCreating
 * });
 *
 * return (
 *   <>
 *     <Button onClick={formDrawer.openDrawer}>Create User</Button>
 *     {formDrawer.formDrawer}
 *   </>
 * );
 * ```
 */
export const useFormDrawer = <T = any,>(config: FormDrawerConfig<T>) => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    title,
    form,
    onSubmit,
    onCancel,
    submitLabel = t('label.save'),
    cancelLabel = t('label.cancel'),
    loading = false,
    submitTestId = 'save-btn',
    cancelTestId = 'cancel-btn',
    headerActions,
    footerAlign = 'right',
    ...drawerConfig
  } = config;

  const compositeDrawer = useCompositeDrawer({
    ...drawerConfig,
    header: {
      title,
      onClose: () => {
        onCancel?.();
        compositeDrawer?.closeDrawer();
      },
      actions: headerActions,
    },
    body: {
      children: form,
      loading: loading || isSubmitting,
    },
    footer: {
      align: footerAlign,
      secondaryButton: {
        label: cancelLabel,
        variant: 'text',
        testId: cancelTestId,
        onClick: () => {
          onCancel?.();
          compositeDrawer?.closeDrawer();
        },
      },
      primaryButton: {
        label: submitLabel,
        variant: 'contained',
        testId: submitTestId,
        loading: loading || isSubmitting,
        disabled: loading || isSubmitting,
        onClick: async () => {
          try {
            setIsSubmitting(true);
            await onSubmit({} as T);
            compositeDrawer?.closeDrawer();
          } catch (error) {
            // Form submission error handled by caller
          } finally {
            setIsSubmitting(false);
          }
        },
      },
    },
  });

  return {
    ...compositeDrawer,
    formDrawer: compositeDrawer.compositeDrawer,
    isSubmitting: loading || isSubmitting,
  };
};

/**
 * Form drawer with external form ref for validation
 *
 * @description
 * Variant that accepts a form ref for external validation control
 *
 * @example
 * ```typescript
 * const [form] = useForm();
 *
 * const formDrawer = useFormDrawerWithRef({
 *   title: 'Edit Profile',
 *   form: <ProfileForm formRef={form} />,
 *   formRef: form,
 *   onSubmit: async () => {
 *     const values = await form.validateFields();
 *     await updateProfile(values);
 *   }
 * });
 * ```
 */
export const useFormDrawerWithRef = <T = any,>(
  config: FormDrawerConfig<T> & {
    formRef?: { submit: () => void; validateFields?: () => Promise<any> };
  }
) => {
  const { formRef, onSubmit, ...restConfig } = config;

  const handleSubmit = useCallback(async () => {
    if (formRef?.validateFields) {
      // Validate first
      const values = await formRef.validateFields();
      // If validation passes, submit the form
      if (formRef?.submit) {
        formRef.submit();
      } else {
        await onSubmit(values);
      }
    } else if (formRef?.submit) {
      formRef.submit();
    } else {
      await onSubmit({} as T);
    }
  }, [formRef, onSubmit]);

  const drawer = useFormDrawer({
    ...restConfig,
    onSubmit: handleSubmit,
  });

  const submitForm = useCallback(() => {
    if (formRef?.submit) {
      formRef.submit();
    }
  }, [formRef]);

  return {
    ...drawer,
    submitForm,
  };
};
