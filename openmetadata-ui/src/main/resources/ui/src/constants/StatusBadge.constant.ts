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
import { BadgeColors } from '@openmetadata/ui-core-components';
import {
  AlertCircle,
  ArrowDown,
  Check,
  CheckCircle02,
  Clipboard,
  Eye,
  Play,
  Rocket01,
  SlashCircle01,
  XCircle,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { ReactComponent as PendingIcon } from '../assets/svg/ic-pause.svg';
import { ReactComponent as StoppedIcon } from '../assets/svg/ic-stop-circle.svg';
import { StatusType } from '../components/common/StatusBadge/StatusBadge.interface';
import { Status as AppStatus } from '../generated/entity/applications/appRunRecord';
import { EntityStatus } from '../generated/entity/data/glossaryTerm';
import { TestCaseStatus } from '../generated/tests/testCase';

export type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

export type AllStatusTypes = EntityStatus | AppStatus | TestCaseStatus;

export const icons: Partial<Record<AllStatusTypes, IconComponent>> = {
  [EntityStatus.Approved]: Check,
  [EntityStatus.Rejected]: XClose,
  [EntityStatus.InReview]: Eye,
  [EntityStatus.Draft]: Clipboard,
  [EntityStatus.Deprecated]: ArrowDown,
  [EntityStatus.Archived]: ArrowDown,
  [AppStatus.Active]: Check,
  [AppStatus.Completed]: CheckCircle02,
  [AppStatus.Failed]: XClose,
  [AppStatus.Running]: Play,
  [AppStatus.Started]: Rocket01,
  [AppStatus.Stopped]: StoppedIcon,
  [AppStatus.Success]: Check,
  [AppStatus.Pending]: PendingIcon,
  [AppStatus.ActiveError]: AlertCircle,
  [TestCaseStatus.Aborted]: SlashCircle01,
};

export const iconsV2: Partial<Record<StatusType, IconComponent>> = {
  [StatusType.Success]: CheckCircle02,
  [StatusType.Warning]: AlertCircle,
  [StatusType.Failure]: XCircle,
  [StatusType.ActiveError]: Clipboard,
  [StatusType.Running]: Play,
  [StatusType.Started]: Rocket01,
  [StatusType.Stopped]: StoppedIcon,
  [StatusType.Pending]: PendingIcon,
  [StatusType.InReview]: Eye,
  [StatusType.Deprecated]: ArrowDown,
  [StatusType.Aborted]: SlashCircle01,
  [StatusType.Archived]: ArrowDown,
};

// Maps each StatusType to the nearest core Badge (utility-scale) color. The
// utility palette auto-flips in dark, so every status gains dark support for
// free; the hue is chosen to stay closest to the legacy light color.
export const STATUS_TYPE_TO_BADGE_COLOR: Record<StatusType, BadgeColors> = {
  [StatusType.Success]: 'success',
  [StatusType.Warning]: 'warning',
  [StatusType.Pending]: 'warning',
  [StatusType.Failure]: 'error',
  [StatusType.Stopped]: 'error',
  [StatusType.ActiveError]: 'error',
  [StatusType.Aborted]: 'orange',
  [StatusType.Running]: 'brand',
  [StatusType.Acknowledged]: 'blue',
  [StatusType.Started]: 'purple',
  [StatusType.InReview]: 'purple',
  [StatusType.Version]: 'purple',
  [StatusType.Deprecated]: 'gray',
  [StatusType.Archived]: 'gray',
  [StatusType.Unprocessed]: 'gray',
};
