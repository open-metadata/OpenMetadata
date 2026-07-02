/*
 *  Copyright 2022 Collate.
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

import Icon from '@ant-design/icons/lib/components/Icon';
import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import { Edit05, XCircle } from '@untitledui/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconSuccessBadge } from '../../../assets/svg/success-badge.svg';
import './applied-filter-text.less';

interface AppliedFilterTextProps {
  filterText: string;
  onEdit: () => void;
  onClear: () => void;
}

const AppliedFilterText: FC<AppliedFilterTextProps> = ({
  filterText,
  onEdit,
  onClear,
}) => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:ml-2"
      colGap={2}
      data-testid="advance-search-filter-container">
      <Typography className="tw:text-tertiary">
        {t('label.advanced-search')}
      </Typography>
      <Box
        align="center"
        className="advanced-filter-text tw:flex-1"
        justify="between">
        <Box className="w-full" colGap={2}>
          <Icon
            alt="success-badge"
            className="align-middle m-l-xs"
            component={IconSuccessBadge}
            style={{ fontSize: '16px' }}
          />
          <Typography data-testid="advance-search-filter-text">
            {filterText}
          </Typography>
        </Box>
        <Box>
          <Button
            color="tertiary"
            data-testid="advance-search-filter-btn"
            iconLeading={<Edit05 size={16} />}
            size="sm"
            onClick={onEdit}
          />
          <Button
            color="tertiary"
            data-testid="advance-search-clear-btn"
            iconLeading={<XCircle size={16} />}
            onClick={onClear}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default AppliedFilterText;
