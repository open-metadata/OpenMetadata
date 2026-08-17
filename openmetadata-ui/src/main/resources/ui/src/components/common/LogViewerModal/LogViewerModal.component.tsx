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
import { LogViewerModalProps } from './LogViewerModal.interface';
import { formatLogPart } from './LogViewerModal.utils';
import LogViewerToolbarToggle from './LogViewerToolbarToggle.component';

const SCROLL_BOTTOM_THRESHOLD_PX = 40;

/** Keys that move the view back through the log rather than along with it. */
const SCROLL_BACK_KEYS = ['ArrowUp', 'PageUp', 'Home'];

/**
 * Movement below this is jitter, not the user going anywhere. Used to tell a
 * scroll the user performed (the offset moves) from the tail moving away from a
 * standing offset — which is what an append or a wrap relayout does.
 */
const SCROLL_MOVED_THRESHOLD_PX = 4;

/**
 * How long the viewer's own scrolling stops counting as the user's. Two cases
 * report through `onScroll` indistinguishably from a real scroll: a jump to the
 * tail (the virtualised list lands approximately on a long jump, then corrects)
 * and a wrap/full-screen relayout (re-measuring every row moves both the content
 * height and the offset while the viewer re-pins the tail). A wheel or scroll key
 * closes the window immediately, and anything that keeps pulling away from the
 * tail outruns it (see `UPWARD_MOVES_TO_TAKE_CONTROL`), so the user is never
 * fought for the full duration.
 */
const VIEWER_SCROLL_GRACE_MS = 1000;

/**
 * How long a user's pause is protected from the resume-at-the-tail rule. The
 * viewer library restores its own recorded offset when the text changes, which
 * can put the view back at the tail on its own; without this, that would read as
 * the user scrolling back down and silently resume following.
 */
const USER_PAUSE_GRACE_MS = 1000;

/**
 * How many scrolls in a row moving away from the tail take the log back from the
 * viewer's catch-up. This is what covers a scrollbar drag, which reports no wheel
 * and no key — and it needs no pointer event, which native scrollbars do not
 * deliver in every browser and which a plain click would otherwise fake. Two,
 * because a relayout's first report can leave the tail once before the viewer
 * re-pins it.
 */
const UPWARD_MOVES_TO_TAKE_CONTROL = 2;

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
  const [followTail, setFollowTail] = useState(isLive || follow);
  const lazyLogRef = useRef<LazyLog>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const viewerScrollAtRef = useRef(0);
  const userPausedAtRef = useRef(0);
  const lastScrollTopRef = useRef(-1);
  const upwardMovesRef = useRef(0);
  const caughtUpRef = useRef(false);
  // Mirrors `followTail` for the scroll handler. The viewer scrolls itself in the
  // same tick as it resumes following, so the scroll event that comes back would
  // otherwise be read by a closure that still says "paused".
  const followTailRef = useRef(followTail);

  const setFollow = useCallback((next: boolean) => {
    followTailRef.current = next;
    setFollowTail(next);
  }, []);

  useEffect(() => {
    if (!open) {
      setIsFullScreen(false);
    }
  }, [open]);

  // A run going live, or the modal being reopened, re-pins the view to the tail.
  useEffect(() => {
    lastScrollTopRef.current = -1;
    upwardMovesRef.current = 0;
    setFollow(isLive || follow);
  }, [open, isLive, follow, setFollow]);

  const resolvedLogs = logs;
  const resolvedLoading = loading;
  // Following the tail only means anything while the content grows, so it is a
  // live-run concept — a static run keeps honouring the prop as before.
  const resolvedFollow = isLive ? followTail : follow;
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

      const previousScrollTop = lastScrollTopRef.current;
      lastScrollTopRef.current = scrollTop;

      // The offset standing still while the view is no longer at the tail means
      // the tail moved away from the user, not the other way round: an append, or
      // a wrap/full-screen relayout that re-measured every row. Following must
      // survive that, so catch up instead of reading it as intent.
      const userMovedTheView =
        previousScrollTop < 0 ||
        Math.abs(scrollTop - previousScrollTop) > SCROLL_MOVED_THRESHOLD_PX;

      // Only movement that also leaves the tail counts as pulling away from it. A
      // relayout emits long runs of downward offset corrections as rows are
      // re-measured — 12 in a row on one measured wrap toggle — but they track the
      // tail as the content shrinks, so they are the viewer keeping up, not the
      // user leaving.
      const movedAwayFromTail =
        !isBottom &&
        previousScrollTop >= 0 &&
        previousScrollTop - scrollTop > SCROLL_MOVED_THRESHOLD_PX;

      // The catch-up lands back at the tail between a slow drag's steps. Counting
      // that as "not pulling away" would reset the run every time and the drag
      // could never outrun the claim, so a landing the viewer caused is skipped
      // rather than treated as the user settling at the tail.
      const catchUpLanded = isBottom && caughtUpRef.current;
      caughtUpRef.current = false;

      if (movedAwayFromTail) {
        upwardMovesRef.current += 1;
      } else if (!catchUpLanded) {
        upwardMovesRef.current = 0;
      }

      // Something is pulling away from the tail against the catch-up, which the
      // catch-up itself never does — it only ever moves back down. Whatever it is
      // outranks the viewer's claim, so no pointer event is needed to notice it.
      if (upwardMovesRef.current >= UPWARD_MOVES_TO_TAKE_CONTROL) {
        viewerScrollAtRef.current = 0;
      }

      // A jump to the tail or a relayout moves the offset too, but the viewer
      // moved it — not the user.
      const isViewerScroll =
        Date.now() - viewerScrollAtRef.current < VIEWER_SCROLL_GRACE_MS;

      if (
        followTailRef.current &&
        !isBottom &&
        (!userMovedTheView || isViewerScroll)
      ) {
        caughtUpRef.current = true;
        scrollToEnd();
      } else if (isLive && scrollHeight > clientHeight && userMovedTheView) {
        const justPausedByUser =
          Date.now() - userPausedAtRef.current < USER_PAUSE_GRACE_MS;

        // Scrolling away from the tail hands control back to the user; scrolling
        // back to it resumes following. Content that does not fill the viewport
        // is trivially "at the bottom" and must not drive the state, or follow
        // flips before the first screen is filled. A landing at the tail just
        // after the user paused is the library restoring its own offset, not the
        // user scrolling back down, so it must not resume.
        if ((!isBottom || !justPausedByUser) && !isViewerScroll) {
          if (!isBottom) {
            userPausedAtRef.current = Date.now();
          }

          setFollow(isBottom);
        }
      }

      if (isBottom && hasMore && !loadingMore && !query && onLoadMore) {
        onLoadMore();
      }
    },
    [isLive, hasMore, loadingMore, query, onLoadMore, scrollToEnd, setFollow]
  );

  const resumeFollowingTail = useCallback(() => {
    userPausedAtRef.current = 0;
    upwardMovesRef.current = 0;
    caughtUpRef.current = false;
    viewerScrollAtRef.current = Date.now();
    setFollow(true);
    scrollToEnd();
  }, [scrollToEnd, setFollow]);

  const handleJumpToEnd = useCallback(() => {
    if (isLive) {
      resumeFollowingTail();

      return;
    }

    scrollToEnd();
  }, [isLive, resumeFollowingTail, scrollToEnd]);

  // Scroll position alone cannot tell the user apart from the viewer: while a
  // stream appends, the viewer's own follow scroll can undo a wheel before the
  // browser reports the new position, so the resulting `onScroll` still reads as
  // "at the tail" and following would never pause. The gesture itself is the
  // only reliable signal, and pausing on it lands before the next append.
  useEffect(() => {
    const body = bodyRef.current;

    if (!open || !isLive || !body) {
      return;
    }

    // The element that actually scrolls is created by the log viewer library, so
    // it has no tab stop of its own: without one the log is pointer-only and the
    // keys below never reach a focused element. Done here rather than in JSX
    // because the scroller is not ours to render.
    const scroller = Array.from(body.querySelectorAll<HTMLElement>('*')).find(
      (element) => {
        const { overflowY } = window.getComputedStyle(element);

        return overflowY === 'auto' || overflowY === 'scroll';
      }
    );

    if (scroller && !scroller.hasAttribute('tabindex')) {
      scroller.tabIndex = 0;
      scroller.setAttribute('role', 'region');
      scroller.setAttribute('aria-label', t('label.log-plural'));
    }

    const pauseFollow = () => {
      // A real gesture ends the jump grace, so the catch-up in `handleScroll`
      // cannot re-assert the tail on top of the user.
      viewerScrollAtRef.current = 0;
      userPausedAtRef.current = Date.now();
      setFollow(false);
    };

    const handleWheel = (event: globalThis.WheelEvent) => {
      if (event.deltaY < 0) {
        pauseFollow();
      }
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (SCROLL_BACK_KEYS.includes(event.key)) {
        pauseFollow();
      }
    };

    body.addEventListener('wheel', handleWheel, { passive: true });
    body.addEventListener('keydown', handleKeyDown);

    return () => {
      body.removeEventListener('wheel', handleWheel);
      body.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, isLive, resolvedLoading, showEmptyState, setFollow, t]);

  // Wrapping and full-screen re-measure every row, so the tail moves out from
  // under the current offset. A followed log re-pins itself instead of letting
  // that read as the user taking over.
  const markViewerScroll = useCallback(() => {
    if (followTailRef.current) {
      viewerScrollAtRef.current = Date.now();
    }
  }, []);

  const handleToggleWrap = useCallback(() => {
    markViewerScroll();
    setWrap((value) => !value);
  }, [markViewerScroll]);

  const handleToggleFullScreen = useCallback(() => {
    markViewerScroll();
    setIsFullScreen((value) => !value);
  }, [markViewerScroll]);

  const handleToggleFollow = useCallback(() => {
    if (followTail) {
      viewerScrollAtRef.current = 0;
      userPausedAtRef.current = Date.now();
      setFollow(false);

      return;
    }

    resumeFollowingTail();
  }, [followTail, resumeFollowingTail, setFollow]);

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
                    onToggle={handleToggleFollow}
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
