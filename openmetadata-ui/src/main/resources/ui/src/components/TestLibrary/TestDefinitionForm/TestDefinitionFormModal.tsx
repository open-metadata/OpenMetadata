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

export interface TestDefinitionFormModalProps {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  isSubmitting?: boolean;
  submitLabel?: ReactNode;
  onClose: () => void;
  onSubmit: () => void | Promise<unknown>;
}

/**
 * Centered modal chrome for the AI-mode Test Definition form. Deliberately a
 * local, self-contained mirror of the shared `AiFormModal` (minus the deferred
 * Form-Hint/`reserveHintSpace` logic, `headerActions`, and the resize pump
 * used to track the floating hint popover). Swap to `AiFormModal` once the
 * reference form-doc primitive lands on `main`.
 */
const TestDefinitionFormModal: FC<TestDefinitionFormModalProps> = ({
  open,
  title,
  subtitle,
  children,
  isSubmitting,
  submitLabel,
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
        <Box
          align="start"
          className="tw:w-full tw:justify-center tw:gap-4"
          direction="row">
          <Dialog showCloseButton width={820} onClose={onClose}>
            <Dialog.Header>
              <Box
                align="center"
                className="tw:w-full tw:gap-3 tw:pr-10"
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
            </Dialog.Header>
            <Dialog.Content className="tw:max-h-[calc(100vh-260px)] tw:overflow-y-auto">
              {children}
            </Dialog.Content>
            <Dialog.Footer>
              <Button
                color="secondary"
                data-testid="cancel-btn"
                onClick={onClose}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="create-btn"
                isLoading={isSubmitting}
                onClick={handleSubmit}>
                {submitLabel ?? t('label.save')}
              </Button>
            </Dialog.Footer>
          </Dialog>
        </Box>
      </Modal>
    </ModalOverlay>
  );
};

export default TestDefinitionFormModal;
