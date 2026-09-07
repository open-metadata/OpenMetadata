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
  Tooltip,
  TooltipTrigger,
} from '@openmetadata/ui-core-components';
import {
  AlignLeft,
  ArrowDown,
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
import {
  LogViewerModalProps,
  LogViewerScrollValues,
} from './LogViewerModal.interface';
import { formatLogPart } from './LogViewerModal.utils';
import LogViewerToolbarToggle from './LogViewerToolbarToggle.component';
import { useLogAutoFollow } from './useLogAutoFollow';

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
    streamHealth,
    streamTruncated = false,
    streamError = null,
  } = props;

  // 'stream' == live run: the caller grows `logs` while the run is active and
  // flips to 'static' on terminal state.
  const isLive = mode === 'stream';
  // A live run whose SSE tail is between attempts. The content on screen is
  // still valid, it has just stopped growing for the moment.
  const isReconnecting = isLive && streamHealth === 'connecting';

  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [wrap, setWrap] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const lazyLogRef = useRef<LazyLog>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setIsFullScreen(false);
    }
  }, [open]);

  const resolvedLogs = logs;
  const resolvedLoading = loading;
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

  const scrollToEnd = useCallback(() => {
    const totalCount = lazyLogRef.current?.state?.count;
    if (lazyLogRef.current?.listRef?.current && totalCount) {
      lazyLogRef.current.listRef.current.scrollToIndex(totalCount - 1);
    }
  }, []);

  const {
    followTail,
    trackScroll,
    resumeFollowingTail,
    toggleFollow,
    markViewerScroll,
  } = useLogAutoFollow({
    bodyRef,
    follow,
    isLive,
    logs,
    open,
    scrollerLabel: t('label.log-plural'),
    scrollToEnd,
  });

  // Following the tail only means anything while the content grows, so it is a
  // live-run concept — a static run keeps honouring the prop as before.
  const resolvedFollow = isLive ? followTail : follow;

  const handleScroll = useCallback(
    (scrollValues: LogViewerScrollValues) => {
      const { isBottom } = trackScroll(scrollValues);

      const canLoadMore = isBottom && hasMore && !loadingMore;

      if (canLoadMore && !query && onLoadMore) {
        onLoadMore();
      }
    },
    [trackScroll, hasMore, loadingMore, query, onLoadMore]
  );

  const handleJumpToEnd = useCallback(() => {
    if (isLive) {
      resumeFollowingTail();

      return;
    }

    scrollToEnd();
  }, [isLive, resumeFollowingTail, scrollToEnd]);

  const handleToggleWrap = useCallback(() => {
    markViewerScroll();
    setWrap((value) => !value);
  }, [markViewerScroll]);

  const handleToggleFullScreen = useCallback(() => {
    markViewerScroll();
    setIsFullScreen((value) => !value);
  }, [markViewerScroll]);

  const isFullScreenClass = isFullScreen ? 'lvm-fullscreen' : '';

  const logBodyContent = showEmptyState ? (
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
  );

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
          'tw:max-w-[max(56rem,60vw)]': !isFullScreen,
          'tw:max-w-[95vw]': isFullScreen,
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
              'lvm-surface tw:flex tw:flex-col tw:overflow-hidden tw:shadow-xl tw:rounded-2xl',
              {
                'tw:h-[80vh]': !isFullScreen,
                'tw:h-[95vh]': isFullScreen,
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
                {isLive &&
                  (isReconnecting ? (
                    <span
                      aria-label={t('label.reconnecting')}
                      className="lvm-dot lvm-dot--reconnecting"
                      data-testid="log-viewer-reconnecting-indicator"
                      role="status"
                      title={t('label.reconnecting')}
                    />
                  ) : (
                    <span
                      aria-label={t('label.live')}
                      className="lvm-dot lvm-dot--live"
                      data-testid="log-viewer-live-indicator"
                    />
                  ))}
                {enableSearch && (
                  <div className="lvm-search">
                    <SearchMd aria-hidden className="lvm-search-icon" />
                    <input
                      aria-label={t('label.search-entity', {
                        entity: t('label.log-lowercase-plural'),
                      })}
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
                  <Tooltip
                    delay={500}
                    placement="top"
                    title={hasCopied ? t('label.copied') : t('label.copy')}>
                    <TooltipTrigger
                      className="lvm-copy-button"
                      data-testid="log-viewer-copy"
                      onPress={() => onCopyToClipBoard(resolvedLogs)}>
                      <Copy01 aria-hidden className="lvm-copy-icon" />
                      <span>
                        {hasCopied ? t('label.copied') : t('label.copy')}
                      </span>
                    </TooltipTrigger>
                  </Tooltip>
                )}
                {isLive && (
                  <LogViewerToolbarToggle
                    icon={<ArrowDown aria-hidden className="lvm-icon" />}
                    isActive={followTail}
                    label={t('label.live-auto-scroll')}
                    testId="log-viewer-follow"
                    onToggle={toggleFollow}
                  />
                )}
                <Tooltip
                  delay={500}
                  placement="top"
                  title={t('label.jump-to-end')}>
                  <TooltipTrigger
                    aria-label={t('label.jump-to-end')}
                    className="lvm-icon-button"
                    data-testid="log-viewer-jump-to-end"
                    onPress={handleJumpToEnd}>
                    <ChevronDownDouble aria-hidden className="lvm-icon" />
                  </TooltipTrigger>
                </Tooltip>
                <LogViewerToolbarToggle
                  icon={<AlignLeft aria-hidden className="lvm-icon" />}
                  isActive={wrap}
                  label={t('label.wrap')}
                  testId="log-viewer-wrap"
                  onToggle={handleToggleWrap}
                />
                <LogViewerToolbarToggle
                  icon={
                    isFullScreen ? (
                      <Minimize01 aria-hidden className="lvm-icon" />
                    ) : (
                      <Maximize01 aria-hidden className="lvm-icon" />
                    )
                  }
                  isActive={isFullScreen}
                  label={
                    isFullScreen
                      ? t('label.exit-full-screen')
                      : t('label.full-screen-view')
                  }
                  testId="log-viewer-fullscreen"
                  onToggle={handleToggleFullScreen}
                />
                {onDownload &&
                  (downloading ? (
                    <span
                      className="lvm-icon-button"
                      data-testid="log-viewer-download-loader">
                      <Loader size="x-small" />
                    </span>
                  ) : (
                    <Tooltip
                      delay={500}
                      placement="top"
                      title={t('label.download')}>
                      <TooltipTrigger
                        aria-label={t('label.download')}
                        className="lvm-icon-button"
                        data-testid="log-viewer-download"
                        onPress={onDownload}>
                        <Download01 aria-hidden className="lvm-icon" />
                      </TooltipTrigger>
                    </Tooltip>
                  ))}
                <Tooltip delay={500} placement="top" title={t('label.close')}>
                  <CloseButton
                    className="lvm-close-button"
                    data-testid="log-viewer-close"
                    size="sm"
                    theme={theme === 'dark' ? 'dark' : 'light'}
                    onPress={onClose}
                  />
                </Tooltip>
              </div>
            </div>
            {streamTruncated && (
              <div
                className="lvm-notice tw:px-4 tw:py-2"
                data-testid="log-viewer-truncated-notice"
                role="status">
                {t('message.log-stream-truncated')}
              </div>
            )}
            {streamError && (
              <div
                className="lvm-notice lvm-notice--error tw:px-4 tw:py-2"
                data-testid="log-viewer-stream-error"
                role="alert">
                {streamError}
              </div>
            )}
            <div
              className="lvm-body tw:relative tw:flex-1 tw:overflow-hidden"
              data-testid="log-viewer-body"
              ref={bodyRef}>
              {resolvedLoading ? (
                <div className="tw:flex tw:h-full tw:items-center tw:justify-center">
                  <Loader />
                </div>
              ) : (
                logBodyContent
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
