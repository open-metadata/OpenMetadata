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
import AbortedIcon from '../assets/svg/aborted-status.svg?react';
import DeprecatedIcon from '../assets/svg/arrow-down-colored.svg?react';
import ApprovedIcon from '../assets/svg/check-colored.svg?react';
import DraftIcon from '../assets/svg/clipboard-colored.svg?react';
import InReviewIcon from '../assets/svg/eye-colored.svg?react';
import FailedIcon from '../assets/svg/fail-badge.svg?react';
import ActiveErrorIcon from '../assets/svg/ic-alert-circle.svg?react';
import CompletedIcon from '../assets/svg/ic-check-circle-colored.svg?react';
import PendingIcon from '../assets/svg/ic-pause.svg?react';
import RunningIcon from '../assets/svg/ic-play.svg?react';
import StartedIcon from '../assets/svg/ic-rocket.svg?react';
import StoppedIcon from '../assets/svg/ic-stop-circle.svg?react';
import RejectedIcon from '../assets/svg/x-colored.svg?react';
import { StatusType } from '../components/common/StatusBadge/StatusBadge.interface';
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

export const iconsV2: Partial<Record<StatusType, IconComponent>> = {
  [StatusType.Success]: CompletedIcon,
  [StatusType.Warning]: ActiveErrorIcon,
  [StatusType.Failure]: FailedIcon,
  [StatusType.ActiveError]: DraftIcon,
  [StatusType.Running]: RunningIcon,
  [StatusType.Started]: StartedIcon,
  [StatusType.Stopped]: StoppedIcon,
  [StatusType.Pending]: PendingIcon,
  [StatusType.InReview]: InReviewIcon,
  [StatusType.Deprecated]: DeprecatedIcon,
};
