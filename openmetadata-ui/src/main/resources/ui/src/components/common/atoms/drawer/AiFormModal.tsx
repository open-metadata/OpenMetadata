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
  Typography,
} from '@openmetadata/ui-core-components';
import { CheckCircle } from '@untitledui/icons';
import { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

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
 * viewport with — the header (~88px including its bottom padding) and the
 * footer (~69px), i.e. 157px. Without that subtraction the body claims the
 * full 88vh on its own and the modal overflows its cap by the height of its
 * own header and footer.
 *
 * It is spelled out in the class rather than derived from a constant: Tailwind
 * scans source statically, so an interpolated arbitrary value generates no
 * class at all and the cap would silently vanish. If the header or footer
 * padding changes, re-measure and update `max-h-[calc(88vh-157px)]` below.
 */

export interface AiFormModalProps {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: () => void | Promise<unknown>;
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
  submitLabel,
}) => {
  const { t } = useTranslation();
  const hasHintColumn = hintOpen !== undefined;

  // The submit handler surfaces failures via an inline alert in the form body
  // and resolves so the modal stays open; swallow the rejection here so React
  // does not log an unhandled promise rejection.
  const handleSubmit = () => Promise.resolve(onSubmit()).catch(() => undefined);

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
            {/* Dialog.Header ships no bottom padding, so the body would sit
                flush against the title. */}
            <Dialog.Header className={hasHintColumn ? 'tw:pb-5' : undefined}>
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
                    color="gray"
                    icon={CheckCircle}
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
                {/* shrink-0: the actions (e.g. the Show Hint label + toggle)
                    must never be compressed, or the label wraps mid-phrase when
                    the modal narrows. */}
                <Box align="center" className="tw:shrink-0" direction="row">
                  {headerActions}
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
                  ? 'tw:max-h-[calc(88vh-157px)] tw:flex-row tw:gap-0 tw:overflow-hidden tw:p-0 tw:sm:p-0'
                  : 'tw:max-h-[calc(100vh-260px)] tw:overflow-y-auto'
              }>
              {children}
            </Dialog.Content>
            {/* Dialog.Footer ships `mt-6 sm:mt-8`, which suits a padded
                single-column dialog but leaves 32px of white between the
                columns and the footer here — the hint column visibly stops
                short of it. The columns already run to the modal's edges, so
                the footer sits directly against them. */}
            <Dialog.Footer
              className={hasHintColumn ? 'tw:mt-0 tw:sm:mt-0' : undefined}>
              <Button
                color="secondary"
                data-testid={cancelTestId}
                onClick={onClose}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid={submitTestId}
                isLoading={isSubmitting}
                onClick={handleSubmit}>
                {submitLabel ?? t('label.create')}
              </Button>
            </Dialog.Footer>
          </Dialog>
        </Box>
      </Modal>
    </ModalOverlay>
  );
};
