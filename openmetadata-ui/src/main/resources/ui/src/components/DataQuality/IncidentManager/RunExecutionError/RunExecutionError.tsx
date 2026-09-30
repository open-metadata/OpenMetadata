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
  Typography,
} from '@openmetadata/ui-core-components';
import { RefreshCcw01 } from '@openmetadata/ui-core-components/icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TestCase,
  TestCaseErrorDetails,
} from '../../../../generated/tests/testCase';
import { getRunButtonLabelKey } from '../../../observability/TestCaseDetail/RunTestCaseButton/RunTestCaseButton.utils';
import { useRunTestCase } from '../../../observability/TestCaseDetail/RunTestCaseButton/useRunTestCase';
import { parseTraceback, TracebackLineKind } from './RunExecutionError.utils';

const TRACEBACK_LINE_CLASS: Record<TracebackLineKind, string> = {
  header: 'tw:text-error-primary',
  location: 'tw:text-quaternary',
  truncated: 'tw:text-quaternary tw:italic',
  code: 'tw:text-secondary',
  exception: 'tw:text-warning-primary',
};

const TRACEBACK_CLASS_NAME = [
  'tw:m-0 tw:max-h-80 tw:max-w-full tw:overflow-auto tw:rounded-lg tw:p-3',
  'tw:bg-secondary tw:outline-1 tw:-outline-offset-1 tw:outline-secondary',
  'tw:font-mono tw:text-xs tw:leading-relaxed',
].join(' ');

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
          as="span"
          className="tw:uppercase tw:tracking-wide tw:text-warning-primary"
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
      {message && (
        <Typography
          className="tw:text-tertiary tw:break-words"
          data-testid="run-execution-error-message"
          size="text-sm">
          {message}
        </Typography>
      )}
      {tracebackLines.length > 0 && (
        <pre
          className={TRACEBACK_CLASS_NAME}
          data-testid="run-execution-error-traceback">
          {tracebackLines.map(({ kind, text }, index) => (
            <span
              className={`tw:block ${TRACEBACK_LINE_CLASS[kind]}`}
              data-kind={kind}
              // A traceback is rendered once and never reordered.
              // eslint-disable-next-line react/no-array-index-key
              key={index}>
              {text}
            </span>
          ))}
        </pre>
      )}
      {canRun && !disabledReasonKey && (
        <div>
          <Button
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
        </div>
      )}
    </Box>
  );
};

export default RunExecutionError;
