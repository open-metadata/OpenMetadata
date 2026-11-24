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
  PLACEHOLDER_ROUTE_FQN,
  PLACEHOLDER_ROUTE_TAB,
} from '../../../constants/constants';
import { getEncodedFqn } from '../../../utils/StringUtils';
import { OBSERVABILITY_ROUTES } from '../observability.constants';

export const getAlertsObservabilityDetailsPath = (
  alertFqn: string,
  tab?: string
): string => {
  return tab
    ? OBSERVABILITY_ROUTES.OBSERVABILITY_ALERT_DETAILS_WITH_TAB.replace(
        PLACEHOLDER_ROUTE_FQN,
        getEncodedFqn(alertFqn)
      ).replace(PLACEHOLDER_ROUTE_TAB, tab)
    : OBSERVABILITY_ROUTES.OBSERVABILITY_ALERT_DETAILS.replace(
        PLACEHOLDER_ROUTE_FQN,
        getEncodedFqn(alertFqn)
      );
};
