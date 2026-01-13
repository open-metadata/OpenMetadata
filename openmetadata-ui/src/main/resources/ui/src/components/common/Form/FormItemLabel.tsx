/*
 *  Copyright 2023 Collate.
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

import { InfoCircleOutlined } from '@ant-design/icons';
import { Badge, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { GRAYED_OUT_COLOR } from '../../../constants/constants';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { HelperTextType } from '../../../interface/FormUtils.interface';
import { FormItemLabelProps } from './Form.interface';

const FormItemLabel = ({
  label,
  helperText,
  helperTextType = HelperTextType.Tooltip,
  showHelperText = true,
  align,
  overlayInnerStyle,
  overlayClassName,
  placement = 'top',
  isBeta = false,
}: FormItemLabelProps) => {
  const { t } = useTranslation();
  const { theme } = useApplicationStore();

  return (
    <>
      <span data-testid="form-item-label">{label}</span>
      {helperTextType === HelperTextType.Tooltip &&
        helperText &&
        showHelperText && (
          <Tooltip
            destroyTooltipOnHide
            align={align}
            overlayClassName={overlayClassName}
            overlayInnerStyle={overlayInnerStyle}
            placement={placement}
            title={helperText}>
            <InfoCircleOutlined
              className="m-l-xs"
              data-testid="helper-icon"
              style={{ color: GRAYED_OUT_COLOR }}
            />
          </Tooltip>
        )}
      {isBeta && (
        <Badge
          className="m-l-xs"
          color={theme.primaryColor}
          count={t('label.beta')}
          size="small"
        />
      )}
    </>
  );
};

export default FormItemLabel;
