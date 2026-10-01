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

import { useQuery } from '@tanstack/react-query';
import { SearchIndex } from '../enums/search.enum';
import { searchQuery } from '../rest/searchAPI';

export const DATA_PRODUCTS_QUERY_KEY = [
  'landingPage',
  'widgets',
  'dataProducts',
];
const TTL_MS = 5 * 60 * 1000;
const PAGE_SIZE = 10;

export interface DataProductSummary {
  id: string;
  name: string;
  fullyQualifiedName: string;
  domainName?: string;
  ownerName?: string;
  assetCount: number;
}

export interface DataProductsOverview {
  products: DataProductSummary[];
  totalCount: number;
  unownedCount: number;
  emptyCount: number;
  domainCount: number;
  isLoading: boolean;
  isError: boolean;
}

interface SearchHit {
  _source: {
    id: string;
    name: string;
    displayName?: string;
    fullyQualifiedName: string;
    assets?: unknown[];
    domains?: Array<{ displayName?: string; name?: string }>;
    owners?: Array<{ displayName?: string; name?: string }>;
  };
}

const firstName = (
  refs?: Array<{ displayName?: string; name?: string }>
): string | undefined =>
  refs?.length ? refs[0].displayName || refs[0].name : undefined;

/** Data products with their domain, owner and asset count. */
export const useDataProducts = (): DataProductsOverview => {
  const { data, isPending, isError } = useQuery({
    queryFn: () =>
      searchQuery({
        pageNumber: 1,
        pageSize: PAGE_SIZE,
        query: '',
        searchIndex: SearchIndex.DATA_PRODUCT,
      }),
    queryKey: DATA_PRODUCTS_QUERY_KEY,
    staleTime: TTL_MS,
  });

  const hits = (data?.hits?.hits ?? []) as unknown as SearchHit[];

  const products: DataProductSummary[] = hits.map(({ _source: source }) => ({
    // `assets` is the product's own asset list on the search document, so the
    // count needs no second lookup per row.
    assetCount: source.assets?.length ?? 0,
    domainName: firstName(source.domains),
    fullyQualifiedName: source.fullyQualifiedName,
    id: source.id,
    name: source.displayName || source.name,
    ownerName: firstName(source.owners),
  }));

  const domains = new Set(
    products.map((product) => product.domainName).filter(Boolean)
  );

  return {
    // Counted over the page in hand — the search response carries no aggregate
    // for "unowned" or "empty", so these describe what is listed.
    domainCount: domains.size,
    emptyCount: products.filter((product) => product.assetCount === 0).length,
    isError,
    isLoading: isPending,
    products,
    totalCount: data?.hits?.total?.value ?? 0,
    unownedCount: products.filter((product) => !product.ownerName).length,
  };
};
