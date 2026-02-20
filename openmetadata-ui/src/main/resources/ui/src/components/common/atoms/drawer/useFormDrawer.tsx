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

import classNames from 'classnames';
import React, { ReactNode, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createScrollToErrorHandler } from '../../../../utils/formUtils';
import {
  CompositeDrawerConfig,
  useCompositeDrawer,
} from './useCompositeDrawer';

export interface FormDrawerConfig<T> extends CompositeDrawerConfig {
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
  closeOnEscape?: boolean;
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
export const useFormDrawer = <T,>(config: FormDrawerConfig<T>) => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create a mutable ref to hold the close function
  const closeRef = React.useRef<() => void>(() => {
    // Placeholder function until drawer is created
  });

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
    closeOnEscape,
    header = {},
    body = {},
    footer = {},
    ...drawerConfig
  } = config;

  const compositeDrawer = useCompositeDrawer({
    ...drawerConfig,
    closeOnEscape,
    onBeforeClose: onCancel, // Call onCancel before closing
    header: {
      title,
      // onClose will be handled by useCompositeDrawer with onBeforeClose
      actions: headerActions,
      ...header,
    },
    body: {
      ...body,
      children: form,
      loading: loading || isSubmitting,
      className: classNames('drawer-form-content', body?.className),
    },
    footer: {
      align: footerAlign,
      secondaryButton: {
        label: cancelLabel,
        variant: 'text',
        testId: cancelTestId,
        onClick: () => closeRef.current(),
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
            // Don't close drawer here - let consumer handle it after successful API call
          } catch (error) {
            // Form submission error handled by caller
          } finally {
            setIsSubmitting(false);
          }
        },
      },
      ...footer,
    },
  });

  // Now set the close function in the ref
  closeRef.current = compositeDrawer.closeDrawer;

  return {
    formDrawer: compositeDrawer.compositeDrawer,
    isSubmitting: loading || isSubmitting,
    openDrawer: compositeDrawer.openDrawer,
    closeDrawer: compositeDrawer.closeDrawer,
    toggleDrawer: compositeDrawer.toggleDrawer,
    isOpen: compositeDrawer.isOpen,
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
export const useFormDrawerWithRef = <T,>(
  config: FormDrawerConfig<T> & {
    formRef?: { submit: () => void; validateFields?: () => Promise<T> };
  }
) => {
  const { formRef, onSubmit, ...restConfig } = config;

  const scrollToError = useMemo(() => createScrollToErrorHandler(), []);

  const handleSubmit = useCallback(async () => {
    if (formRef?.validateFields) {
      let values: T;
      try {
        values = await formRef.validateFields();
      } catch {
        scrollToError();

        return;
      }
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
  }, [formRef, onSubmit, scrollToError]);

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
