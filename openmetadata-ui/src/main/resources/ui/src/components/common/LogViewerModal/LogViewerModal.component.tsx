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
import { LazyLog } from '@melloware/react-logviewer';
import {
  ButtonUtility,
  CloseButton,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { Download01 } from '@untitledui/icons';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { Dialog as AriaDialog } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import CopyToClipboardButton from '../CopyToClipboardButton/CopyToClipboardButton';
import Loader from '../Loader/Loader';
import './log-viewer-modal.less';
import { LogViewerModalProps } from './LogViewerModal.interface';

const LogViewerModal: FunctionComponent<LogViewerModalProps> = ({
  open,
  onClose,
  title,
  logs,
  loading = false,
  theme = 'dark',
  follow = false,
  enableSearch = true,
  enableCopy = true,
  onDownload,
}: LogViewerModalProps) => {
  const { t } = useTranslation();

  return (
    <ModalOverlay
      isDismissable
      isOpen={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}>
      <Modal className="tw:w-full tw:max-w-4xl">
        <AriaDialog
          aria-label={title}
          className={classNames('log-viewer-modal', `theme-${theme}`, {
            'dark-mode': theme === 'dark',
          })}>
          <div className="tw:flex tw:h-[80vh] tw:flex-col tw:overflow-hidden tw:rounded-2xl tw:bg-primary tw:shadow-xl">
            <div className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:border-b tw:border-secondary tw:px-4 tw:py-3">
              <span
                className="tw:truncate tw:text-sm tw:font-semibold tw:text-primary"
                data-testid="log-viewer-title">
                {title}
              </span>
              <div className="tw:flex tw:items-center tw:gap-1">
                {enableCopy && (
                  <CopyToClipboardButton copyText={logs} position="top" />
                )}
                {onDownload && (
                  <ButtonUtility
                    data-testid="log-viewer-download"
                    icon={Download01}
                    tooltip={t('label.download')}
                    onClick={onDownload}
                  />
                )}
                <CloseButton
                  data-testid="log-viewer-close"
                  size="sm"
                  onPress={onClose}
                />
              </div>
            </div>
            <div
              className="tw:relative tw:flex-1 tw:overflow-hidden"
              data-testid="log-viewer-body">
              {loading ? (
                <div className="tw:flex tw:h-full tw:items-center tw:justify-center">
                  <Loader />
                </div>
              ) : (
                <LazyLog
                  caseInsensitive
                  enableLineNumbers
                  selectableLines
                  enableSearch={enableSearch}
                  extraLines={1}
                  follow={follow}
                  text={logs}
                />
              )}
            </div>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
};

export default LogViewerModal;
