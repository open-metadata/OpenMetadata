/*
 *  Copyright 2025 Collate.
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
import {
  Box,
  Button,
  Dialog,
  FeaturedIcon,
  Modal,
  ModalOverlay,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { CheckCircle, Lightbulb05 } from '@untitledui/icons';
import classNames from 'classnames';
import { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type FeaturedIconColor = 'brand' | 'gray' | 'success' | 'warning' | 'error';

/** Width of the Form Hint column itself, per the approved design. */
const HINT_COLUMN_WIDTH = 380;
/**
 * Width of the form column. The approved design pairs a 1024px modal with a
 * 642px form, but the real Data Quality form needs the ~772px it had before the
 * hint moved inside the modal — at 642px its test-level cards wrap. The two
 * widths below are derived from this so the form column stays the same width
 * whether the hint is shown or hidden, and only the hint appears/disappears.
 */
const FORM_COLUMN_WIDTH = 772;

/** Modal width when the Form Hint column is shown. */
const WIDTH_WITH_HINT = FORM_COLUMN_WIDTH + HINT_COLUMN_WIDTH;
/** Modal width when the Form Hint column is collapsed. */
const WIDTH_WITHOUT_HINT = FORM_COLUMN_WIDTH;
/** Modal width for forms that have no Form Hint column at all. */
const WIDTH_NO_HINT_COLUMN = 820;

/**
 * The two-column body is capped at `88vh` minus the chrome it shares the
 * viewport with — the header (72px) and the footer (69px), i.e. 141px, both
 * measured in the running modal. Without that subtraction the body claims the
 * full 88vh on its own and the modal overflows its cap by the height of its
 * own header and footer.
 *
 * It is spelled out in the class rather than derived from a constant: Tailwind
 * scans source statically, so an interpolated arbitrary value generates no
 * class at all and the cap would silently vanish. If the header or footer
 * padding changes, re-measure and update `max-h-[calc(88vh-141px)]` below.
 */

export interface AiFormModalProps {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  isSubmitting?: boolean;
  onClose: () => void;
  /**
   * Called when the submit button is pressed. Optional: forms that submit
   * natively via `submitFormId` do not need it.
   */
  onSubmit?: () => void | Promise<unknown>;
  /** Footer button test ids, defaulted to match the classic test case drawer. */
  submitTestId?: string;
  cancelTestId?: string;
  /** Footer submit button label, defaults to the create label. */
  submitLabel?: ReactNode;
  /**
   * Tri-state control for the Form Hint column.
   * - `undefined`: the form has no hint column; single-column layout.
   * - `true`: hint column shown; the modal widens.
   * - `false`: hint column collapsed; the modal narrows.
   *
   * The column itself is rendered by HookForm's `fieldDocDisplay="panel"` mode,
   * because it must live inside FieldDocProvider to read the focused field's
   * doc. This prop only drives the modal's width.
   */
  hintOpen?: boolean;
  /**
   * Toggles the hint column. Supplying it renders the Show Hint control in the
   * header; this modal owns that control because the hint column is what it is
   * for, and three callers had drifted into three copies of the same markup.
   *
   * The boolean stays with the caller rather than being internal state: the
   * form needs it too (`showFieldDocs`), and the form is a child the caller
   * renders, not something this modal owns.
   */
  onHintToggle?: (open: boolean) => void;
  /** Header featured-icon glyph. Defaults to CheckCircle. */
  icon?: FC<{ className?: string }>;
  /** Header featured-icon colour. Defaults to 'gray'. */
  iconColor?: FeaturedIconColor;
  /** Extra footer buttons, rendered between Cancel and the submit button. */
  footerActions?: ReactNode;
  /**
   * When set, the submit button becomes a native form submitter
   * (`form={submitFormId}` + `type="submit"`) instead of calling `onSubmit`.
   * For forms rendered as a `<HookForm id=...>` that submit themselves.
   */
  submitFormId?: string;
  /** Disables the submit button (e.g. while the form is loading). */
  isSubmitDisabled?: boolean;
}

/**
 * Centered modal chrome for the AI-mode Data Quality forms (matches Figma).
 * Renders a core-components Dialog with the AI header (featured icon + title +
 * subtitle on the left, optional `headerActions` such as the Show-Hint toggle on
 * the right), the shared form body as children, and a Cancel/Create footer.
 *
 * When `hintOpen` is defined the body is a two-column layout (form + Form Hint)
 * and the modal animates its own width between the hint-shown and hint-hidden
 * sizes, staying centered in both. It does not translate: the hint is part of
 * the modal, not a floating layer beside it.
 */
export const AiFormModal: FC<AiFormModalProps> = ({
  open,
  title,
  subtitle,
  headerActions,
  children,
  isSubmitting,
  onClose,
  onSubmit,
  submitTestId = 'create-btn',
  cancelTestId = 'cancel-btn',
  hintOpen,
  onHintToggle,
  submitLabel,
  icon = CheckCircle,
  iconColor = 'gray',
  footerActions,
  submitFormId,
  isSubmitDisabled,
}) => {
  const { t } = useTranslation();
  const hasHintColumn = hintOpen !== undefined;

  // The submit handler surfaces failures via an inline alert in the form body
  // and resolves so the modal stays open; swallow the rejection here so React
  // does not log an unhandled promise rejection.
  const handleSubmit = () =>
    Promise.resolve(onSubmit?.()).catch(() => undefined);

  // A form with its own id submits natively; otherwise the button drives
  // onSubmit. Never both — a native submitter that also ran onClick would fire
  // the form twice.
  const submitButtonProps = submitFormId
    ? { form: submitFormId, type: 'submit' as const }
    : { onClick: handleSubmit };

  return (
    <ModalOverlay
      isDismissable
      isOpen={open}
      onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal>
        <Box
          align="start"
          className="tw:w-full tw:justify-center"
          direction="row">
          {/* Dialog applies `width` as max-width, so the transition targets
              max-width. It must go on `panelClassName`, not `className`: the
              latter lands on the outer dialog wrapper, and the modal would then
              snap to its new width while the hint column animated separately —
              the two must move in lockstep or the hint visibly overflows the
              modal mid-transition.
              The modal grows/shrinks in place and stays centered — the hint is
              a column inside it, not a floating layer beside it. */}
          <Dialog
            showCloseButton
            panelClassName="tw:transition-[max-width] tw:duration-[240ms] tw:ease-in-out"
            width={
              hasHintColumn
                ? hintOpen
                  ? WIDTH_WITH_HINT
                  : WIDTH_WITHOUT_HINT
                : WIDTH_NO_HINT_COLUMN
            }
            onClose={onClose}>
            {/* Rule plus shadow, the pairing every sticky edge in the product
                already uses — the SSO form's action bar and the classic test
                case form's both set a 1px @grey-200 border and a shadow
                together, and `@grey-200` is the value `border-secondary`
                resolves to.

                The shadow is `@box-shadow-sticky-reverse` (the one on the
                Explore pagination's top border, which is what design pointed
                at) with the offset mirrored, since this edge casts down rather
                than up. Its 0.078 alpha is the reason it works here: 0.04 was
                invisible against the near-white form column, 0.1 spread into a
                smudge across two columns with different backgrounds.

                `relative z-10` lifts the header over the scrolling body, which
                paints after and would otherwise cover the shadow. Dialog.Header
                ships no bottom padding, so `pb` keeps the subtitle off the
                rule. */}
            <Dialog.Header className="tw:relative tw:z-10 tw:border-b tw:border-secondary tw:pb-4 tw:shadow-[0px_13px_16px_-4px_rgba(10,13,18,0.078)]">
              {/* pr-10 reserves room for the absolutely-positioned close button
                  (lg = 44px at right-3) so the Show Hint toggle doesn't sit
                  under the X. */}
              <Box
                align="center"
                className="tw:w-full tw:justify-between tw:gap-3 tw:pr-10"
                direction="row">
                {/* min-w-0 lets the title block absorb the squeeze (its
                    subtitle wraps) so the actions keep their intrinsic width
                    instead of being compressed into a wrap. */}
                <Box
                  align="center"
                  className="tw:min-w-0 tw:gap-3"
                  direction="row">
                  <FeaturedIcon
                    color={iconColor}
                    icon={icon}
                    radius="md"
                    shape="square"
                    size="md"
                    theme="light"
                  />
                  <Box direction="col">
                    <Typography size="text-md" weight="medium">
                      {title}
                    </Typography>
                    {subtitle && (
                      <Typography className="tw:text-tertiary" size="text-sm">
                        {subtitle}
                      </Typography>
                    )}
                  </Box>
                </Box>
                {/* shrink-0: the Show Hint label + toggle must never be
                    compressed, or the label wraps mid-phrase when the modal
                    narrows. whitespace-nowrap on the label for the same
                    reason. */}
                <Box
                  align="center"
                  className="tw:shrink-0 tw:gap-4"
                  direction="row">
                  {headerActions}
                  {onHintToggle && (
                    <Box align="center" className="tw:gap-2" direction="row">
                      <Lightbulb05 className="tw:size-4 tw:text-secondary" />
                      <Typography
                        className="tw:whitespace-nowrap tw:text-secondary"
                        size="text-sm"
                        weight="medium">
                        {t('label.show-hint')}
                      </Typography>
                      <Toggle
                        aria-label={t('label.show-hint')}
                        data-testid="show-hint-toggle"
                        isSelected={hintOpen}
                        size="sm"
                        onChange={onHintToggle}
                      />
                    </Box>
                  )}
                </Box>
              </Box>
            </Dialog.Header>
            {/* With a hint column the content is a padding-free flex row that
                clips; each column scrolls itself, so neither can drive the
                modal's height. Without one it keeps the single scrolling body.
                `sm:p-0` is required alongside `p-0`: Dialog.Content ships a
                responsive `sm:px-6`, and tailwind-merge treats a variant class
                as a different group from its base, so `p-0` alone leaves 24px
                of side padding at sm and up. That padding stops the hint column
                reaching the modal edge and steals width from the form. */}
            <Dialog.Content
              className={
                hasHintColumn
                  ? 'tw:max-h-[calc(88vh-141px)] tw:flex-row tw:gap-0 tw:overflow-hidden tw:p-0 tw:sm:p-0'
                  : 'tw:max-h-[calc(100vh-260px)] tw:overflow-y-auto'
              }>
              {children}
            </Dialog.Content>
            {/* Dialog.Footer ships `mt-6 sm:mt-8`, which suits a padded
                single-column dialog but leaves 32px of white between the
                columns and the footer here — the hint column visibly stops
                short of it. The columns already run to the modal's edges, so
                the footer sits directly against them. */}
            {/* Dialog.Footer already carries the rule and z-10; this adds the
                matching shadow, cast upward — the orientation the token was
                written for. */}
            <Dialog.Footer
              className={classNames(
                'tw:shadow-[0px_-13px_16px_-4px_rgba(10,13,18,0.078)]',
                { 'tw:mt-0 tw:sm:mt-0': hasHintColumn }
              )}>
              <Button
                color="secondary"
                data-testid={cancelTestId}
                onClick={onClose}>
                {t('label.cancel')}
              </Button>
              {footerActions}
              <Button
                color="primary"
                data-testid={submitTestId}
                isDisabled={isSubmitDisabled}
                isLoading={isSubmitting}
                {...submitButtonProps}>
                {submitLabel ?? t('label.create')}
              </Button>
            </Dialog.Footer>
          </Dialog>
        </Box>
      </Modal>
    </ModalOverlay>
  );
};
