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

import { BulkOperationResult } from '../../generated/type/bulkOperationResult';

// Domain bulk-asset dryRun returns Status.Success with side-effect text in
// successRequest[*].message — unlike glossary tag / CSV-import dryRun, which
// signal failures via Status / failedRequest. We match the message text
// produced by DomainRepository.buildDryRunImpactMessage. If a structured
// impact field is added to Response, drop this matcher.
const DOMAIN_DRY_RUN_WARN_PHRASES = [
  'will be moved from',
  'data product relationships will be removed',
  'data product relationships will also be removed',
];

export const hasDomainDryRunImpact = (res: BulkOperationResult): boolean =>
  res.successRequest?.some((r) =>
    DOMAIN_DRY_RUN_WARN_PHRASES.some((phrase) => r.message?.includes(phrase))
  ) ?? false;
