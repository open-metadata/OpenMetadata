/*
 *  Copyright 2026 Collate.
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
import { Dialog, Modal, ModalOverlay } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { useProductTourStore } from '../../hooks/useProductTourStore';
import productTourClassBase from '../../utils/ProductTourClassBase';
import { StorylaneTour } from '../Learning/ResourcePlayer/StorylaneTour.component';

// The frame fills the screen instead of the Learning Center player's 16:9 box.
const FILL_CLASS = [
  'tw:min-h-0 tw:flex-1 tw:p-0!',
  'tw:[&>*]:size-full! tw:[&>*]:max-h-none! tw:[&>*]:max-w-none! tw:[&>*]:aspect-auto! tw:[&>*]:rounded-none!',
].join(' ');

/**
 * The product tour: the distribution's Storylane demo in a full-screen modal
 * over the page the user is on. Escape or the close button ends it.
 * ADR:2026-11-13-the-product-tour-is-a-storylane-demo
 */
const ProductTourModal = () => {
  const { t } = useTranslation();
  const close = useProductTourStore((state) => state.close);
  const title = t('label.product-tour');

  return (
    <ModalOverlay
      isDismissable
      isOpen
      presentation="fullscreen"
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          close();
        }
      }}>
      <Modal>
        <Dialog
          showCloseButton
          aria-label={title}
          data-testid="product-tour-dialog"
          title={title}
          onClose={close}>
          <StorylaneTour
            className={FILL_CLASS}
            title={title}
            url={productTourClassBase.getTourUrl()}
          />
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default ProductTourModal;
