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
  CloseButton,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import {
  AlignLeft,
  Copy01,
  Download01,
  File02,
  SearchMd,
} from '@untitledui/icons';
import classNames from 'classnames';
import { ChangeEvent, FunctionComponent, useMemo, useState } from 'react';
import { Dialog as AriaDialog } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useClipboard } from '../../../hooks/useClipBoard';
import Loader from '../Loader/Loader';
import './log-viewer-modal.less';
import { LogViewerModalProps } from './LogViewerModal.interface';
import { formatLogPart } from './LogViewerModal.utils';

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
  colorize = true,
  onDownload,
  status,
  totalLines,
  runId,
  lastRun,
}: LogViewerModalProps) => {
  const { t } = useTranslation();
  const hasFooter = Boolean(
    status || totalLines !== undefined || runId || lastRun
  );
  const [searchText, setSearchText] = useState('');
  const [wrap, setWrap] = useState(false);
  const { hasCopied, onCopyToClipBoard } = useClipboard(logs);

  const query = searchText.trim().toLowerCase();

  const filteredLogs = useMemo(() => {
    if (!query) {
      return logs;
    }

    return logs
      .split('\n')
      .filter((line) => line.toLowerCase().includes(query))
      .join('\n');
  }, [logs, query]);

  const matchCount = useMemo(() => {
    if (!query) {
      return 0;
    }

    return filteredLogs ? filteredLogs.split('\n').length : 0;
  }, [filteredLogs, query]);

  const showEmptyState = Boolean(query) && matchCount === 0;

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchText(event.target.value);
  };

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
          <div className="lvm-surface tw:flex tw:h-[80vh] tw:flex-col tw:overflow-hidden tw:rounded-2xl tw:shadow-xl">
            <div className="lvm-header tw:flex tw:items-center tw:justify-between tw:gap-3 tw:px-4 tw:py-3">
              <div className="lvm-header-title tw:flex tw:min-w-0 tw:items-center tw:gap-3">
                <span aria-hidden className="lvm-dots">
                  <span className="lvm-dot lvm-dot--red" />
                  <span className="lvm-dot lvm-dot--amber" />
                  <span className="lvm-dot lvm-dot--green" />
                </span>
                <File02 aria-hidden className="lvm-file-icon" />
                <span
                  className="lvm-title tw:truncate"
                  data-testid="log-viewer-title">
                  {title}
                </span>
              </div>
              <div className="lvm-actions tw:flex tw:items-center tw:gap-2">
                {enableSearch && (
                  <div className="lvm-search">
                    <SearchMd aria-hidden className="lvm-search-icon" />
                    <input
                      className="lvm-search-input"
                      data-testid="log-viewer-search"
                      placeholder={t('label.search-entity', {
                        entity: t('label.log-lowercase-plural'),
                      })}
                      type="text"
                      value={searchText}
                      onChange={handleSearchChange}
                    />
                  </div>
                )}
                {Boolean(query) && (
                  <span
                    className="lvm-match-count"
                    data-testid="log-viewer-match-count">
                    {`${matchCount} ${t('label.matches')}`}
                  </span>
                )}
                {enableCopy && (
                  <button
                    className="lvm-copy-button"
                    data-testid="log-viewer-copy"
                    type="button"
                    onClick={() => onCopyToClipBoard(logs)}>
                    <Copy01 aria-hidden className="lvm-copy-icon" />
                    <span>
                      {hasCopied ? t('label.copied') : t('label.copy')}
                    </span>
                  </button>
                )}
                <button
                  aria-label={t('label.wrap')}
                  aria-pressed={wrap}
                  className={classNames('lvm-icon-button', {
                    'lvm-icon-button--active': wrap,
                  })}
                  data-testid="log-viewer-wrap"
                  type="button"
                  onClick={() => setWrap((value) => !value)}>
                  <AlignLeft aria-hidden className="lvm-icon" />
                </button>
                {onDownload && (
                  <button
                    aria-label={t('label.download')}
                    className="lvm-icon-button"
                    data-testid="log-viewer-download"
                    type="button"
                    onClick={onDownload}>
                    <Download01 aria-hidden className="lvm-icon" />
                  </button>
                )}
                <CloseButton
                  className="lvm-close-button"
                  data-testid="log-viewer-close"
                  size="sm"
                  theme={theme === 'dark' ? 'dark' : 'light'}
                  onPress={onClose}
                />
              </div>
            </div>
            <div
              className="lvm-body tw:relative tw:flex-1 tw:overflow-hidden"
              data-testid="log-viewer-body">
              {loading ? (
                <div className="tw:flex tw:h-full tw:items-center tw:justify-center">
                  <Loader />
                </div>
              ) : showEmptyState ? (
                <div
                  className="lvm-empty tw:flex tw:h-full tw:items-center tw:justify-center"
                  data-testid="log-viewer-empty">
                  {t('label.no-result-found')}
                </div>
              ) : (
                <LazyLog
                  caseInsensitive
                  enableLineNumbers
                  selectableLines
                  enableSearch={false}
                  extraLines={1}
                  follow={follow}
                  formatPart={colorize ? formatLogPart : undefined}
                  rowHeight={25}
                  text={filteredLogs}
                  wrapLines={wrap}
                />
              )}
            </div>
            {hasFooter && (
              <div
                className="lvm-footer tw:flex tw:items-center tw:justify-between tw:gap-3 tw:px-4 tw:py-2"
                data-testid="log-viewer-footer">
                <div className="lvm-footer-left">
                  {status && (
                    <span
                      className={classNames(
                        'lvm-status',
                        `lvm-status--${status.tone ?? 'muted'}`
                      )}
                      data-testid="log-viewer-status">
                      <span aria-hidden className="lvm-status-dot" />
                      {status.label}
                    </span>
                  )}
                  {totalLines !== undefined && (
                    <span data-testid="log-viewer-total-lines">
                      {`${totalLines} ${t('label.line-plural').toLowerCase()}`}
                    </span>
                  )}
                </div>
                <div className="lvm-footer-right">
                  {runId && (
                    <span data-testid="log-viewer-run-id">{runId}</span>
                  )}
                  {lastRun && (
                    <span data-testid="log-viewer-last-run">{lastRun}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
};

export default LogViewerModal;
