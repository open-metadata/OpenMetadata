/*
 *  Copyright 2021 Collate
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

package org.openmetadata.catalog.security.policyevaluator;

/**
 * CommonFields defines all the fields used within the Rules and Facts for the RulesEngine used by {@link
 * PolicyEvaluator}
 */
final class CommonFields {
  private CommonFields() {};

  static final String ALLOW = "allow";
  static final String ALLOWED_OPERATIONS = "allowedOperations";
  static final String CHECK_OPERATION = "checkOperation";
  static final String ENTITY_TAGS = "entityTags";
  static final String ENTITY_TYPE = "entityType";
  static final String OPERATION = "operation";
  static final String USER_ROLES = "userRoles";

  // By default, if no rule matches, do not grant access.
  static final boolean DEFAULT_ACCESS = false;
}
