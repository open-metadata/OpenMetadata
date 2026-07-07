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

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface ArticleDraft {
  articleId: string;
  fqn: string;
  description?: string;
  displayName?: string;
  version?: number;
}

interface ArticleDraftStore {
  drafts: Record<string, ArticleDraft>;
  setDraft: (
    articleId: string,
    patch: Partial<Omit<ArticleDraft, 'articleId'>>
  ) => void;
  removeDraft: (articleId: string) => void;
  getDraft: (articleId: string) => ArticleDraft | undefined;
}

export const useArticleDraftStore = create<ArticleDraftStore>()(
  persist(
    (set, get) => ({
      drafts: {},

      setDraft: (
        articleId: string,
        patch: Partial<Omit<ArticleDraft, 'articleId'>>
      ) => {
        set((state) => ({
          drafts: {
            ...state.drafts,
            [articleId]: {
              ...state.drafts[articleId],
              articleId,
              ...patch,
            },
          },
        }));
      },

      removeDraft: (articleId: string) => {
        set((state) => {
          const { [articleId]: _, ...rest } = state.drafts;

          return { drafts: rest };
        });
      },

      getDraft: (articleId: string) => {
        return get().drafts[articleId];
      },
    }),
    {
      name: 'om-article-drafts',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
