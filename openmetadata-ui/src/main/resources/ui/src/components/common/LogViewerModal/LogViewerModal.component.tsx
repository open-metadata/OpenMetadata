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
  ChevronDownDouble,
  Copy01,
  Download01,
  File02,
  Maximize01,
  Minimize01,
  SearchMd,
} from '@untitledui/icons';
import classNames from 'classnames';
import {
  ChangeEvent,
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Dialog as AriaDialog } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useClipboard } from '../../../hooks/useClipBoard';
import Loader from '../Loader/Loader';
import './log-viewer-modal.less';
import { LogViewerModalProps } from './LogViewerModal.interface';
import { formatLogPart } from './LogViewerModal.utils';

const SCROLL_BOTTOM_THRESHOLD_PX = 40;

const LogViewerModal: FunctionComponent<LogViewerModalProps> = (props) => {
  const {
    open,
    onClose,
    title,
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
    onLoadMore,
    hasMore = false,
    loadingMore = false,
    downloading = false,
    logs,
    mode = 'static',
  } = props;

  // 'stream' == live run. Today the caller polls and grows `logs` while active,
  // flipping to 'static' on terminal state. Reserved for future SSE self-fetch.
  const isLive = mode === 'stream';

  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [wrap, setWrap] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const lazyLogRef = useRef<LazyLog>(null);

  useEffect(() => {
    if (!open) {
      setIsFullScreen(false);
    }
  }, [open]);

  const resolvedLogs = logs;
  const resolvedLoading = loading;
  // While a run is live (polled), auto-follow the tail; otherwise respect the prop.
  const resolvedFollow = isLive ? true : follow;
  const resolvedTotalLines = totalLines;

  const hasFooter = Boolean(
    status || resolvedTotalLines !== undefined || runId || lastRun
  );

  const { hasCopied, onCopyToClipBoard } = useClipboard(resolvedLogs);

  const query = searchText.trim().toLowerCase();

  const filteredLogs = useMemo(() => {
    if (!query) {
      return resolvedLogs;
    }

    return resolvedLogs
      .split('\n')
      .filter((line) => line.toLowerCase().includes(query))
      .join('\n');
  }, [resolvedLogs, query]);

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

  const handleScroll = useCallback(
    (scrollValues: {
      scrollTop: number;
      scrollHeight: number;
      clientHeight: number;
    }) => {
      const { scrollTop, scrollHeight, clientHeight } = scrollValues;
      const isBottom =
        Math.abs(clientHeight + scrollTop - scrollHeight) <
        SCROLL_BOTTOM_THRESHOLD_PX;

      if (isBottom && hasMore && !loadingMore && !query && onLoadMore) {
        onLoadMore();
      }
    },
    [hasMore, loadingMore, query, onLoadMore]
  );

  const handleJumpToEnd = useCallback(() => {
    const totalCount = lazyLogRef.current?.state?.count;
    if (lazyLogRef.current?.listRef?.current && totalCount) {
      lazyLogRef.current.listRef.current.scrollToIndex(totalCount - 1);
    }
  }, []);

  const isFullScreenClass = isFullScreen ? 'lvm-fullscreen' : '';

  return (
    <ModalOverlay
      isDismissable
      className={classNames({
        'tw:p-0 tw:sm:p-0 tw:items-stretch': isFullScreen,
      })}
      isOpen={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}>
      <Modal
        className={classNames('tw:w-full', {
          'tw:max-w-4xl': !isFullScreen,
          'tw:max-w-full': isFullScreen,
        })}>
        <AriaDialog
          aria-label={title}
          className={classNames(
            'log-viewer-modal',
            `theme-${theme}`,
            isFullScreenClass,
            {
              'dark-mode': theme === 'dark',
            }
          )}>
          <div
            className={classNames(
              'lvm-surface tw:flex tw:flex-col tw:overflow-hidden tw:shadow-xl',
              {
                'tw:h-[80vh] tw:rounded-2xl': !isFullScreen,
                'tw:h-[95vh] tw:rounded-none': isFullScreen,
              }
            )}>
            <div className="lvm-header tw:flex tw:items-center tw:justify-between tw:gap-3 tw:px-4 tw:py-3">
              <div className="lvm-header-title tw:flex tw:min-w-0 tw:items-center tw:gap-3">
                <File02 aria-hidden className="lvm-file-icon" />
                <span
                  className="lvm-title tw:truncate"
                  data-testid="log-viewer-title">
                  {title}
                </span>
              </div>
              <div className="lvm-actions tw:flex tw:items-center tw:gap-2">
                {isLive && (
                  <span
                    aria-label={t('label.live')}
                    className="lvm-dot lvm-dot--live"
                    data-testid="log-viewer-live-indicator"
                  />
                )}
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
                    onClick={() => onCopyToClipBoard(resolvedLogs)}>
                    <Copy01 aria-hidden className="lvm-copy-icon" />
                    <span>
                      {hasCopied ? t('label.copied') : t('label.copy')}
                    </span>
                  </button>
                )}
                <button
                  aria-label={t('label.jump-to-end')}
                  className="lvm-icon-button"
                  data-testid="log-viewer-jump-to-end"
                  type="button"
                  onClick={handleJumpToEnd}>
                  <ChevronDownDouble aria-hidden className="lvm-icon" />
                </button>
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
                <button
                  aria-label={
                    isFullScreen
                      ? t('label.exit-full-screen')
                      : t('label.full-screen-view')
                  }
                  aria-pressed={isFullScreen}
                  className={classNames('lvm-icon-button', {
                    'lvm-icon-button--active': isFullScreen,
                  })}
                  data-testid="log-viewer-fullscreen"
                  type="button"
                  onClick={() => setIsFullScreen((value) => !value)}>
                  {isFullScreen ? (
                    <Minimize01 aria-hidden className="lvm-icon" />
                  ) : (
                    <Maximize01 aria-hidden className="lvm-icon" />
                  )}
                </button>
                {onDownload &&
                  (downloading ? (
                    <span
                      className="lvm-icon-button"
                      data-testid="log-viewer-download-loader">
                      <Loader size="x-small" />
                    </span>
                  ) : (
                    <button
                      aria-label={t('label.download')}
                      className="lvm-icon-button"
                      data-testid="log-viewer-download"
                      type="button"
                      onClick={onDownload}>
                      <Download01 aria-hidden className="lvm-icon" />
                    </button>
                  ))}
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
              {resolvedLoading ? (
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
                  follow={resolvedFollow}
                  formatPart={colorize ? formatLogPart : undefined}
                  ref={lazyLogRef}
                  rowHeight={25}
                  text={filteredLogs}
                  wrapLines={wrap}
                  onScroll={handleScroll}
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
                  {resolvedTotalLines !== undefined && (
                    <span data-testid="log-viewer-total-lines">
                      {`${resolvedTotalLines} ${t(
                        'label.line-plural'
                      ).toLowerCase()}`}
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
