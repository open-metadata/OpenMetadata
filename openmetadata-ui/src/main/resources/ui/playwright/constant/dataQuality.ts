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

export const TEST_CASE_LAST_RUN_BANNER_TEST_IDS = {
  aborted: 'test-case-last-run-banner-aborted',
  failed: 'test-case-last-run-banner-failed',
  'not-run-yet': 'test-case-last-run-banner-not-run-yet',
  queued: 'test-case-last-run-banner-queued',
  success: 'test-case-last-run-banner-success',
} as const;

export type TestCaseLastRunBannerStatus =
  keyof typeof TEST_CASE_LAST_RUN_BANNER_TEST_IDS;
