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

import { Alert } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { DestinationProblem } from '../../../../utils/observability/alertStatus.utils';
import { DESTINATION_PROBLEM_ALERT } from './DestinationProblemAlert.constants';

interface DestinationProblemAlertProps {
  problem: DestinationProblem;
  'data-testid'?: string;
}

/** Why a destination is not sending, as the alert list says it, next to the destination. */
function DestinationProblemAlert({
  problem,
  'data-testid': testId,
}: Readonly<DestinationProblemAlertProps>) {
  const { t } = useTranslation();
  const { titleKey, variant } = DESTINATION_PROBLEM_ALERT[problem.kind];

  return (
    <Alert data-testid={testId} title={t(titleKey)} variant={variant}>
      {problem.reason}
    </Alert>
  );
}

export default DestinationProblemAlert;
