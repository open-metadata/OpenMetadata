/*
 *  Copyright 2022 Collate.
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
  Button,
  Dialog,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmationModalProps } from './ConfirmationModal.interface';

/**
 * Modal to show confirmation on varios page
 * @param param0
 * @returns
 */
const ConfirmationModal = ({
  isLoading,
  cancelText,
  confirmText,
  header,
  headerClassName = '',
  bodyClassName = '',
  footerClassName = '',
  confirmButtonCss = '',
  cancelButtonCss = '',
  onConfirm,
  onCancel,
  bodyText,
  className,
  visible,
}: ConfirmationModalProps) => {
  const { t } = useTranslation();
  const headerId = useId();
  const bodyId = useId();

  return (
    // `maskClosable={false}` -> `isDismissable={false}`: a confirmation is
    // often destructive, so a stray backdrop click must not answer it.
    <ModalOverlay
      // Core's overlay is z-50; antd's Drawer and Modal roots are z-1000, and
      // several callers open this from inside one (AnnouncementDrawer ->
      // AnnouncementThreadBody -> here). Sit above antd's stack until those
      // overlays move to core, or the prompt opens under their mask.
      className="tw:z-[1001]"
      isDismissable={false}
      isOpen={visible}
      onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <Modal>
        <Dialog
          // react-aria names a Dialog from a title-slot Heading, which this
          // does not use — the header is a node carrying a test id. Without
          // this the dialog is announced unnamed and react-aria warns. The
          // SCIM caller passes an empty header and titles itself in the body,
          // so fall back to that.
          aria-labelledby={header ? headerId : bodyId}
          data-testid="confirmation-modal"
          // antd's `className` landed on `.ant-modal`, which is the panel —
          // core's `className` is the outer wrapper, so styling goes here.
          panelClassName={className}
          // Dialog defaults to 688; antd's Modal defaulted to 520. Keep the
          // prompt the width every caller was already getting.
          width={520}
          onClose={onCancel}>
          {/* Rendered only when there is a header: the SCIM delete prompt
              passes an empty one and supplies its own heading in the body,
              which antd handled by hiding the header with CSS. */}
          {header && (
            <Dialog.Header>
              <Typography
                className={headerClassName}
                data-testid="modal-header"
                id={headerId}
                weight="semibold">
                {header}
              </Typography>
            </Dialog.Header>
          )}
          <Dialog.Content>
            <div className={classNames('h-20', bodyClassName)}>
              <Typography data-testid="body-text" id={bodyId}>
                {bodyText}
              </Typography>
            </div>
          </Dialog.Content>
          <Dialog.Footer className={classNames('justify-end', footerClassName)}>
            <Button
              className={classNames('mr-2', cancelButtonCss)}
              color="tertiary"
              data-testid="cancel"
              onClick={onCancel}>
              {cancelText}
            </Button>
            <Button
              className={confirmButtonCss}
              color={
                confirmText === t('label.delete')
                  ? 'primary-destructive'
                  : 'primary'
              }
              data-testid={isLoading ? 'loading-button' : 'save-button'}
              isLoading={isLoading}
              onClick={onConfirm}>
              {confirmText}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default ConfirmationModal;
