/*
 *  Copyright 2022 Collate
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
import { Button, Typography } from 'antd';
import React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import { EntityType, FqnPart } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import {
  getNameFromFQN,
  getPartialNameFromTableFQN,
} from '../../../utils/CommonUtils';
import { stringToHTML } from '../../../utils/StringsUtils';
import { getEntityLink } from '../../../utils/TableUtils';
import { SourceType } from '../../searched-data/SearchedData.interface';
import './TableDataCardTitle.less';

interface TableDataCardTitleProps {
  id?: string;
  searchIndex: SearchIndex | EntityType;
  source: SourceType;
  handleLinkClick?: (e: React.MouseEvent) => void;
}

const TableDataCardTitle = ({
  id,
  searchIndex,
  source,
  handleLinkClick,
}: TableDataCardTitleProps) => {
  const isTourRoute = location.pathname.includes(ROUTES.TOUR);

  const title = (
    <Button
      className="tw-text-grey-body tw-font-semibold"
      data-testid={`${getPartialNameFromTableFQN(
        source.fullyQualifiedName ?? '',
        [FqnPart.Service]
      )}-${getNameFromFQN(source.fullyQualifiedName ?? '')}`}
      id={`${id}Title`}
      type="link"
      onClick={isTourRoute ? handleLinkClick : undefined}>
      <Typography.Title level={5}>{stringToHTML(source.name)}</Typography.Title>
    </Button>
  );

  if (isTourRoute) {
    return title;
  }

  return (
    <Link
      className="table-data-card-title-container"
      to={getEntityLink(searchIndex, source.fullyQualifiedName ?? '')}>
      {title}
    </Link>
  );
};

export default TableDataCardTitle;
