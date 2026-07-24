/*
 *  Copyright 2023 Collate.
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

import { Box, Button } from '@openmetadata/ui-core-components';
import { startCase } from 'lodash';
import { TestCaseFailureReasonType } from '../../../../../generated/tests/testCaseResolutionStatus';
import { WhiteCheckIcon } from './IncidentStatusIcons';

type FailureReasonChipGroupProps = {
  selectedReason: TestCaseFailureReasonType | null;
  onSelect: (reason: TestCaseFailureReasonType) => void;
};

export const FailureReasonChipGroup = ({
  selectedReason,
  onSelect,
}: FailureReasonChipGroupProps) => (
  <Box align="start" direction="row" gap={2} wrap="wrap">
    {Object.values(TestCaseFailureReasonType).map((reason) => {
      const isSel = selectedReason === reason;

      return (
        <Button
          className="tw:rounded-md tw:text-xs"
          color={isSel ? 'primary' : 'secondary'}
          data-testid={`reason-chip-${reason}`}
          iconLeading={isSel ? WhiteCheckIcon : undefined}
          key={reason}
          size="sm"
          onPress={() => onSelect(reason)}>
          {startCase(reason)}
        </Button>
      );
    })}
  </Box>
);
