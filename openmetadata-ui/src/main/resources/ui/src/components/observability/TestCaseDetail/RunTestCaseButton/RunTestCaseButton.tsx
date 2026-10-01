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
import { Button, Tooltip } from '@openmetadata/ui-core-components';
import { Play } from '@untitledui/icons';
import { Focusable } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { TestCase } from '../../../../generated/tests/testCase';
import { getRunButtonLabelKey } from './RunTestCaseButton.utils';
import { useRunTestCase } from './useRunTestCase';

interface RunTestCaseButtonProps {
  testCase: TestCase;
}

const RunTestCaseButton = ({ testCase }: RunTestCaseButtonProps) => {
  const { t } = useTranslation();
  const {
    activeRunState,
    canRun,
    disabledReasonKey,
    isTriggering,
    run,
    runInProgress,
  } = useRunTestCase(testCase);

  if (!canRun) {
    return null;
  }

  const button = (
    <Button
      showTextWhileLoading
      color="primary"
      data-testid="run-test-case-button"
      iconLeading={Play}
      isDisabled={Boolean(disabledReasonKey)}
      isLoading={isTriggering}
      size="sm"
      onClick={run}>
      {t(getRunButtonLabelKey(activeRunState))}
    </Button>
  );

  // A disabled button ignores the tooltip's trigger context, so the tooltip would
  // never open on it. Focusable hands that context to the span instead, keeping
  // the reason reachable by hover and keyboard without nesting a button in a button.
  if (disabledReasonKey) {
    return (
      <Tooltip placement="top" title={t(disabledReasonKey)}>
        <Focusable>
          <span
            aria-label={t(disabledReasonKey)}
            className="tw:inline-flex"
            role="group">
            {button}
          </span>
        </Focusable>
      </Tooltip>
    );
  }

  // A run in progress does not block another; the button stays usable and says what a click does.
  return runInProgress ? (
    <Tooltip
      placement="top"
      title={t('message.test-case-run-already-in-progress')}>
      {button}
    </Tooltip>
  ) : (
    button
  );
};

export default RunTestCaseButton;
