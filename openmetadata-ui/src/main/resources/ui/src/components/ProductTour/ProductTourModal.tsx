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
import {
  Box,
  ButtonUtility,
  Dialog,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import {
  Maximize01,
  Minimize01,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProductTourStore } from '../../hooks/useProductTourStore';
import productTourClassBase from '../../utils/ProductTourClassBase';
import { StorylaneTour } from '../Learning/ResourcePlayer/StorylaneTour.component';

// The Learning Center player's width, for the minimized popup.
const POPUP_WIDTH = 1143;

/**
 * The product tour: the distribution's Storylane demo in a modal over the
 * page the user is on. It opens full screen; the header button switches it
 * to a popup and back, and the close button or Escape ends it.
 * ADR:2026-11-13-the-product-tour-is-a-storylane-demo
 */
const ProductTourModal = () => {
  const { t } = useTranslation();
  const close = useProductTourStore((state) => state.close);
  const [isFullScreen, setIsFullScreen] = useState(true);
  const title = t('label.product-tour');
  const toggleLabel = isFullScreen
    ? t('label.exit-full-screen')
    : t('label.fullscreen');

  return (
    <ModalOverlay
      isDismissable
      isOpen
      presentation={isFullScreen ? 'fullscreen' : 'dialog'}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          close();
        }
      }}>
      <Modal>
        <Dialog
          aria-label={title}
          data-testid="product-tour-dialog"
          dividers="scroll"
          width={POPUP_WIDTH}>
          <Dialog.Header
            className="tw:flex tw:items-center tw:justify-between tw:gap-2"
            title={title}>
            <Box align="center" className="tw:shrink-0" gap={1}>
              <ButtonUtility
                aria-label={toggleLabel}
                data-testid={
                  isFullScreen ? 'minimize-button' : 'maximize-button'
                }
                icon={isFullScreen ? Minimize01 : Maximize01}
                size="lg"
                tooltip={toggleLabel}
                onClick={() => setIsFullScreen((prev) => !prev)}
              />
              <ButtonUtility
                aria-label={t('label.close')}
                data-testid="close-product-tour"
                icon={XClose}
                size="lg"
                tooltip={t('label.close')}
                onClick={close}
              />
            </Box>
          </Dialog.Header>
          <StorylaneTour
            className={isFullScreen ? 'tw:min-h-0 tw:flex-1' : undefined}
            fill={isFullScreen}
            title={title}
            url={productTourClassBase.getTourUrl()}
          />
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default ProductTourModal;
