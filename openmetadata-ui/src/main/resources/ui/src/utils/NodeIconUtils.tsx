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

import {
  WorkflowCheckConditions,
  WorkflowDataCompleteness,
  WorkflowDetectFieldChange,
  WorkflowEnd,
  WorkflowGitSync,
  WorkflowPolicyEnforcement,
  WorkflowRequestApproval,
  WorkflowRevertChanges,
  WorkflowSetAction,
  WorkflowStart,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import React from 'react';

import { ReactComponent as StarIcon } from '../assets/svg/ic_star.svg';
import { NodeSubType } from '../generated/governance/workflows/elements/nodeSubType';

type SvgIcon = React.FunctionComponent<React.SVGProps<SVGSVGElement>>;

const CANVAS_NODE_ICON_MAP: Partial<Record<NodeSubType, SvgIcon>> = {
  [NodeSubType.StartEvent]: WorkflowStart,
  [NodeSubType.EndEvent]: WorkflowEnd,
  [NodeSubType.SetEntityAttributeTask]: WorkflowSetAction,
  [NodeSubType.CheckEntityAttributesTask]: WorkflowCheckConditions,
  [NodeSubType.CheckChangeDescriptionTask]: WorkflowDetectFieldChange,
  [NodeSubType.UserApprovalTask]: WorkflowRequestApproval,
  [NodeSubType.DataCompletenessTask]: WorkflowDataCompleteness,
  [NodeSubType.RollbackEntityTask]: WorkflowRevertChanges,
  [NodeSubType.PolicyAgentTask]: WorkflowPolicyEnforcement,
  [NodeSubType.SinkTask]: WorkflowGitSync,
};

const NODE_ICON_MAP: Partial<Record<NodeSubType, SvgIcon>> = {
  [NodeSubType.StartEvent]: WorkflowStart,
  [NodeSubType.EndEvent]: WorkflowEnd,
  [NodeSubType.SetEntityAttributeTask]: WorkflowSetAction,
  [NodeSubType.SetEntityCertificationTask]: WorkflowSetAction,
  [NodeSubType.CheckEntityAttributesTask]: WorkflowCheckConditions,
  [NodeSubType.CheckChangeDescriptionTask]: WorkflowDetectFieldChange,
  [NodeSubType.UserApprovalTask]: WorkflowRequestApproval,
  [NodeSubType.DataCompletenessTask]: WorkflowDataCompleteness,
  [NodeSubType.RollbackEntityTask]: WorkflowRevertChanges,
  [NodeSubType.PolicyAgentTask]: WorkflowPolicyEnforcement,
  [NodeSubType.SinkTask]: WorkflowGitSync,
};

const ICON_COLOR = {
  brand: 'tw:text-utility-brand-500',
  success: 'tw:text-utility-success-700',
  error: 'tw:text-utility-error-700',
  warning: 'tw:text-utility-warning-700',
  info: 'tw:text-utility-blue-light-600',
  approval: 'tw:text-utility-pink-600',
  sink: 'tw:text-utility-purple-600',
  fallback: 'tw:text-quaternary',
} as const;

const NODE_ICON_COLOR_MAP: Partial<Record<NodeSubType, string>> = {
  [NodeSubType.StartEvent]: ICON_COLOR.success,
  [NodeSubType.EndEvent]: ICON_COLOR.error,
  [NodeSubType.SetEntityAttributeTask]: ICON_COLOR.brand,
  [NodeSubType.SetEntityCertificationTask]: ICON_COLOR.brand,
  [NodeSubType.CheckEntityAttributesTask]: ICON_COLOR.warning,
  [NodeSubType.CheckChangeDescriptionTask]: ICON_COLOR.info,
  [NodeSubType.UserApprovalTask]: ICON_COLOR.approval,
  [NodeSubType.DataCompletenessTask]: ICON_COLOR.success,
  [NodeSubType.RollbackEntityTask]: ICON_COLOR.error,
  [NodeSubType.PolicyAgentTask]: ICON_COLOR.brand,
  [NodeSubType.SinkTask]: ICON_COLOR.sink,
};

const ICON_SIZE_CLASS = {
  sm: 'tw:size-4',
  md: 'tw:size-8',
} as const;

interface NodeIconOptions {
  className?: string;
  size?: keyof typeof ICON_SIZE_CLASS;
}

const renderNodeIcon = (
  Icon: SvgIcon,
  subType: NodeSubType | undefined,
  { className, size = 'md' }: NodeIconOptions = {}
): React.ReactElement => (
  <Icon
    className={classNames(
      ICON_SIZE_CLASS[size],
      (subType && NODE_ICON_COLOR_MAP[subType]) ?? ICON_COLOR.fallback,
      className
    )}
  />
);

export const getCanvasNodeIcon = (
  subType: NodeSubType | undefined,
  options?: NodeIconOptions
): React.ReactElement =>
  renderNodeIcon(
    (subType && CANVAS_NODE_ICON_MAP[subType]) ?? StarIcon,
    subType,
    options
  );

export const getNodeIcon = (
  subType: NodeSubType | undefined,
  options?: NodeIconOptions
): React.ReactElement =>
  renderNodeIcon(
    (subType && NODE_ICON_MAP[subType]) ?? StarIcon,
    subType,
    options
  );
