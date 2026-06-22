import { LazyLog } from '@melloware/react-logviewer';
import {
  CloseButton,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { Dialog as AriaDialog } from 'react-aria-components';
import Loader from '../Loader/Loader';
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
}: LogViewerModalProps) => {
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
