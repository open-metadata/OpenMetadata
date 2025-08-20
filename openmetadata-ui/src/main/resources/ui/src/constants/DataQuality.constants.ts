/*
 *  Copyright 2025 Collate.
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
import SkippedIcon from '../assets/svg/ic-aborted.svg?react';
import FailedIcon from '../assets/svg/ic-fail.svg?react';
import SuccessIcon from '../assets/svg/ic-successful.svg?react';

export const TEST_CASE_STATUS_ICON = {
  Aborted: SkippedIcon,
  Failed: FailedIcon,
  Queued: SkippedIcon,
  Success: SuccessIcon,
};
