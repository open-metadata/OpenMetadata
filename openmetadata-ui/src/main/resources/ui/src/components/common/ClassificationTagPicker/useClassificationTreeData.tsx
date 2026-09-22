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
    TreeSelectNode
} from '@openmetadata/ui-core-components';
import { Tag as TagIcon } from '@openmetadata/ui-core-components/icons';
import axios, { AxiosError } from 'axios';
import { useCallback } from 'react';
import { TagLabel } from '../../../generated/type/tagLabel';
import tagClassBase from '../../../utils/TagClassBase';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
    buildTagLabelFromResult,
    getTagDisplayLabel,
    RawTagResult
} from '../../Tag/TagSelector/TagSelector.utils';

// Flat fetcher — classification tags have no hierarchy, every node is a leaf.
export const useClassificationTreeData =
  (): TreeSelectDataFetcher<TagLabel> => {
    return useCallback(async ({ searchTerm }) => {
      try {
        const response = await tagClassBase.getTags(searchTerm ?? '', 1);
        const results: RawTagResult[] = response?.data ?? [];

        const nodes: TreeSelectNode<TagLabel>[] = results.map((result) => ({
          id: result.value,
          label: getTagDisplayLabel(result),
          value: result.value,
          data: buildTagLabelFromResult(result),
          isLeaf: true,
          allowSelection: true,
          icon: <TagIcon size={16} />,
        }));

        return { nodes };
      } catch (error) {
        if (axios.isCancel(error)) {
          throw error;
        }
        showErrorToast(error as AxiosError);

        return { nodes: [] };
      }
    }, []);
  };
