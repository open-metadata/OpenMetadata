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
import { Col, Popover, Row, Space, Tag, Typography } from 'antd';
import { isEmpty } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import {
  NO_DATA_PLACEHOLDER,
  USER_DATA_SIZE,
} from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/type';
import { getEntityName } from '../../../utils/EntityUtils';
import { ChipProps } from './Chip.interface';

const Chip = ({
  data,
  icon,
  noDataPlaceholder,
  showNoDataPlaceholder = true,
}: ChipProps) => {
  const [listLength, setListLength] = useState<number>(0);

  const hasMoreElement = useMemo(
    () => listLength > USER_DATA_SIZE,
    [listLength]
  );

  const getChipElement = (item: EntityReference) => (
    <Col
      className="d-flex gap-1 items-center"
      data-testid={item.name}
      key={item.name}>
      {icon}
      <Typography.Text className="text-left">
        {getEntityName(item)}
      </Typography.Text>
    </Col>
  );

  useEffect(() => {
    setListLength(data?.length ?? 0);
  }, [data]);

  if (isEmpty(data) && showNoDataPlaceholder) {
    return (
      <Typography.Paragraph className="text-grey-muted m-b-0">
        {noDataPlaceholder ?? NO_DATA_PLACEHOLDER}
      </Typography.Paragraph>
    );
  }

  return (
    <Row
      wrap
      className="align-middle"
      data-testid="chip-container"
      gutter={[20, 6]}>
      {data.slice(0, USER_DATA_SIZE).map(getChipElement)}
      {hasMoreElement && (
        <Popover
          className="cursor-pointer"
          content={
            <Space wrap size={6}>
              {data.slice(USER_DATA_SIZE).map(getChipElement)}
            </Space>
          }
          overlayClassName="w-56"
          trigger="click">
          <Tag className="m-l-xss" data-testid="plus-more-count">{`+${
            listLength - USER_DATA_SIZE
          } more`}</Tag>
        </Popover>
      )}
    </Row>
  );
};

export default Chip;
