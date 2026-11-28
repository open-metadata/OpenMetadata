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
import {
  TreeSelectDataFetcher,
  TreeSelectNode,
} from '@openmetadata/ui-core-components';
import { Tag01 as TagIcon } from '@openmetadata/ui-core-components/icons';
import axios, { AxiosError } from 'axios';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE } from '../../../../constants/constants';
import { TagLabel } from '../../../../generated/type/tagLabel';
import Fqn from '../../../../utils/Fqn';
import tagClassBase from '../../../../utils/TagClassBase';
import { showErrorToast } from '../../../../utils/ToastUtils';
import {
  buildTagLabelFromResult,
  getTagDisplayLabel,
  RawTagResult,
} from '../../../Tag/TagSelector/TagSelector.utils';

export const useClassificationTreeData =
  (): TreeSelectDataFetcher<TagLabel> => {
    const { t } = useTranslation();

    return useCallback(
      async ({ searchTerm, after }) => {
        // The search API pages by number, so the cursor is the next page number.
        const page = Number(after ?? 1);
        try {
          const response = await tagClassBase.getTags(searchTerm ?? '', page);
          const results: RawTagResult[] = response?.data ?? [];
          const total = response?.paging?.total ?? 0;
          const hasMore = (page - 1) * PAGE_SIZE + results.length < total;

          const nodes: TreeSelectNode<TagLabel>[] = results.map((result) => {
            const name = getTagDisplayLabel(result);
            const segments = result.value ? Fqn.split(result.value) : [];
            const label =
              segments.length > 2
                ? t('label.tag-name-with-parent', {
                    name,
                    parentFqn: Fqn.build(...segments.slice(0, -1)),
                  })
                : name;

            return {
              id: result.value,
              label,
              value: result.value,
              data: buildTagLabelFromResult(result),
              isLeaf: true,
              allowSelection: true,
              icon: <TagIcon size={16} />,
            };
          });

          return {
            nodes,
            hasMore,
            total,
            nextCursor: hasMore ? String(page + 1) : undefined,
          };
        } catch (error) {
          if (axios.isCancel(error)) {
            throw error;
          }
          showErrorToast(error as AxiosError);

          return { nodes: [] };
        }
      },
      [t]
    );
  };
