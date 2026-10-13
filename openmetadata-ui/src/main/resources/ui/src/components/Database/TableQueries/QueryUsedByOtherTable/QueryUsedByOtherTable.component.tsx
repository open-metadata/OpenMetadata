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
  Box,
  Button,
  Popover,
  PopoverTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { isUndefined, slice } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { QUERY_USED_BY_TABLE_VIEW_CAP } from '../../../../constants/Query.constant';
import { EntityType } from '../../../../enums/entity.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import DataAssetAsyncSelectList from '../../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList';
import { DataAssetOption } from '../../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import {
  QueryUsedByOtherTableProps,
  QueryUsedByTable,
} from '../TableQueries.interface';

const QueryUsedByOtherTable = ({
  query,
  isEditMode,
  onChange,
}: QueryUsedByOtherTableProps) => {
  const { t } = useTranslation();
  const { topThreeTable, remainingTable } = useMemo(() => {
    const { queryUsedIn } = query;

    const data: QueryUsedByTable = {
      topThreeTable: [],
      remainingTable: [],
    };

    if (!isUndefined(queryUsedIn)) {
      // Slice 3 table to display upfront in UI
      data.topThreeTable = slice(queryUsedIn, 0, QUERY_USED_BY_TABLE_VIEW_CAP);
      if (queryUsedIn.length > QUERY_USED_BY_TABLE_VIEW_CAP) {
        // Slice remaining tables to show in "view more"
        data.remainingTable = slice(queryUsedIn, QUERY_USED_BY_TABLE_VIEW_CAP);
      }
    }

    return data;
  }, [query]);

  const tableNames = useMemo(
    () => (
      <Typography>
        {topThreeTable.length
          ? topThreeTable.map((table, index) => (
              <Typography className="m-r-xss" key={table.name}>
                <Link
                  to={getEntityDetailsPath(
                    EntityType.TABLE,
                    table.fullyQualifiedName || ''
                  )}>
                  {getEntityName(table)}
                </Link>
                {topThreeTable.length - 1 !== index && ','}
              </Typography>
            ))
          : '--'}
        {remainingTable.length ? (
          <>
            <Typography className="m-r-xss">
              {t('label.and-lowercase')}
            </Typography>
            <PopoverTrigger>
              <Button
                noTextPadding
                className="show-more"
                color="link-color"
                data-testid="show-more"
                size="sm">
                {`${remainingTable.length} ${t('label.more-lowercase')}`}
              </Button>
              <Popover
                arrow
                containerClassName="tw:px-4 tw:py-3"
                placement="bottom">
                <Box
                  inline
                  align="stretch"
                  className="layout-space"
                  direction="col"
                  gap={2}
                  itemClassName="layout-space-item">
                  {remainingTable.map((table) => (
                    <Link
                      key={table.id}
                      to={getEntityDetailsPath(
                        EntityType.TABLE,
                        table.fullyQualifiedName || ''
                      )}>
                      {getEntityName(table)}
                    </Link>
                  ))}
                </Box>
              </Popover>
            </PopoverTrigger>
          </>
        ) : null}
      </Typography>
    ),
    [topThreeTable, remainingTable]
  );

  const selectList = useMemo(() => {
    const initialOptions: DataAssetOption[] = (query.queryUsedIn ?? []).map(
      (table) => ({
        value: table.fullyQualifiedName,
        displayName: getEntityName(table),
        reference: table,
      })
    );

    return (
      <div className="w-min-30 w-full" data-testid="edit-query-used-in">
        <DataAssetAsyncSelectList
          multiple
          // eslint-disable-next-line jsx-a11y/no-autofocus -- turns autofocus off so the SQL editor keeps focus
          autoFocus={false}
          initialOptions={initialOptions}
          placeholder={t('label.please-select-entity', {
            entity: t('label.query-used-in'),
          })}
          searchIndex={SearchIndex.TABLE}
          value={initialOptions.map((option) => option.value ?? '')}
          onChange={(options) =>
            onChange(
              (Array.isArray(options) ? options : []).map(
                (option) => option.reference
              )
            )
          }
        />
      </div>
    );
  }, [query.queryUsedIn, onChange, t]);

  return (
    <Box className="layout-row" data-testid="para-container" wrap="wrap">
      <Box className="layout-column tw:block" style={{ flex: '0 0 200px' }}>
        <Typography>{`${t('message.query-used-by-other-tables')}:`}</Typography>
      </Box>
      <Box className="layout-column tw:block">
        {isEditMode ? selectList : tableNames}
      </Box>
    </Box>
  );
};

export default QueryUsedByOtherTable;
