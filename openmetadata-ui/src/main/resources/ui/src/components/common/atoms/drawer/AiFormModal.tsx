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
import { FC, ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export interface AiFormModalProps {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  headerActions?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: () => void | Promise<unknown>;
  /** Footer button test ids, defaulted to match the classic test case drawer. */
  submitTestId?: string;
  cancelTestId?: string;
  /**
   * When true, reserve room to the right of the modal for the floating Form Hint
   * popover so the modal+hint read as one centered group (using the full width).
   * When false the modal is centered on its own.
   */
  reserveHintSpace?: boolean;
}

/**
 * Centered modal chrome for the AI-mode Data Quality forms (matches Figma).
 * Renders a core-components Dialog with the AI header (featured icon + title +
 * subtitle on the left, optional `headerActions` such as the Show-Hint toggle on
 * the right), the shared form body as children, and a Cancel/Create footer.
 *
 * The Form Hint popover floats to the right of the focused field (anchored via
 * react-aria). With `reserveHintSpace` the modal slides left (a transitioned
 * translate) by half the hint's footprint so the modal+hint read as one
 * centered group; a resize pump re-measures the popover across the slide so it
 * tracks the modal with no gap. Without it the modal is centered on its own.
 */
export const AiFormModal: FC<AiFormModalProps> = ({
  open,
  title,
  subtitle,
  headerActions,
  hint,
  children,
  isSubmitting,
  onClose,
  onSubmit,
  submitTestId = 'create-btn',
  cancelTestId = 'cancel-btn',
  reserveHintSpace = false,
}) => {
  const { t } = useTranslation();

  // The hint-shown state slides the modal via a 300ms CSS transform, but
  // react-aria only re-measures the floating hint's anchor on window
  // resize/scroll — not while an ancestor transform animates. Pump resize
  // events across the transition window so the hint tracks the modal frame by
  // frame instead of jumping (or lagging behind) once the slide settles.
  useEffect(() => {
    let frame = 0;
    // ~22 frames ≈ 370ms — covers the 300ms slide plus a small settle buffer.
    let remaining = 22;
    if (open) {
      const pump = () => {
        window.dispatchEvent(new Event('resize'));
        remaining -= 1;
        if (remaining > 0) {
          frame = requestAnimationFrame(pump);
        }
      };
      frame = requestAnimationFrame(pump);
    }

    return () => cancelAnimationFrame(frame);
  }, [open, reserveHintSpace]);

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
          className="tw:w-full tw:justify-center tw:gap-4"
          direction="row">
          {/* 820px wide (roomier than the 702px Figma mock). When the hint is
              shown the modal slides left by half the hint's footprint so the
              modal+hint sit centered as a group; the transition animates the
              slide and the resize pump keeps the hint tracking it. Gated at xl
              so the shifted modal never clips the left edge on smaller screens. */}
          <Dialog
            showCloseButton
            className={`tw:max-w-[820px] tw:transition-transform tw:duration-300 tw:ease-in-out${
              reserveHintSpace ? ' tw:xl:-translate-x-[178px]' : ''
            }`}
            width={820}
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
                    <Typography size="text-md" weight="semibold">
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
            <Dialog.Content className="tw:max-h-[calc(100vh-260px)] tw:overflow-y-auto">
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
                {t('label.create')}
              </Button>
            </Dialog.Footer>
          </Dialog>
          {hint}
        </Box>
      </Modal>
    </ModalOverlay>
  );
};
