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
import { SearchIndex } from '../enums/search.enum';
import { Style } from '../generated/type/tagLabel';
import { searchQuery } from './searchAPI';

type StyleSubscriber = {
  resolve: (style: Style | null) => void;
  reject: (reason?: unknown) => void;
};

let pendingStyles = new Map<string, StyleSubscriber[]>();
let isFlushScheduled = false;

// Bounds the `terms` filter and the page size of one search request.
const MAX_BATCH_SIZE = 100;

/** The part of a domain's style a chip draws; the cover image stays on the domain. */
export const toChipStyle = (style?: Style): Style | null =>
  style?.color || style?.iconURL
    ? { color: style.color, iconURL: style.iconURL }
    : null;

const flushChunk = async (
  chunk: Array<[string, StyleSubscriber[]]>
): Promise<void> => {
  const ids = chunk.map(([id]) => id);

  try {
    const response = await searchQuery({
      searchIndex: SearchIndex.DOMAIN,
      pageSize: ids.length,
      queryFilter: { query: { terms: { 'id.keyword': ids } } },
      fetchSource: true,
      includeFields: ['id', 'style'],
      // A chip can show a domain outside the active domain scope; the scope
      // filter would drop it and the chip would lose its style.
      skipDomainFilter: true,
    });
    const styleById = new Map(
      response.hits.hits.map(({ _source }) => [_source.id, _source.style])
    );

    chunk.forEach(([id, subscribers]) => {
      const style = toChipStyle(styleById.get(id));
      subscribers.forEach(({ resolve }) => resolve(style));
    });
  } catch (error) {
    chunk.forEach(([, subscribers]) =>
      subscribers.forEach(({ reject }) => reject(error))
    );
  }
};

const flushStyles = (): void => {
  const batch = [...pendingStyles.entries()];

  pendingStyles = new Map();
  isFlushScheduled = false;

  for (let start = 0; start < batch.length; start += MAX_BATCH_SIZE) {
    void flushChunk(batch.slice(start, start + MAX_BATCH_SIZE));
  }
};

/**
 * Resolves a domain's chip colour and icon. Every request fired within the same
 * microtask goes out as one domain search, so a page of chips (Explore cards,
 * list rows) costs one round trip however many chips it renders. Resolves
 * `null` for a domain without a style, or one the user cannot see.
 * ADR:2026-11-02-domain-chips-resolve-their-style-by-domain-id
 */
export const batchedDomainStyle = (id: string): Promise<Style | null> =>
  new Promise<Style | null>((resolve, reject) => {
    pendingStyles.set(id, [
      ...(pendingStyles.get(id) ?? []),
      { resolve, reject },
    ]);

    if (!isFlushScheduled) {
      isFlushScheduled = true;
      void Promise.resolve().then(flushStyles);
    }
  });
