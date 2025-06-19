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
import { ReactComponent as AbortedIcon } from '../assets/svg/aborted-status.svg';
import { ReactComponent as DeprecatedIcon } from '../assets/svg/arrow-down-colored.svg';
import { ReactComponent as ApprovedIcon } from '../assets/svg/check-colored.svg';
import { ReactComponent as DraftIcon } from '../assets/svg/clipboard-colored.svg';
import { ReactComponent as InReviewIcon } from '../assets/svg/eye-colored.svg';
import { ReactComponent as ActiveErrorIcon } from '../assets/svg/ic-alert-circle.svg';
import { ReactComponent as CompletedIcon } from '../assets/svg/ic-check-circle-colored.svg';
import { ReactComponent as PendingIcon } from '../assets/svg/ic-pause.svg';
import { ReactComponent as RunningIcon } from '../assets/svg/ic-play.svg';
import { ReactComponent as StartedIcon } from '../assets/svg/ic-rocket.svg';
import { ReactComponent as StoppedIcon } from '../assets/svg/ic-stop-circle.svg';
import { ReactComponent as RejectedIcon } from '../assets/svg/x-colored.svg';
import { Status as AppStatus } from '../generated/entity/applications/appRunRecord';
import { Status } from '../generated/entity/data/glossaryTerm';
import { TestCaseStatus } from '../generated/tests/testCase';

export type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

export type AllStatusTypes = Status | AppStatus | TestCaseStatus;

export const icons: Partial<Record<AllStatusTypes, IconComponent>> = {
  [Status.Approved]: ApprovedIcon,
  [Status.Rejected]: RejectedIcon,
  [Status.InReview]: InReviewIcon,
  [Status.Draft]: DraftIcon,
  [Status.Deprecated]: DeprecatedIcon,
  [AppStatus.Active]: ApprovedIcon,
  [AppStatus.Completed]: CompletedIcon,
  [AppStatus.Failed]: RejectedIcon,
  [AppStatus.Running]: RunningIcon,
  [AppStatus.Started]: StartedIcon,
  [AppStatus.Stopped]: StoppedIcon,
  [AppStatus.Success]: ApprovedIcon,
  [AppStatus.Pending]: PendingIcon,
  [AppStatus.ActiveError]: ActiveErrorIcon,
  [TestCaseStatus.Aborted]: AbortedIcon,
};
