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

import { DestinationProblem } from '../../../../utils/observability/alertStatus.utils';

// A configuration to change stops the destination; a failed send may recover on its own.
export const DESTINATION_PROBLEM_ALERT: Record<
  DestinationProblem['kind'],
  { titleKey: string; variant: 'error' | 'warning' }
> = {
  unusable: {
    titleKey: 'message.destination-does-not-send-until-fixed',
    variant: 'error',
  },
  sendFailed: { titleKey: 'label.failure-reason', variant: 'warning' },
};
