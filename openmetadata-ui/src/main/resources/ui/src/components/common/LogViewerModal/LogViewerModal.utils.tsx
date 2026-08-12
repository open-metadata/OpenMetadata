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
