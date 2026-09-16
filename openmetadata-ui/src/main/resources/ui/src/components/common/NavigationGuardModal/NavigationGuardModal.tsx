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
  FeaturedIcon,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { ReactComponent as SaveIcon } from '../../../assets/svg/ic-save.svg';

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
        <Dialog showCloseButton width={480} onClose={onStay}>
          <Dialog.Header>
            <div className="tw:relative tw:w-max">
              <FeaturedIcon
                color="warning"
                icon={SaveIcon}
                size="lg"
                theme="light"
              />
            </div>
            <div className="tw:z-10 tw:flex tw:flex-col tw:gap-0.5 tw:mt-4">
              <span className="tw:text-md tw:font-semibold tw:text-primary">
                {t('message.unsaved-changes')}
              </span>
              <p className="tw:text-sm tw:text-tertiary">
                {t('message.unsaved-changes-description')}
              </p>
            </div>
          </Dialog.Header>
          <Dialog.Footer className="tw:border-none tw:sm:mt-3">
            <Button color="secondary" size="lg" onPress={onLeave}>
              {t('label.discard')}
            </Button>
            <Button color="primary" size="lg" onPress={onStay}>
              {t('label.continue-editing')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
