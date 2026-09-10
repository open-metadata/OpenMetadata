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

import React from 'react';

import { ReactComponent as CanvasCheckChangeDescriptionIcon } from '../assets/svg/ic_canvas-check-description.svg';
import { ReactComponent as CanvasEndIcon } from '../assets/svg/ic_canvas-end.svg';
import { ReactComponent as CanvasStartIcon } from '../assets/svg/ic_canvas-start.svg';
import { ReactComponent as CanvasCheckIcon } from '../assets/svg/ic_check-condition-node.svg';
import { ReactComponent as CheckChangeDescriptionIcon } from '../assets/svg/ic_check-description-node.svg';
import { ReactComponent as CanvasCompletenessIcon } from '../assets/svg/ic_data_completeness-node.svg';
import { ReactComponent as CanvasGitSyncIcon } from '../assets/svg/ic_git-sync-node.svg';
import { ReactComponent as GitSyncIcon } from '../assets/svg/ic_git-sync.svg';
import { ReactComponent as CanvasRevertIcon } from '../assets/svg/ic_revert_changes-node.svg';
import { ReactComponent as CanvasActionIcon } from '../assets/svg/ic_set-action-node.svg';
import { ReactComponent as CanvasUserIcon } from '../assets/svg/ic_user_approval-node.svg';

import { ReactComponent as CheckIcon } from '../assets/svg/ic_check-condition.svg';
import { ReactComponent as CompletenessIcon } from '../assets/svg/ic_data-completeness.svg';
import { ReactComponent as EndIcon } from '../assets/svg/ic_end-node.svg';
import { ReactComponent as UserIcon } from '../assets/svg/ic_request-approval.svg';
import { ReactComponent as RevertIcon } from '../assets/svg/ic_revert-changes.svg';
import { ReactComponent as ActionIcon } from '../assets/svg/ic_set-action.svg';
import { ReactComponent as StarIcon } from '../assets/svg/ic_star.svg';
import { ReactComponent as StartIcon } from '../assets/svg/ic_start-node.svg';
import { NodeSubType } from '../generated/governance/workflows/elements/nodeSubType';

type SvgIcon = React.FunctionComponent<React.SVGProps<SVGSVGElement>>;

const CANVAS_NODE_ICON_MAP: Partial<Record<NodeSubType, SvgIcon>> = {
  [NodeSubType.StartEvent]: CanvasStartIcon,
  [NodeSubType.EndEvent]: CanvasEndIcon,
  [NodeSubType.SetEntityAttributeTask]: CanvasActionIcon,
  [NodeSubType.CheckEntityAttributesTask]: CanvasCheckIcon,
  [NodeSubType.CheckChangeDescriptionTask]: CanvasCheckChangeDescriptionIcon,
  [NodeSubType.UserApprovalTask]: CanvasUserIcon,
  [NodeSubType.DataCompletenessTask]: CanvasCompletenessIcon,
  [NodeSubType.RollbackEntityTask]: CanvasRevertIcon,
  [NodeSubType.PolicyAgentTask]: CanvasActionIcon,
  [NodeSubType.SinkTask]: CanvasGitSyncIcon,
};

const NODE_ICON_MAP: Partial<Record<NodeSubType, SvgIcon>> = {
  [NodeSubType.StartEvent]: StartIcon,
  [NodeSubType.EndEvent]: EndIcon,
  [NodeSubType.SetEntityAttributeTask]: ActionIcon,
  [NodeSubType.SetEntityCertificationTask]: ActionIcon,
  [NodeSubType.CheckEntityAttributesTask]: CheckIcon,
  [NodeSubType.CheckChangeDescriptionTask]: CheckChangeDescriptionIcon,
  [NodeSubType.UserApprovalTask]: UserIcon,
  [NodeSubType.DataCompletenessTask]: CompletenessIcon,
  [NodeSubType.RollbackEntityTask]: RevertIcon,
  [NodeSubType.PolicyAgentTask]: ActionIcon,
  [NodeSubType.SinkTask]: GitSyncIcon,
};

export const getCanvasNodeIcon = (
  subType: NodeSubType | undefined,
  props?: React.SVGProps<SVGSVGElement>
): React.ReactElement => {
  const defaultProps = { style: { width: '32px', height: '32px' }, ...props };
  // Fallback to legacy icon if canvas icon doesn't exist
  const Icon = (subType && CANVAS_NODE_ICON_MAP[subType]) ?? StarIcon;

  return <Icon {...defaultProps} />;
};

export const getNodeIcon = (
  subType: NodeSubType | undefined,
  props?: React.SVGProps<SVGSVGElement>
): React.ReactElement => {
  const defaultProps = { style: { width: '32px', height: '32px' }, ...props };
  const Icon = (subType && NODE_ICON_MAP[subType]) ?? StarIcon;

  return <Icon {...defaultProps} />;
};
