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
import { Col, Row, Tag, Typography } from 'antd';
import { isEmpty } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  NO_DATA_PLACEHOLDER,
  USER_DATA_SIZE,
} from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/type';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getEntityName } from '../../../utils/EntityUtils';
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
    <Col data-testid="tag-chip" key={item.name}>
      <Link
        className="chip-tag-link"
        data-testid={`${item.name}-link`}
        to={entityUtilClassBase.getEntityLink(
          entityType,
          item.fullyQualifiedName ?? ''
        )}>
        {icon}
        <Typography.Text
          className="text-left chip-tag-link chip-name"
          ellipsis={{ tooltip: getEntityName(item) }}>
          {getEntityName(item)}
        </Typography.Text>
      </Link>
    </Col>
  );

  useEffect(() => {
    setListLength(data?.length ?? 0);
  }, [data]);

  if (isEmpty(data) && showNoDataPlaceholder) {
    return (
      <Typography.Paragraph className="m-t-xs text-sm no-data-chip-placeholder">
        {noDataPlaceholder ?? NO_DATA_PLACEHOLDER}
      </Typography.Paragraph>
    );
  }

  return (
    <Row
      wrap
      className="align-middle d-flex flex-col flex-start justify-center chip-container"
      data-testid="chip-container"
      gutter={[20, 0]}>
      {(isExpanded ? data : data.slice(0, USER_DATA_SIZE)).map(getChipElement)}
      {hasMoreElement && (
        <Tag
          className="m-l-xss chip-text cursor-pointer"
          data-testid="plus-more-count"
          onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded
            ? t('label.show-less')
            : `+${listLength - USER_DATA_SIZE} more`}
        </Tag>
      )}
    </Row>
  );
};

export default Chip;
