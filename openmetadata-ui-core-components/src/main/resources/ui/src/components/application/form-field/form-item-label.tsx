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

import type { ReactNode } from 'react';
import { HelpCircle } from '@untitledui/icons';
import { Tooltip, TooltipTrigger } from '@/components/base/tooltip/tooltip';

export interface FormItemLabelProps {
  label: ReactNode;
  tooltip?: ReactNode;
  required?: boolean;
}

export const FormItemLabel = ({
  label,
  tooltip,
  required = false,
}: FormItemLabelProps) => (
  <span className="tw:inline-flex tw:items-center tw:gap-1">
    <span data-testid="form-item-label">{label}</span>
    {required && <span className="tw:text-error-primary">*</span>}
    {tooltip && (
      <Tooltip title={tooltip}>
        <TooltipTrigger
          className="tw:cursor-pointer tw:text-fg-quaternary tw:transition tw:duration-200 tw:hover:text-fg-quaternary_hover tw:focus:text-fg-quaternary_hover"
          isDisabled={false}>
          <HelpCircle className="tw:size-4" />
        </TooltipTrigger>
      </Tooltip>
    )}
  </span>
);
