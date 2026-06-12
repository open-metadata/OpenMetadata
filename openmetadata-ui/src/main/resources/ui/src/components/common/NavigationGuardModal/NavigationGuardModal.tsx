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
  Button,
  Dialog,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';

interface NavigationGuardModalProps {
  isOpen: boolean;
  onLeave: () => void;
  onStay: () => void;
}

export const NavigationGuardModal = ({
  isOpen,
  onLeave,
  onStay,
}: NavigationGuardModalProps) => {
  const { t } = useTranslation();

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={(open) => !open && onStay()}>
      <Modal>
        <Dialog title={t('message.unsaved-changes')} width={480}>
          <Dialog.Content>
            <p className="tw:text-sm tw:text-[var(--color-text-secondary)]">
              {t('message.unsaved-form-data')}
            </p>
          </Dialog.Content>
          <Dialog.Footer>
            <Button color="primary" onPress={onStay}>
              {t('label.continue-editing')}
            </Button>
            <Button color="secondary-destructive" onPress={onLeave}>
              {t('label.leave')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
