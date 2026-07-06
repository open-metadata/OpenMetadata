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
}

/**
 * Centered modal chrome for the AI-mode Data Quality forms (matches Figma).
 * Renders a core-components Dialog with the AI header (featured icon + title +
 * subtitle on the left, optional `headerActions` such as the Show-Hint toggle on
 * the right), the shared form body as children, and a Cancel/Create footer.
 *
 * The optional `hint` card floats to the right of the modal: the overlay lays
 * the modal and the hint out as a single centered horizontal group.
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
}) => {
  const { t } = useTranslation();

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
        <Box align="start" className="tw:gap-4" direction="row">
          {/* 702px panel matches the Figma modal width */}
          <Dialog
            showCloseButton
            className="tw:max-w-[702px]"
            width={702}
            onClose={onClose}>
            <Dialog.Header>
              <Box
                align="center"
                className="tw:w-full tw:justify-between tw:gap-3"
                direction="row">
                <Box align="center" className="tw:gap-3" direction="row">
                  <FeaturedIcon
                    color="brand"
                    icon={CheckCircle}
                    radius="md"
                    shape="square"
                    size="md"
                    theme="light"
                  />
                  <Box direction="col">
                    <Typography size="text-lg" weight="semibold">
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
            <Dialog.Content className="tw:max-h-[875px] tw:overflow-y-auto">
              {children}
            </Dialog.Content>
            <Dialog.Footer>
              <Button color="secondary" onClick={onClose}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
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
