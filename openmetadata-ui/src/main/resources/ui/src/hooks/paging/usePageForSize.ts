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
import { useCallback, useState } from 'react';
import { INITIAL_PAGING_VALUE } from '../../constants/constants';

export const usePageForSize = (
  pageSize: number
): [number, (page: number) => void] => {
  const [pageAtSize, setPageAtSize] = useState({
    page: INITIAL_PAGING_VALUE,
    size: pageSize,
  });

  const setPage = useCallback(
    (page: number) => setPageAtSize({ page, size: pageSize }),
    [pageSize]
  );

  return [
    pageAtSize.size === pageSize ? pageAtSize.page : INITIAL_PAGING_VALUE,
    setPage,
  ];
};
