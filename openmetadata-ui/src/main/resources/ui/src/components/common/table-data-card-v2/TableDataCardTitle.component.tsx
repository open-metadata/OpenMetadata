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

import { Button, Typography } from 'antd';
import { ReactComponent as IconExternalLink } from 'assets/svg/external-link.svg';
import classNames from 'classnames';
import { toString } from 'lodash';
import React, { useMemo } from 'react';
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
import './TableDataCardTitle.less';

interface TableDataCardTitleProps {
  dataTestId?: string;
  id?: string;
  searchIndex: SearchIndex | EntityType;
  source: {
    fullyQualifiedName?: string;
    displayName?: string;
    name?: string;
    type?: string;
  };
  isPanel?: boolean;
  handleLinkClick?: (e: React.MouseEvent) => void;
  openEntityInNewPage?: boolean;
}

const TableDataCardTitle = ({
  dataTestId,
  id,
  searchIndex,
  source,
  handleLinkClick,
  isPanel = false,
  openEntityInNewPage = false,
}: TableDataCardTitleProps) => {
  const isTourRoute = location.pathname.includes(ROUTES.TOUR);

  const { testId, displayName } = useMemo(
    () => ({
      testId: dataTestId
        ? dataTestId
        : `${getPartialNameFromTableFQN(source.fullyQualifiedName ?? '', [
            FqnPart.Service,
          ])}-${source.name}`,
      displayName:
        source.type === 'tag'
          ? toString(getNameFromFQN(source.fullyQualifiedName ?? ''))
          : toString(source.displayName),
    }),
    [dataTestId, source]
  );

  const title = (
    <Button
      data-testid={testId}
      id={`${id ?? testId}-title`}
      type="link"
      onClick={isTourRoute ? handleLinkClick : undefined}>
      {stringToHTML(displayName)}
      {openEntityInNewPage && (
        <IconExternalLink className="anticon" height={14} />
      )}
    </Button>
  );

  if (isTourRoute) {
    return title;
  }

  return (
    <Typography.Title
      ellipsis
      className="m-b-0 text-base"
      level={5}
      title={displayName}>
      <Link
        className={classNames(
          'table-data-card-title-container w-fit-content w-max-90',
          {
            'button-hover': isPanel,
          }
        )}
        target={openEntityInNewPage ? '_blank' : '_self'}
        to={getEntityLink(searchIndex, source.fullyQualifiedName ?? '')}>
        {title}
      </Link>
    </Typography.Title>
  );
};

export default TableDataCardTitle;
