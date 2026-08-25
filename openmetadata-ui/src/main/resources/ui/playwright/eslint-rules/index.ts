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

import justifiedRuleDisable from './justified-rule-disable.ts';
import noBlanketTestSlow from './no-blanket-test-slow.ts';
import noPositionalLocator from './no-positional-locator.ts';
import requireAssertionPerTest from './require-assertion-per-test.ts';
import requireResponseListenerBeforeAction from './require-response-listener-before-action.ts';

export default {
  rules: {
    'require-response-listener-before-action':
      requireResponseListenerBeforeAction,
    'no-blanket-test-slow': noBlanketTestSlow,
    'require-assertion-per-test': requireAssertionPerTest,
    'no-positional-locator': noPositionalLocator,
    'justified-rule-disable': justifiedRuleDisable,
  },
};
