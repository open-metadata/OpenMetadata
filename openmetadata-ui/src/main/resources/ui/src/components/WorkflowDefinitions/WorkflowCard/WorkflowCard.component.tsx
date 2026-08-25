/*
 *  Copyright 2024 Collate.
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
  Box,
  Card,
  Divider,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useCallback } from 'react';
import { SettingMenuItem } from '../../../utils/GlobalSettingsUtils';

interface WorkflowCardProps {
  data: SettingMenuItem;
  onClick: (key: string) => void;
  className?: string;
}

const WorkflowCard = ({ data, onClick, className }: WorkflowCardProps) => {
  const handleOnClick = useCallback(
    () => onClick(data.key),
    [onClick, data.key]
  );

  const IconComponent = data.icon;
  const titleText = data.category ?? data.label ?? '';

  return (
    <Card
      className={classNames(
        'tw:min-h-40 tw:flex tw:flex-col tw:p-4 tw:cursor-pointer',
        className
      )}
      data-testid={data.key}
      onClick={handleOnClick}>
      <Box align="center" direction="row" gap={2}>
        <Box
          align="center"
          className="tw:size-6 tw:rounded-md tw:bg-brand-solid"
          justify="center">
          {IconComponent && (
            <IconComponent className="tw:size-3 tw:text-white" />
          )}
        </Box>
        <div className="tw:min-w-0 tw:flex-1 tw:overflow-hidden">
          <Typography
            as="p"
            className="tw:text-start tw:min-w-0 tw:max-w-full"
            ellipsis={{ rows: 1 }}
            size="text-sm"
            title={titleText}
            weight="medium">
            {titleText}
          </Typography>
        </div>
      </Box>

      <Divider className="tw:my-3" />

      <Typography
        as="p"
        className="tw:text-start tw:text-secondary"
        ellipsis={{ rows: 3 }}
        size="text-xs"
        title={data.description || undefined}>
        {data.description}
      </Typography>
    </Card>
  );
};

export default WorkflowCard;
