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

import { Typography } from 'antd';
import { toString } from 'lodash';
import React, { useMemo } from 'react';
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
}

const TableDataCardTitle = ({
  dataTestId,
  id,
  searchIndex,
  source,
  handleLinkClick,
  isPanel = false,
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

  //   const title = (
  //     <Button
  //       data-testid={testId}
  //       href={
  //         isTourRoute
  //           ? ''
  //           : getEntityLink(searchIndex, source.fullyQualifiedName ?? '')
  //       }
  //       id={`${id ?? testId}-title`}
  //       type="link"
  //       onClick={isTourRoute ? handleLinkClick : undefined}>

  //     </Button>
  //   );

  //   if (isTourRoute) {
  //     return title;
  //   }

  return (
    <div>
      <Typography.Paragraph
        className="text-secondary-muted m-b-0"
        style={{ color: '#6B7280', fontSize: '12px', lineHeight: '15px' }}>
        {source.name}
      </Typography.Paragraph>
      <Typography.Link
        ellipsis
        className="m-b-0 text-base"
        href={
          isTourRoute
            ? ''
            : getEntityLink(searchIndex, source.fullyQualifiedName ?? '')
        }
        style={{
          fontSize: '18px',
          lineHeight: '22px',
          fontWeight: 700,
        }}
        title={displayName}>
        {stringToHTML(displayName)}
      </Typography.Link>
    </div>
  );
};

export default TableDataCardTitle;
