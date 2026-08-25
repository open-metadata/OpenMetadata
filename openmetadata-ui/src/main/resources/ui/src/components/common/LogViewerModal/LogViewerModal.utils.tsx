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
import { Fragment, ReactNode } from 'react';
import { LogViewerScrollValues, ScrollFacts } from './LogViewerModal.interface';

// Maps a log level token to a severity bucket. The matching colours live in
// `log-viewer-modal.less` as `.lvm-log-level--<bucket>`, so the same parser
// works for the dark (default) and light variants.
const LEVEL_CLASS: Record<string, string> = {
  ERROR: 'error',
  CRITICAL: 'error',
  FATAL: 'error',
  SEVERE: 'error',
  WARN: 'warn',
  WARNING: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  TRACE: 'debug',
  OK: 'ok',
  SUCCESS: 'ok',
  DONE: 'ok',
  AI: 'ai',
};

// Matches the OpenMetadata ingestion log shape:
//   [2026-06-22 10:08:21] INFO     {metadata.App:app:422} - message
// Groups: timestamp, gap, level, gap, {logger} (optional), " - " (optional), rest.
const LOG_LINE_REGEX =
  /^(\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\])(\s+)([A-Z]{2,})(\s+)(\{[^}]*\})?(\s*-\s*)?([\s\S]*)$/;

/**
 * Colourises a single LazyLog "part". When the text matches the OpenMetadata
 * log shape and carries a known level, the timestamp, level, and logger are
 * wrapped in classed spans; anything else (continuation lines, Argo lines,
 * Python warnings, ANSI segments) is returned unchanged so its native styling
 * is preserved.
 */
export const formatLogPart = (text: string): ReactNode => {
  const match = LOG_LINE_REGEX.exec(text);
  const levelBucket = match ? LEVEL_CLASS[match[3]] : undefined;
  let result: ReactNode = text;

  if (match && levelBucket) {
    const [
      ,
      timestamp,
      gapBeforeLevel,
      level,
      gapAfterLevel,
      logger,
      dash,
      rest,
    ] = match;

    result = (
      <Fragment>
        <span className="lvm-log-ts">{timestamp}</span>
        {gapBeforeLevel}
        <span className={`lvm-log-level lvm-log-level--${levelBucket}`}>
          {level}
        </span>
        {gapAfterLevel}
        {logger ? <span className="lvm-log-logger">{logger}</span> : null}
        {dash ?? ''}
        {rest}
      </Fragment>
    );
  }

  return result;
};

/** How close to the end still counts as parked at the tail. */
export const SCROLL_BOTTOM_THRESHOLD_PX = 40;

/**
 * Movement below this is jitter, not the user going anywhere. Used to tell a
 * scroll the user performed (the offset moves) from the tail moving away from a
 * standing offset — which is what an append or a wrap relayout does.
 */
export const SCROLL_MOVED_THRESHOLD_PX = 4;

/**
 * What a single scroll report says, before any decision is taken on it.
 *
 * `userMovedTheView` is false when the offset stands still: the tail moved away
 * from the view rather than the other way round, which is what an append or a
 * wrap/full-screen relayout does. `movedAwayFromTail` is the stricter case of the
 * view also leaving the tail — a relayout emits long runs of offset corrections
 * (12 in a row on one measured wrap toggle) that track the tail as the content
 * shrinks, and those are the viewer keeping up, not the user leaving.
 *
 * `movedTowardsTail` is its mirror: the offset travelled in the direction of the
 * tail and still stopped short of it, which is what the library's own scroll on
 * an append looks like when the content grew again on the way. Positive evidence
 * of the direction, so a first report — which has no previous offset to compare
 * against — is neither.
 */
export const readScrollFacts = (
  { scrollTop, scrollHeight, clientHeight }: LogViewerScrollValues,
  previousScrollTop: number
): ScrollFacts => {
  const isBottom =
    Math.abs(clientHeight + scrollTop - scrollHeight) <
    SCROLL_BOTTOM_THRESHOLD_PX;
  const isFirstReport = previousScrollTop < 0;
  const movedBy = isFirstReport ? 0 : previousScrollTop - scrollTop;

  return {
    isBottom,
    fillsViewport: scrollHeight > clientHeight,
    userMovedTheView:
      isFirstReport || Math.abs(movedBy) > SCROLL_MOVED_THRESHOLD_PX,
    movedAwayFromTail:
      !isBottom && !isFirstReport && movedBy > SCROLL_MOVED_THRESHOLD_PX,
    movedTowardsTail:
      !isBottom && !isFirstReport && movedBy < -SCROLL_MOVED_THRESHOLD_PX,
  };
};
