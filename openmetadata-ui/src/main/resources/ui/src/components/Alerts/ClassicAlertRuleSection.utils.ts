/*
 *  Copyright 2024 Collate.
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
  ArgumentsInput,
  EventFilterRule,
} from '../../generated/events/eventSubscription';
import { getRuleItems } from '../observability/Alerts/AlertAiFormFieldsPureUtils';

export const getClassicRuleItems = (
  supportedRules: EventFilterRule[] | undefined,
  rules: ArgumentsInput[]
) => {
  const items = getRuleItems(supportedRules, rules);

  return [
    ...items,
    ...rules
      .filter(
        (rule) => rule.name && !items.some((item) => item.id === rule.name)
      )
      .map((rule) => ({
        id: rule.name ?? '',
        label: rule.name ?? '',
        isDisabled: true,
      })),
  ];
};
