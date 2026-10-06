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
  Badge,
  Box,
  Button,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { RefreshCcw01 } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TestCase,
  TestCaseErrorDetails,
} from '../../../../generated/tests/testCase';
import { getRunButtonLabelKey } from '../../../observability/TestCaseDetail/RunTestCaseButton/RunTestCaseButton.utils';
import { useRunTestCase } from '../../../observability/TestCaseDetail/RunTestCaseButton/useRunTestCase';
import { parseTraceback, TracebackLineKind } from './RunExecutionError.utils';

// The -700 steps and tertiary grey hold AA on the trace's tinted panel.
const TRACEBACK_LINE_CLASS: Record<TracebackLineKind, string> = {
  header: 'tw:text-utility-error-700',
  location: 'tw:text-tertiary',
  truncated: 'tw:text-tertiary tw:italic',
  code: 'tw:text-secondary',
  exception: 'tw:text-utility-warning-700',
};

// A border rather than an outline: once focusable, the outline is the focus ring.
const TRACEBACK_CLASS_NAME = [
  'tw:max-h-80 tw:max-w-full tw:overflow-auto tw:rounded-lg tw:p-3',
  'tw:border tw:border-secondary tw:bg-secondary tw:focus-visible:outline-focus-ring',
  // Geist Mono's ligatures draw `!=` as `≠` and run `<>` into the character before it.
  'tw:[font-variant-ligatures:none]',
].join(' ');

/**
 * The message, clamped to three lines: the trace below it is capped at 320px,
 * and a 2,000-character message otherwise made the card 1,014px tall.
 */
const RunErrorMessage = ({ message }: { message: string }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const messageRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const element = messageRef.current;

    if (!element || isExpanded) {
      return;
    }

    const measure = () =>
      setIsClamped(element.scrollHeight > element.clientHeight);
    const observer = globalThis.ResizeObserver
      ? new ResizeObserver(measure)
      : undefined;

    measure();
    observer?.observe(element);

    return () => observer?.disconnect();
  }, [message, isExpanded]);

  return (
    <Box align="start" direction="col" gap={1}>
      <p
        className={classNames(
          'tw:m-0 tw:break-words tw:text-sm tw:text-secondary',
          { 'tw:line-clamp-3': !isExpanded }
        )}
        data-testid="run-execution-error-message"
        ref={messageRef}>
        {message}
      </p>
      {(isClamped || isExpanded) && (
        <Button
          aria-expanded={isExpanded}
          className="tw:h-auto tw:p-0"
          color="link-color"
          size="sm"
          onPress={() => setIsExpanded((expanded) => !expanded)}>
          {t(isExpanded ? 'label.less-lowercase' : 'label.more-lowercase')}
        </Button>
      )}
    </Box>
  );
};

interface RunExecutionErrorProps {
  errorDetails?: TestCaseErrorDetails;
  /** The free-text result, shown when the run carries no structured error. */
  result?: string;
  testCase: TestCase;
}

const RunExecutionError = ({
  errorDetails,
  result,
  testCase,
}: RunExecutionErrorProps) => {
  const { t } = useTranslation();
  const {
    activeRunState,
    canRun,
    disabledReasonKey,
    isTriggering,
    run,
    runInProgress,
  } = useRunTestCase(testCase);
  const message = errorDetails?.message ?? result;
  const tracebackLines = useMemo(
    () =>
      errorDetails?.stackTrace ? parseTraceback(errorDetails.stackTrace) : [],
    [errorDetails?.stackTrace]
  );

  return (
    <Box
      className="tw:min-w-0 tw:border-t tw:border-secondary tw:pt-4"
      data-testid="run-execution-error"
      direction="col"
      gap={2}>
      <Box align="center" gap={2}>
        <Typography
          className="tw:uppercase tw:tracking-wide tw:text-utility-warning-700"
          size="text-xs"
          weight="bold">
          {t('label.execution-error')}
        </Typography>
        {errorDetails?.errorType && (
          <Badge
            className="tw:font-mono"
            color="warning"
            data-testid="run-execution-error-type"
            size="sm"
            type="color">
            {errorDetails.errorType}
          </Badge>
        )}
      </Box>
      {message && <RunErrorMessage message={message} />}
      {tracebackLines.length > 0 && (
        <Card
          aria-label={t('label.traceback')}
          className={TRACEBACK_CLASS_NAME}
          data-testid="run-execution-error-traceback"
          role="region"
          // Safari does not make a scroll container keyboard-focusable, so the
          // trace past the cap would be out of keyboard reach.
          tabIndex={0}
          variant="ghost">
          <pre className="tw:m-0 tw:font-mono tw:text-xs tw:leading-relaxed">
            {tracebackLines.map(({ kind, text }, index) => (
              <Typography
                className={`tw:block ${TRACEBACK_LINE_CLASS[kind]}`}
                data-kind={kind}
                // A traceback is rendered once and never reordered.
                // eslint-disable-next-line react/no-array-index-key
                key={index}>
                {text}
              </Typography>
            ))}
          </pre>
        </Card>
      )}
      {canRun && !disabledReasonKey && (
        <Button
          className="tw:self-start"
          color="secondary"
          data-testid="run-execution-error-retry"
          iconLeading={RefreshCcw01}
          // A retry already queued or running is the retry; another would only duplicate it.
          isDisabled={runInProgress}
          isLoading={isTriggering}
          size="sm"
          onClick={run}>
          {t(
            runInProgress
              ? getRunButtonLabelKey(activeRunState)
              : 'label.retry-run'
          )}
        </Button>
      )}
    </Box>
  );
};

export default RunExecutionError;
