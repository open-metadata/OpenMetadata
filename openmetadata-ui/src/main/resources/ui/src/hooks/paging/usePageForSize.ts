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
import { useCallback, useRef, useState } from 'react';
import { INITIAL_PAGING_VALUE } from '../../constants/constants';

export const usePageForSize = (
  pageSize: number,
  initialPage = INITIAL_PAGING_VALUE
): [number, (page: number) => void] => {
  const [pageAtSize, setPageAtSize] = useState({
    page: initialPage,
    size: pageSize,
  });

  const sizeRef = useRef(pageSize);
  sizeRef.current = pageSize;

  const setPage = useCallback(
    (page: number) => setPageAtSize({ page, size: sizeRef.current }),
    []
  );

  return [
    pageAtSize.size === pageSize ? pageAtSize.page : INITIAL_PAGING_VALUE,
    setPage,
  ];
};
