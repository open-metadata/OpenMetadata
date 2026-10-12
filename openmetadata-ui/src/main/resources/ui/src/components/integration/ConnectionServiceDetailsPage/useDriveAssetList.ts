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
import { useCallback, useEffect, useState } from 'react';
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

interface UseDriveAssetListParams {
  entityType: EntityType.FILE | EntityType.SPREADSHEET;
  // The URL param FilesTable / SpreadsheetsTable keep their search in.
  searchParam: 'file' | 'spreadsheet';
  serviceFqn: string;
  showDeleted: boolean;
}

/**
 * The top-level files or spreadsheets of a drive service, paged by the URL cursor. While the
 * table's own search is active it owns the rows, so the list stands down.
 */
export const useDriveAssetList = <T extends File | Spreadsheet>({
  entityType,
  searchParam,
  serviceFqn,
  showDeleted,
}: UseDriveAssetListParams) => {
  const pagingInfo = usePaging();
  const {
    paging,
    pageSize,
    pagingCursor,
    handlePageChange,
    handlePagingChange,
  } = pagingInfo;
  const { cursorType, cursorValue } = pagingCursor;
  const { filters } = useTableFilters({
    [searchParam]: undefined as string | undefined,
  });
  const searchValue = filters[searchParam];

  const [assets, setAssets] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (searchValue) {
      return;
    }
    // A slower earlier request (previous page, other side of the Deleted switch) must not
    // overwrite the rows of the one that replaced it.
    let isStale = false;

    const fetchAssets = async () => {
      setIsLoading(true);
      try {
        const response = await getDriveAssets<T>(entityType, {
          service: serviceFqn,
          fields: commonTableFields,
          root: true,
          include: showDeleted ? Include.Deleted : Include.NonDeleted,
          paging: {
            limit: pageSize,
            ...(cursorType && cursorValue ? { [cursorType]: cursorValue } : {}),
          },
        });
        if (!isStale) {
          setAssets(response.data);
          handlePagingChange(response.paging);
        }
      } catch (error) {
        if (!isStale) {
          showErrorToast(error as AxiosError);
          setAssets([]);
          handlePagingChange(pagingObject);
        }
      } finally {
        if (!isStale) {
          setIsLoading(false);
        }
      }
    };

    fetchAssets();

    return () => {
      isStale = true;
    };
  }, [
    entityType,
    serviceFqn,
    showDeleted,
    searchValue,
    pageSize,
    cursorType,
    cursorValue,
    handlePagingChange,
  ]);

  const handleAssetPageChange = useCallback(
    ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (searchValue) {
        handlePageChange(currentPage);
      } else if (cursorType) {
        handlePageChange(
          currentPage,
          { cursorType, cursorValue: paging[cursorType] },
          pageSize
        );
      }
    },
    [searchValue, handlePageChange, paging, pageSize]
  );

  return {
    assets,
    setAssets,
    isLoading,
    setIsLoading,
    pagingInfo,
    handleAssetPageChange,
  };
};
