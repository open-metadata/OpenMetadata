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
import { Skeleton, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WILD_CARD_CHAR } from '../../../constants/char.constants';
import { ROUTES } from '../../../constants/constants';
import { SearchIndex } from '../../../enums/search.enum';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { searchQuery } from '../../../rest/searchAPI';
import { createQueryFilter } from '../../../utils/Query/QueryUtils';

const QueryCount = ({ tableId }: { tableId: string }) => {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const [queryCount, setQueryCount] = useState({
    isLoading: false,
    count: 0,
  });

  const fetchQueryCount = async () => {
    setQueryCount((pre) => ({ ...pre, isLoading: true }));
    try {
      const response = await searchQuery({
        query: WILD_CARD_CHAR,
        pageNumber: 0,
        pageSize: 0,
        queryFilter: createQueryFilter({ tableId }),
        searchIndex: SearchIndex.QUERY,
        includeDeleted: false,
        trackTotalHits: true,
        fetchSource: false,
      });
      setQueryCount({ isLoading: false, count: response.hits.total.value });
    } catch (error) {
      setQueryCount({ isLoading: false, count: 0 });
    }
  };
  useEffect(() => {
    const isTourPage = location.pathname.includes(ROUTES.TOUR);
    if (tableId && !isTourPage) {
      fetchQueryCount();
    }
  }, [tableId]);

  if (queryCount.isLoading) {
    return <Skeleton active paragraph={{ rows: 1, width: 50 }} title={false} />;
  }

  if (queryCount.count === 0) {
    return (
      <Typography.Text>
        {t('label.no-entity', { entity: t('label.query-plural') })}
      </Typography.Text>
    );
  } else {
    return (
      <Typography.Text>
        {`${queryCount.count} ${t(
          queryCount.count === 1 ? 'label.query' : 'label.query-plural'
        )}`}
      </Typography.Text>
    );
  }
};

export default QueryCount;
