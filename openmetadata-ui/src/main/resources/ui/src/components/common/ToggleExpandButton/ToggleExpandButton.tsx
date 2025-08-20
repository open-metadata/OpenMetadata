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

import { Button, Space } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DownUpArrowIcon from '../../../assets/svg/ic-down-up-arrow.svg?react';
import UpDownArrowIcon from '../../../assets/svg/ic-up-down-arrow.svg?react';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { ToggleExpandButtonProps } from './ToggleExpandButton.interface';

function ToggleExpandButton({
  expandedRowKeys,
  allRowKeys,
  toggleExpandAll,
}: ToggleExpandButtonProps) {
  const { t } = useTranslation();

  const showCollapseAllText = useMemo(
    () => expandedRowKeys.length === allRowKeys.length,
    [expandedRowKeys, allRowKeys]
  );

  return (
    <Button
      className="text-primary rounded-4"
      data-testid="toggle-expand-button"
      size="small"
      type="text"
      onClick={toggleExpandAll}>
      <Space align="center" size={4}>
        {showCollapseAllText ? (
          <DownUpArrowIcon
            color={DE_ACTIVE_COLOR}
            data-testid="collapse-icon"
            height="14px"
          />
        ) : (
          <UpDownArrowIcon
            color={DE_ACTIVE_COLOR}
            data-testid="expand-icon"
            height="14px"
          />
        )}

        {showCollapseAllText ? t('label.collapse-all') : t('label.expand-all')}
      </Space>
    </Button>
  );
}

export default ToggleExpandButton;
