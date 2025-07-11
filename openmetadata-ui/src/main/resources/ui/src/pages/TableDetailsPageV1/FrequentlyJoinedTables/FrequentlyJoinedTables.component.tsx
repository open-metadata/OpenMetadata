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
import { Button, Typography } from 'antd';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ExpandableCard from '../../../components/common/ExpandableCard/ExpandableCard';
import { useGenericContext } from '../../../components/Customization/GenericProvider/GenericProvider';
import { LIST_SIZE } from '../../../constants/constants';
import { DetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { EntityType } from '../../../enums/entity.enum';
import { JoinedWith, Table } from '../../../generated/entity/data/table';
import { getCountBadge } from '../../../utils/CommonUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { getJoinsFromTableJoins } from '../../../utils/TableUtils';
import './frequently-joined-tables.style.less';

export type Joined = JoinedWith & {
  name: string;
};

export const FrequentlyJoinedTables = ({
  renderAsExpandableCard = true,
}: {
  renderAsExpandableCard?: boolean;
}) => {
  const { t } = useTranslation();
  const { data, filterWidgets } = useGenericContext<Table>();
  const [visibleCount, setVisibleCount] = useState(LIST_SIZE);

  const joinedTables = useMemo(
    () => getJoinsFromTableJoins(data?.joins),
    [data?.joins]
  );

  useEffect(() => {
    if (isEmpty(joinedTables)) {
      filterWidgets?.([DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES]);
    }
  }, [joinedTables]);

  const hasMoreElement = useMemo(
    () => LIST_SIZE < joinedTables.length,
    [joinedTables]
  );

  const handleShowMore = useCallback(() => {
    setVisibleCount(
      visibleCount === joinedTables.length ? LIST_SIZE : joinedTables.length
    );
  }, [joinedTables, visibleCount]);

  const content = useMemo(() => {
    return joinedTables.slice(0, visibleCount).map((table) => (
      <div
        className="frequently-joint-data"
        data-testid="related-tables-data"
        key={table.name}>
        <Link
          to={getEntityDetailsPath(EntityType.TABLE, table.fullyQualifiedName)}>
          <Typography.Text
            className="frequently-joint-name"
            ellipsis={{ tooltip: true }}>
            {table.name}
          </Typography.Text>
        </Link>
        {getCountBadge(table.joinCount, '', false)}
      </div>
    ));
  }, [joinedTables, visibleCount]);

  if (isEmpty(joinedTables)) {
    return null;
  }

  return renderAsExpandableCard ? (
    <ExpandableCard
      cardProps={{
        title: t('label.frequently-joined-table-plural'),
        className: 'frequently-joint-data-container',
      }}
      dataTestId="frequently-joint-data-container"
      isExpandDisabled={isEmpty(joinedTables)}>
      {content}

      {hasMoreElement ? (
        <Button
          className="show-more-tags-button"
          data-testid="read-button"
          size="small"
          type="link"
          onClick={handleShowMore}>
          {visibleCount === joinedTables.length
            ? t('label.less')
            : t('label.plus-count-more', {
                count: joinedTables.length - visibleCount,
              })}
        </Button>
      ) : null}
    </ExpandableCard>
  ) : (
    <>{content}</>
  );
};
