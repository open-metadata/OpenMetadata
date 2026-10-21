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
import {
  Grid,
  ProgressBar,
  Typography,
} from '@openmetadata/ui-core-components';

import classNames from 'classnames';
import { round } from 'lodash';
import { ReactNode } from 'react';
import { GRAYED_OUT_COLOR } from '../../constants/constants';

type EntitySummaryProgressBarProps = {
  pluralize?: boolean;
  isActive?: boolean;
  progress: number;
  entity: string;
  label?: ReactNode;
  strokeColor?: string;
};

const EntitySummaryProgressBar = ({
  isActive = true,
  pluralize = true,
  entity,
  progress,
  label,
  strokeColor,
}: EntitySummaryProgressBarProps) => {
  const pluralizeName = (entity: string) => {
    return entity + 's';
  };

  return (
    <Grid
      className={`layout-row layout-grid ${classNames({
        'non-active-details': !isActive,
      })}`}
      data-testid="entity-summary-container">
      <Grid.Item className="layout-column tw:col-span-24 tw:min-[576px]:col-span-24 tw:min-[768px]:col-span-12 d-flex justify-between items-center text-xs">
        <Typography
          as="p"
          className="m-b-0 entity-summary-name tw:wrap-break-word"
          data-testid="entity-name">
          {pluralize ? pluralizeName(entity) : entity}
        </Typography>

        <Typography
          as="p"
          className="m-b-0 entity-summary-value"
          data-testid="entity-value">
          {label ?? round(progress || 0, 2)}
        </Typography>
      </Grid.Item>
      <Grid.Item className="layout-column tw:col-span-24 tw:min-[576px]:col-span-24 tw:min-[768px]:col-span-12">
        <div data-testid="progress-bar">
          <ProgressBar
            className="p-l-xss"
            color={isActive ? strokeColor : GRAYED_OUT_COLOR}
            value={Math.min(100, Math.max(0, progress || 0))}
          />
        </div>
      </Grid.Item>
    </Grid>
  );
};

export default EntitySummaryProgressBar;
