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

import { Box, HookForm } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { noop } from 'lodash';
import React, {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  FORM_DRAWER_WIDTH_WITHOUT_HINT,
  FORM_DRAWER_WIDTH_WITH_HINT,
} from '../../../../constants/common/formHint.constants';
import { createScrollToErrorHandler } from '../../../../utils/formPureUtils';
import { FormHintDoc } from './formHint/FormHintDoc';
import { FormHintEmptyState } from './formHint/FormHintEmptyState';
import { FormHintHeader } from './formHint/FormHintHeader';
import { ShowHintToggle } from './ShowHintToggle';
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
  /** Loading shown only on the submit button (no body overlay). */
  submitLoading?: boolean;
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
    submitLoading = false,
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
        color: 'tertiary',
        testId: cancelTestId,
        onClick: () => closeRef.current(),
      },
      primaryButton: {
        label: submitLabel,
        color: 'primary',
        testId: submitTestId,
        loading: loading || isSubmitting || submitLoading,
        disabled: loading || isSubmitting || submitLoading,
        onClick: async () => {
          try {
            setIsSubmitting(true);
            await onSubmit({} as T);
            // Don't close drawer here - let consumer handle it after successful API call
          } catch {
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

export interface FormDrawerHintConfig {
  /**
   * `false` hides the Form Hint column and its Show Hint toggle while keeping
   * the two-column form layout, so the form does not remount. Default `true`.
   */
  enabled?: boolean;
  /** Renders the active field's doc. Defaults to `FormHintDoc`. */
  renderDoc?: (markdown: string) => ReactNode;
  /** Classes for the scrolling form column, added to the default padding. */
  formClassName?: string;
}

export type FormDrawerWithHookConfig<T extends FieldValues> = Omit<
  FormDrawerConfig<T>,
  'onSubmit'
> & {
  hookForm: UseFormReturn<T>;
  onSubmit: (data: T) => Promise<void> | void;
  /**
   * Wraps `form` in a HookForm with a Form Hint column beside it and adds the
   * Show Hint toggle to the header. The drawer widens and narrows with the
   * column unless `width` is set. Pass the form's fields as `form`, not a
   * HookForm.
   */
  formHint?: FormDrawerHintConfig;
  /** Controls the drawer: it opens when `true` and closes when `false`. */
  open?: boolean;
};

const renderDefaultFormHintDoc = (markdown: string) => (
  <FormHintDoc markdown={markdown} />
);

/**
 * Form drawer variant backed by a react-hook-form `UseFormReturn` instance.
 *
 * The caller owns the form state via `useForm()` from react-hook-form and
 * passes it in; the drawer delegates to `hookForm.handleSubmit()` so that RHF
 * manages the full submission lifecycle (including `formState.isSubmitting` and
 * `formState.isSubmitSuccessful`). On validation failure the drawer scrolls to
 * the first invalid field. On cancel the form is reset before any
 * caller-supplied `onCancel` handler runs.
 */
export const useFormDrawerWithHook = <T extends FieldValues>(
  config: FormDrawerWithHookConfig<T>
) => {
  const { hookForm, onSubmit, onCancel, formHint, open, ...rest } = config;
  const [showHint, setShowHint] = useState(true);
  const scrollToError = useMemo(
    () =>
      createScrollToErrorHandler({
        errorSelector: '[aria-invalid="true"], [data-invalid="true"]',
      }),
    []
  );

  const handleFormSubmit = useCallback(
    (event?: FormEvent) =>
      hookForm.handleSubmit(
        async (data) => onSubmit(data),
        () => scrollToError()
      )(event),
    [hookForm, onSubmit, scrollToError]
  );

  const handleSubmit = useCallback(
    () => handleFormSubmit(),
    [handleFormSubmit]
  );

  const handleCancel = useCallback(() => {
    hookForm.reset();
    onCancel?.();
  }, [hookForm, onCancel]);

  const isHintShown = Boolean(formHint) && formHint?.enabled !== false;

  const formHintConfig: Partial<FormDrawerConfig<T>> = formHint
    ? {
        form: (
          <HookForm
            emptyFieldDoc={<FormHintEmptyState />}
            fieldDocDisplay="panel"
            fieldDocHeader={<FormHintHeader />}
            form={hookForm}
            // The form column, not the drawer body, scrolls, so it carries the
            // padding and is the scroll-to-error target.
            formClassName={classNames(
              'drawer-form-content tw:px-4 tw:py-6 tw:md:px-6',
              formHint.formClassName
            )}
            renderFieldDoc={formHint.renderDoc ?? renderDefaultFormHintDoc}
            showFieldDocs={isHintShown && showHint}
            // The footer path catches submit errors in useFormDrawer; Enter in
            // a field submits here, where nothing awaits the promise.
            onSubmit={(event) => {
              handleFormSubmit(event).catch(noop);
            }}>
            {rest.form}
          </HookForm>
        ),
        headerActions: (
          <>
            {rest.headerActions}
            {isHintShown && (
              // pr-10 clears the header's absolutely positioned close button.
              <Box className="tw:pr-10">
                <ShowHintToggle isSelected={showHint} onChange={setShowHint} />
              </Box>
            )}
          </>
        ),
        // Both columns scroll on their own: drop Content's padding, gap and
        // stacking.
        body: {
          ...rest.body,
          className: classNames(
            'tw:flex-row tw:gap-0 tw:px-0 tw:md:px-0',
            rest.body?.className
          ),
        },
        animateWidth: true,
        // Without the hint, narrow the drawer instead of stretching the form.
        width:
          rest.width ??
          (isHintShown && showHint
            ? FORM_DRAWER_WIDTH_WITH_HINT
            : FORM_DRAWER_WIDTH_WITHOUT_HINT),
      }
    : {};

  const drawer = useFormDrawer<T>({
    ...rest,
    ...formHintConfig,
    onCancel: handleCancel,
    onSubmit: handleSubmit,
  });
  const { openDrawer, closeDrawer, isOpen } = drawer;

  useEffect(() => {
    if (open === undefined) {
      return;
    }
    if (open) {
      openDrawer();
    } else if (isOpen) {
      closeDrawer();
    }
  }, [open, isOpen, openDrawer, closeDrawer]);

  return { ...drawer, showHint };
};
