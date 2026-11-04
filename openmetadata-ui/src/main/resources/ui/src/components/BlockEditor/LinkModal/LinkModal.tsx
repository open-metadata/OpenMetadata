/*
 *  Copyright 2023 Collate.
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
  Input,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { FC, FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface LinkData {
  href: string;
}

export interface LinkModalProps {
  isOpen: boolean;
  data: LinkData;
  onSave: (data: LinkData) => void;
  onCancel: () => void;
  /**
   * Portal container for the modal. Lets it mount inside a focus-trapping
   * dialog so the dialog does not steal focus from the input.
   */
  getContainer?: () => HTMLElement;
}

const LinkModal: FC<LinkModalProps> = ({
  isOpen,
  data,
  onSave,
  onCancel,
  getContainer,
}) => {
  const { t } = useTranslation();
  const [href, setHref] = useState(data.href);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSave({ href });
  };

  return (
    <ModalOverlay
      UNSTABLE_portalContainer={getContainer?.()}
      isDismissable={false}
      isOpen={isOpen}
      // Above antd modals/drawers (z-index 1000) that may host the editor.
      style={{ zIndex: 'var(--om-z-modal)' }}
      onOpenChange={(open) => !open && onCancel()}>
      <Modal className="block-editor-link-modal">
        <Dialog
          showCloseButton
          title={data.href ? 'Edit link' : 'Add link'}
          width={520}
          onClose={onCancel}>
          <Dialog.Content>
            <form
              data-testid="link-form"
              id="link-form"
              onSubmit={handleSubmit}>
              <Input
                // eslint-disable-next-line jsx-a11y/no-autofocus -- focus the link input when the modal opens
                autoFocus
                id="href"
                label="Link"
                name="href"
                value={href ?? ''}
                onChange={setHref}
              />
            </form>
          </Dialog.Content>
          <Dialog.Footer>
            <Button color="secondary" onPress={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button color="primary" form="link-form" type="submit">
              {t('label.save')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default LinkModal;
