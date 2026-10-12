/*
 *  Copyright 2026 Collate.
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
import { AxiosError } from 'axios';
import { PagingWithoutTotal } from 'Models';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pagingObject } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { File } from '../../../generated/entity/data/file';
import { Spreadsheet } from '../../../generated/entity/data/spreadsheet';
import { Include } from '../../../generated/type/include';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useTableFilters } from '../../../hooks/useTableFilters';
import { getDriveAssets } from '../../../rest/driveAPI';
import { commonTableFields } from '../../../utils/DatasetDetailsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';

type DriveAssetType = EntityType.FILE | EntityType.SPREADSHEET;

/**
 * The top-level files or spreadsheets of a drive service, for FilesTable / SpreadsheetsTable,
 * which run their own search but leave the plain list and its paging to the caller.
 */
export const useServiceDriveAssets = <T extends File | Spreadsheet>(
  entityType: DriveAssetType,
  serviceFqn: string,
  showDeleted: boolean
) => {
  const pagingInfo = usePaging();
  const { paging, pageSize, handlePagingChange, handlePageChange } = pagingInfo;
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Each table keeps its search text in a URL param named after its entity type
  // (`?file=` / `?spreadsheet=`), and runs that search itself.
  const searchFilter = useMemo(
    () => ({ [entityType]: undefined as string | undefined }),
    [entityType]
  );
  const { filters } = useTableFilters(searchFilter);
  const searchValue = filters[entityType];

  // Only the latest request may write the rows: a slower earlier one (the previous page, the
  // other side of the Deleted switch, a list a search has since replaced) would overwrite them.
  const latestRequestRef = useRef(0);

  const fetchItems = useCallback(
    async (cursor?: PagingWithoutTotal) => {
      const requestId = ++latestRequestRef.current;
      const isLatest = () => requestId === latestRequestRef.current;
      try {
        setIsLoading(true);
        const response = await getDriveAssets<T>(entityType, {
          service: serviceFqn,
          fields: commonTableFields,
          root: true,
          paging: { ...cursor, limit: pageSize },
          include: showDeleted ? Include.Deleted : Include.NonDeleted,
        });
        if (isLatest()) {
          setItems(response.data);
          handlePagingChange(response.paging);
        }
      } catch (error) {
        if (isLatest()) {
          showErrorToast(error as AxiosError);
          setItems([]);
          handlePagingChange(pagingObject);
        }
      } finally {
        if (isLatest()) {
          setIsLoading(false);
        }
      }
    },
    [entityType, serviceFqn, pageSize, showDeleted, handlePagingChange]
  );

  const { cursorType, cursorValue } = pagingInfo.pagingCursor;

  useEffect(() => {
    if (searchValue) {
      // The table's search owns the rows now; a list request still in flight must not land on it.
      latestRequestRef.current += 1;
    } else {
      fetchItems(cursorType ? { [cursorType]: cursorValue } : undefined);
    }
  }, [searchValue, cursorType, cursorValue, fetchItems]);

  const onPageChange = useCallback(
    ({ cursorType: nextCursorType, currentPage }: PagingHandlerParams) => {
      if (searchValue) {
        handlePageChange(currentPage);
      } else if (nextCursorType) {
        handlePageChange(
          currentPage,
          { cursorType: nextCursorType, cursorValue: paging[nextCursorType] },
          pageSize
        );
      }
    },
    [searchValue, handlePageChange, paging, pageSize]
  );

  return { items, setItems, isLoading, setIsLoading, pagingInfo, onPageChange };
};
