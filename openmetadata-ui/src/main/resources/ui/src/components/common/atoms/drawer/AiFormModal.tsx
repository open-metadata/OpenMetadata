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

/** Modal width when the Form Hint column is shown, per the approved design. */
const WIDTH_WITH_HINT = 1024;
/** Modal width when the Form Hint column is collapsed. */
const WIDTH_WITHOUT_HINT = 648;
/** Modal width for forms that have no Form Hint column at all. */
const WIDTH_NO_HINT_COLUMN = 820;

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
              max-width. The modal grows/shrinks in place and stays centered —
              the hint is a column inside it, not a floating layer beside it. */}
          <Dialog
            showCloseButton
            className="tw:transition-[max-width] tw:duration-[240ms] tw:ease-in-out"
            width={
              hasHintColumn
                ? hintOpen
                  ? WIDTH_WITH_HINT
                  : WIDTH_WITHOUT_HINT
                : WIDTH_NO_HINT_COLUMN
            }
            onClose={onClose}>
            <Dialog.Header>
              {/* pr-10 reserves room for the absolutely-positioned close button
                  (lg = 44px at right-3) so the Show Hint toggle doesn't sit
                  under the X. */}
              <Box
                align="center"
                className="tw:w-full tw:justify-between tw:gap-3 tw:pr-10"
                direction="row">
                <Box align="center" className="tw:gap-3" direction="row">
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
                {headerActions}
              </Box>
            </Dialog.Header>
            {/* With a hint column the content is a padding-free flex row that
                clips; each column scrolls itself, so neither can drive the
                modal's height. Without one it keeps the single scrolling body. */}
            <Dialog.Content
              className={
                hasHintColumn
                  ? 'tw:max-h-[calc(88vh-152px)] tw:flex-row tw:gap-0 tw:overflow-hidden tw:p-0'
                  : 'tw:max-h-[calc(100vh-260px)] tw:overflow-y-auto'
              }>
              {children}
            </Dialog.Content>
            <Dialog.Footer>
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
