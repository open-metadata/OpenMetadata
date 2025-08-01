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
import { ReactComponent as SkippedIcon } from '../assets/svg/ic-aborted.svg';
import { ReactComponent as FailedIcon } from '../assets/svg/ic-fail.svg';
import { ReactComponent as SuccessIcon } from '../assets/svg/ic-successful.svg';

export const TEST_CASE_STATUS_ICON = {
  Aborted: SkippedIcon,
  Failed: FailedIcon,
  Queued: SkippedIcon,
  Success: SuccessIcon,
};
