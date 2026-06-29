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
import { Badge, Box, Typography } from '@openmetadata/ui-core-components';
import { Check } from '@untitledui/icons';
import classNames from 'classnames';
import { FC } from 'react';
import { getEntityIconWithBg } from '../../../utils/Assets/AssetsUtils';
import { DataAssetPickerRowProps } from './DataAssetPicker.interface';

const DataAssetPickerRow: FC<DataAssetPickerRowProps> = ({
  option,
  isSelected,
  isFocused = false,
  onSelect,
}) => {
  const { label, displayName, name, type, id } = option;
  const title = displayName || name || label;

  return (
    <button
      className={classNames(
        'tw:w-full tw:flex tw:items-center tw:gap-2 tw:px-2.5 tw:py-2 tw:rounded-md tw:mb-1 tw:justify-between',
        'tw:cursor-pointer tw:text-left tw:transition tw:duration-100',
        'tw:hover:bg-utility-gray-blue-50 tw:outline-hidden',
        { 'tw:bg-brand-primary': isSelected },
        { 'tw:bg-utility-gray-blue-50': isFocused && !isSelected }
      )}
      data-picker-item="true"
      type="button"
      onClick={() => onSelect(option)}>
      <Box align="center" className="tw:min-w-0 tw:flex-1" gap={2}>
        {type && getEntityIconWithBg(type)}

        <Box
          align="center"
          className="tw:min-w-0 tw:flex-1"
          gap={3}
          justify="between">
          <Box
            className="tw:min-w-0 tw:flex-1 tw:[&_.prose]:leading-tight"
            direction="col">
            <Typography
              ellipsis
              className="tw:truncate tw:leading-tight"
              size="text-xs"
              weight="medium">
              {title}
            </Typography>
            {id && (
              <Typography
                ellipsis
                className="tw:text-tertiary tw:truncate tw:leading-tight"
                size="text-xs">
                {id}
              </Typography>
            )}
          </Box>
          {type && (
            <Badge
              className="tw:shrink-0 tw:uppercase tw:font-medium"
              color="gray"
              size="xs"
              type="color">
              {type}
            </Badge>
          )}
        </Box>
      </Box>
      {isSelected && (
        <Check className="tw:shrink-0" size={16} strokeWidth={1.5} />
      )}
    </button>
  );
};

export default DataAssetPickerRow;
