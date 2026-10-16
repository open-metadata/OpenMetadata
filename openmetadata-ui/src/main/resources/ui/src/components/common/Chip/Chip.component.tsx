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
import { Badge, Box, Typography } from '@openmetadata/ui-core-components';
import { getLayoutGutter } from '../../../utils/common/layout.utils';

import { isEmpty } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  NO_DATA_PLACEHOLDER,
  USER_DATA_SIZE,
} from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/type';
import { getEntityName } from '../../../utils/EntityNameUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { ChipProps } from './Chip.interface';
import './chip.less';

const Chip = ({
  data,
  icon,
  entityType,
  noDataPlaceholder,
  showNoDataPlaceholder = true,
}: ChipProps) => {
  const [listLength, setListLength] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const { t } = useTranslation();

  const hasMoreElement = useMemo(
    () => listLength > USER_DATA_SIZE,
    [listLength]
  );

  const getChipElement = (item: EntityReference) => (
    <Box
      className="layout-column tw:block"
      data-testid="tag-chip"
      key={item.name}>
      <Link
        className="chip-tag-link"
        data-testid={`${item.name}-link`}
        to={entityUtilClassBase.getEntityLink(
          entityType,
          item.fullyQualifiedName ?? ''
        )}>
        {icon}
        <Typography
          className="text-left chip-tag-link chip-name"
          ellipsis={{
            tooltip: getEntityName(item),
            excludeTriggerFromTabOrder: true,
          }}>
          {getEntityName(item)}
        </Typography>
      </Link>
    </Box>
  );

  useEffect(() => {
    setListLength(data?.length ?? 0);
  }, [data]);

  if (isEmpty(data) && showNoDataPlaceholder) {
    return (
      <Typography
        as="p"
        className="m-t-xs text-sm no-data-chip-placeholder tw:mb-3.5!">
        {noDataPlaceholder ?? NO_DATA_PLACEHOLDER}
      </Typography>
    );
  }

  return (
    <Box
      className="layout-row align-middle d-flex flex-col flex-start justify-center chip-container"
      data-testid="chip-container"
      style={getLayoutGutter(20)}
      wrap="wrap">
      {(isExpanded ? data : data.slice(0, USER_DATA_SIZE)).map(getChipElement)}
      {hasMoreElement && (
        <Badge
          bordered={false}
          className="tw:mr-2 m-l-xss chip-text cursor-pointer"
          data-testid="plus-more-count"
          size="sm"
          type="color"
          onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded
            ? t('label.show-less')
            : `+${listLength - USER_DATA_SIZE} more`}
        </Badge>
      )}
    </Box>
  );
};

export default Chip;
