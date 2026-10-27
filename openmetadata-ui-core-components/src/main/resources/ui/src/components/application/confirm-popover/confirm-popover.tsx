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
import type { FormEvent, ReactElement, ReactNode, RefObject } from 'react';
import { cloneElement, isValidElement, useId, useState } from 'react';
import type { Placement } from 'react-aria';
import { OverlayArrow as AriaOverlayArrow } from 'react-aria-components';
import { Button } from '@/components/base/buttons/button';
import { Typography } from '@/components/foundations/typography';
import { useCoreTranslation } from '@/i18n/useCoreTranslation';
import { cx } from '@/utils/cx';
import { Popover, PopoverTrigger } from '../popover/popover';

/**
 * What an action handler returns. Resolving closes the popover; resolving to
 * `false` keeps it open (e.g. a form that failed validation); rejecting keeps
 * it open too, so the caller can surface the error and the user can retry.
 */
type ActionResult = void | boolean | Promise<void | boolean>;

export interface ConfirmPopoverAction {
  key: string;
  label: ReactNode;
  onPress: () => ActionResult;
  color?:
    | 'secondary'
    | 'primary'
    | 'primary-destructive'
    | 'secondary-destructive';
  isDisabled?: boolean;
  'data-testid'?: string;
}

export interface ConfirmPopoverProps {
  /**
   * The pressable that opens the popover (a core `Button` / `ButtonUtility`).
   * Omit it to anchor to an existing element via `triggerRef` and drive
   * `isOpen` yourself — e.g. when the action lives in a dropdown menu.
   * While open, a string `className` on it gains the active (error/brand) tint;
   * a function `className` is left alone, so style `[aria-expanded]` yourself.
   */
  children?: ReactElement;
  triggerRef?: RefObject<Element | null>;
  isOpen?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Extra body content below the description, e.g. a form field. */
  content?: ReactNode;
  /**
   * Renders the body and footer as a `<form>` whose submit (Enter in a field)
   * runs `onConfirm`, for confirmations that take input. `content` must not
   * render a `<form>` of its own.
   */
  asForm?: boolean;
  onConfirm: () => ActionResult;
  onCancel?: () => void;
  confirmText?: ReactNode;
  cancelText?: ReactNode;
  /** @default 'destructive' */
  variant?: 'destructive' | 'primary';
  isConfirmDisabled?: boolean;
  /** Extra footer actions rendered between Cancel and Confirm. */
  actions?: ConfirmPopoverAction[];
  /** @default 'bottom end' */
  placement?: Placement;
  className?: string;
  'data-testid'?: string;
}

const CONFIRM_KEY = 'confirm';
const BODY_CLASS = 'tw:flex tw:flex-col tw:gap-4 tw:p-4';

// While open, the trigger reads as the target of the pending action.
const ACTIVE_TRIGGER_CLASS = {
  destructive:
    'tw:aria-expanded:bg-error-primary tw:aria-expanded:text-fg-error-primary tw:aria-expanded:outline-1 tw:aria-expanded:outline-error_subtle',
  primary:
    'tw:aria-expanded:bg-brand-primary tw:aria-expanded:text-brand-secondary',
};

/**
 * A lightweight, non-modal confirmation anchored to the control that asked
 * for it. Use it instead of a confirmation modal wherever the page itself is
 * already an overlay (Settings), so the user keeps their context.
 */
export const ConfirmPopover = ({
  children,
  triggerRef,
  isOpen: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  title,
  description,
  content,
  asForm = false,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  variant = 'destructive',
  isConfirmDisabled,
  actions = [],
  placement = 'bottom end',
  className,
  'data-testid': dataTestId = 'confirm-popover',
}: ConfirmPopoverProps) => {
  const { t } = useCoreTranslation();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [pendingKey, setPendingKey] = useState<string>();
  const isOpen = controlledOpen ?? uncontrolledOpen;
  const isPending = pendingKey !== undefined;
  const titleId = useId();

  const setOpen = (open: boolean) => {
    // An action in flight can't be cancelled, so nothing may close the popover.
    if (!open && isPending) {
      return;
    }
    if (controlledOpen === undefined) {
      setUncontrolledOpen(open);
    }
    if (!open) {
      onCancel?.();
    }
    onOpenChange?.(open);
  };

  const run = async (key: string, handler: () => ActionResult) => {
    setPendingKey(key);
    let keepOpen = true;
    try {
      keepOpen = (await handler()) === false;
    } catch {
      // The handler owns error reporting; staying open lets the user retry.
    } finally {
      setPendingKey(undefined);
    }
    if (!keepOpen) {
      if (controlledOpen === undefined) {
        setUncontrolledOpen(false);
      }
      onOpenChange?.(false);
    }
  };

  const confirm = () => run(CONFIRM_KEY, onConfirm);
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isPending && !isConfirmDisabled) {
      void confirm();
    }
  };

  const body = (
    <>
      <div className="tw:flex tw:flex-col tw:gap-1">
        <Typography
          className="tw:text-primary"
          data-testid={`${dataTestId}-title`}
          id={titleId}
          size="text-sm"
          weight="semibold">
          {title}
        </Typography>
        {description && (
          <Typography
            as="div"
            className="tw:text-tertiary tw:break-words"
            data-testid={`${dataTestId}-description`}
            size="text-sm">
            {description}
          </Typography>
        )}
      </div>
      {content}
      <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-2">
        <Button
          color="secondary"
          data-testid={`${dataTestId}-cancel`}
          isDisabled={isPending}
          size="sm"
          onPress={() => setOpen(false)}>
          {cancelText ?? t('label.cancel')}
        </Button>
        {actions.map((action) => (
          <Button
            color={action.color ?? 'secondary'}
            data-testid={action['data-testid']}
            isDisabled={action.isDisabled || isPending}
            isLoading={pendingKey === action.key}
            key={action.key}
            size="sm"
            onPress={() => run(action.key, action.onPress)}>
            {action.label}
          </Button>
        ))}
        <Button
          color={variant === 'destructive' ? 'primary-destructive' : 'primary'}
          data-testid={`${dataTestId}-confirm`}
          isDisabled={
            isConfirmDisabled || (isPending && pendingKey !== CONFIRM_KEY)
          }
          isLoading={pendingKey === CONFIRM_KEY}
          size="sm"
          type={asForm ? 'submit' : 'button'}
          onPress={asForm ? undefined : confirm}>
          {confirmText ??
            (variant === 'destructive' ? t('label.delete') : t('label.ok'))}
        </Button>
      </div>
    </>
  );

  const popover = (
    <Popover
      aria-labelledby={titleId}
      className={cx('tw:w-75 tw:max-w-[calc(100vw-2rem)]', className)}
      isKeyboardDismissDisabled={isPending}
      isOpen={isOpen}
      offset={12}
      placement={placement}
      shouldCloseOnInteractOutside={() => !isPending}
      triggerRef={children ? undefined : triggerRef}
      onOpenChange={setOpen}>
      <AriaOverlayArrow>
        {/* A square turned 45°: its two bordered sides form the point, and half of it sits over the
            popover's edge so it covers the outline where the arrow joins the panel. Drawn here rather
            than through Popover's `arrow` prop, whose filled SVG other (legacy) popovers rely on. */}
        <span className="tw:block tw:size-2.5 tw:translate-y-1/2 tw:rotate-45 tw:border-t tw:border-l tw:border-secondary_alt tw:bg-overlay-surface tw:in-placement-top:-translate-y-1/2 tw:in-placement-top:rotate-[225deg] tw:in-placement-left:translate-y-0 tw:in-placement-left:-translate-x-1/2 tw:in-placement-left:rotate-[135deg] tw:in-placement-right:translate-y-0 tw:in-placement-right:translate-x-1/2 tw:in-placement-right:-rotate-45" />
      </AriaOverlayArrow>
      {asForm ? (
        <form
          noValidate
          className={BODY_CLASS}
          data-testid={dataTestId}
          onSubmit={handleSubmit}>
          {body}
        </form>
      ) : (
        <div className={BODY_CLASS} data-testid={dataTestId}>
          {body}
        </div>
      )}
    </Popover>
  );

  if (!children) {
    return popover;
  }

  const trigger =
    isValidElement<{ className?: unknown }>(children) &&
    (children.props.className === undefined ||
      typeof children.props.className === 'string')
      ? cloneElement(children, {
          className: cx(
            children.props.className as string | undefined,
            ACTIVE_TRIGGER_CLASS[variant]
          ),
        })
      : children;

  return (
    <PopoverTrigger isOpen={isOpen} onOpenChange={setOpen}>
      {trigger}
      {popover}
    </PopoverTrigger>
  );
};
