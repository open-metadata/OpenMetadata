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
import { uuid } from '../utils/common';

export const DEFAULT_POLICIES = {
  dataConsumerPolicy: 'Data Consumer Policy',
  dataStewardPolicy: 'Data Steward Policy',
  organizationPolicy: 'Organization Policy',
  teamOnlyAccessPolicy: 'Team only access Policy',
};

export const RULE_DETAILS = {
  resources: 'All',
  operations: 'All',
  effect: 'Allow',
  condition: 'isOwner()',
  inValidCondition: 'isOwner(',
};

export const ERROR_MESSAGE_VALIDATION = {
  lastPolicyCannotBeRemoved: 'At least one policy is required in a role',
  lastRuleCannotBeRemoved: 'At least one rule is required in a policy',
};

export const POLICY_NAME = `Policy-test-${uuid()}`;
export const DESCRIPTION = `This is ${POLICY_NAME} description`;

export const RULE_NAME = `Rule / test-${uuid()}`;
export const RULE_DESCRIPTION = `This is ${RULE_NAME} description`;
export const UPDATED_DESCRIPTION = 'This is updated description';

export const NEW_RULE_NAME = `New / Rule-test-${uuid()}`;
export const NEW_RULE_DESCRIPTION = `This is ${NEW_RULE_NAME} description`;

export const UPDATED_RULE_NAME = `New-Rule-test-${uuid()}-updated`;
