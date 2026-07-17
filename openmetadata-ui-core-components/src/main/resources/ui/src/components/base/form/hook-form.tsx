import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { createContext, useContext, useId } from 'react';
import { Form as AriaForm } from 'react-aria-components';
import type {
  Control,
  FieldPath,
  FieldValues,
  UseControllerReturn,
  UseFormReturn,
} from 'react-hook-form';
import { FormProvider, useController, useFormContext } from 'react-hook-form';
import { cx } from '@/utils/cx';
import { FieldDocProvider } from '../../application/form-field/field-doc-context';
import { FieldDocPanel } from '../../application/form-field/field-doc-panel';
import { FieldDocPopover } from '../../application/form-field/field-doc-popover';

interface FormProps<TFieldValues extends FieldValues = FieldValues>
  extends ComponentPropsWithoutRef<typeof AriaForm> {
  form: UseFormReturn<TFieldValues>;
  children: ReactNode;
  showFieldDocs?: boolean;
  renderFieldDoc?: (doc: string) => ReactNode;
  fieldDocHeader?: ReactNode;
  fieldDocOffset?: number;
  fieldDocMaxHeight?: number;
  /**
   * 'popover' (default) floats the doc next to the focused field.
   * 'panel' renders it as a column beside the form, inside the same surface.
   */
  fieldDocDisplay?: 'popover' | 'panel';
  /** Panel-only: shown when no documented field has focus. */
  emptyFieldDoc?: ReactNode;
  /** Panel-only: classes for the scrolling form column (padding, etc). */
  formClassName?: string;
}

interface FormFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
  name: TName;
  control: Control<TFieldValues>;
  rules?: Omit<
    import('react-hook-form').RegisterOptions<TFieldValues, TName>,
    'valueAsNumber' | 'valueAsDate' | 'setValueAs' | 'disabled'
  >;
  children:
    | ReactNode
    | ((control: UseControllerReturn<TFieldValues, TName>) => ReactNode);
}

interface FormFieldContextValues<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
  id: string;
  name: TName;
  control?: UseControllerReturn<TFieldValues, TName>;
}

const FormFieldContext = createContext<FormFieldContextValues | undefined>(
  undefined
);

export const useFormFieldContext = () => {
  const context = useContext(FormFieldContext);

  if (!context) {
    throw new Error(
      "The 'useFormFieldContext' hook must be used within a '<FormField />'"
    );
  }

  const { getFieldState, formState } = useFormContext();
  const fieldState = getFieldState(context.name, formState);

  return { ...context, ...fieldState };
};

export const HookForm = <TFieldValues extends FieldValues = FieldValues>({
  form,
  showFieldDocs = false,
  renderFieldDoc,
  fieldDocHeader,
  fieldDocOffset,
  fieldDocMaxHeight,
  fieldDocDisplay = 'popover',
  emptyFieldDoc,
  formClassName,
  ...props
}: FormProps<TFieldValues>) => {
  const isPanel = fieldDocDisplay === 'panel';

  // Always keep the same tree shape (FormProvider > FieldDocProvider > AriaForm)
  // so toggling showFieldDocs never remounts the form and resets its state.
  // FieldDocProvider is a no-op when disabled, and adds no DOM.
  //
  // The panel is rendered here rather than by the caller because it reads the
  // active field from FieldDocProvider: rendered as a sibling of this form it
  // would fall outside the provider and always be empty.
  return (
    <FormProvider {...form}>
      <FieldDocProvider enabled={showFieldDocs}>
        {isPanel ? (
          <div className="tw:flex tw:h-full tw:min-h-0 tw:w-full tw:flex-row">
            {/* min-w-95 (380px) is load-bearing: without a floor on the form,
                the hint's 380px is reserved first and the form merely grows
                into what is left, so the hint's shrink never fires (there is no
                overflow to distribute) and the form gets crushed on narrow
                viewports instead. */}
            <AriaForm
              {...props}
              className={cx(
                'tw:min-w-95 tw:flex-1 tw:overflow-y-auto',
                formClassName,
                props.className as string | undefined
              )}
            />
            {/* Stays mounted and animates 380 -> 0 so toggling never remounts
                the form. shrink + min-w-65 (260px) lets the hint give ground on
                narrow screens; overflow-hidden clips the inner column so its
                text does not reflow while the collapse animates. */}
            <div
              className={cx(
                'tw:shrink tw:overflow-hidden tw:transition-[width,min-width] tw:duration-[240ms] tw:ease-in-out',
                showFieldDocs ? 'tw:min-w-65' : 'tw:min-w-0'
              )}
              style={{ width: showFieldDocs ? 380 : 0 }}>
              <div className="tw:h-full tw:w-full tw:min-w-65 tw:border-l tw:border-secondary tw:bg-secondary">
                <FieldDocPanel
                  emptyState={emptyFieldDoc}
                  header={fieldDocHeader}
                  renderDoc={renderFieldDoc}
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            <AriaForm {...props} />
            {showFieldDocs ? (
              <FieldDocPopover
                header={fieldDocHeader}
                maxHeight={fieldDocMaxHeight}
                offset={fieldDocOffset}
                renderDoc={renderFieldDoc}
              />
            ) : null}
          </>
        )}
      </FieldDocProvider>
    </FormProvider>
  );
};

HookForm.displayName = 'HookForm';

export const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  children,
  ...props
}: FormFieldProps<TFieldValues, TName>) => {
  const id = 'form-item-' + useId();
  const control = useController(props);
  const withValidationBehavior = {
    ...control,
    field: {
      ...control.field,
      validationBehavior: 'aria',
    },
  };

  return (
    <FormFieldContext.Provider
      value={{
        id,
        name: props.name,
        control: control as unknown as UseControllerReturn<FieldValues, string>,
      }}>
      {children &&
        (typeof children === 'function'
          ? children(withValidationBehavior)
          : children)}
    </FormFieldContext.Provider>
  );
};

FormField.displayName = 'FormField';
