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

import {
  Badge,
  Tooltip,
  TooltipTrigger,
} from '@openmetadata/ui-core-components';
import { Placement } from '@react-types/overlays';
import { InfoCircle } from '@untitledui/icons';
import { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { HelperTextType } from '../../../interface/FormUtils.interface';

export interface FormItemLabelProps {
  label: ReactNode;
  helperText?: ReactNode;
  helperTextType?: HelperTextType;
  showHelperText?: boolean;
  placement?: Placement;
  isBeta?: boolean;
  required?: boolean;
}

const FormItemLabel: FC<FormItemLabelProps> = ({
  helperText,
  helperTextType = HelperTextType.Tooltip,
  isBeta = false,
  label,
  placement = 'top',
  required = false,
  showHelperText = true,
}) => {
  const { t } = useTranslation();

  return (
    <div className="tw:inline-flex tw:items-center tw:gap-1">
      <label
        className="tw:font-medium tw:text-gray-700"
        data-testid="form-item-label">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {helperTextType === HelperTextType.Tooltip &&
        helperText &&
        showHelperText && (
          <Tooltip placement={placement} title={helperText}>
            <TooltipTrigger className="tw:flex tw:items-center tw:leading-none tw:cursor-help">
              <InfoCircle
                className="tw:size-4 tw:text-secondary"
                data-testid="form-item-helper-icon"
              />
            </TooltipTrigger>
          </Tooltip>
        )}
      {isBeta && (
        <Badge
          color="brand"
          data-testid="form-item-beta-badge"
          size="sm"
          type="pill-color">
          {t('label.beta')}
        </Badge>
      )}
    </div>
  );
};

export default FormItemLabel;
