/*
 *  Copyright 2024 Collate.
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
import { TagSource } from '../../../generated/entity/data/container';
import { TagLabel } from '../../../generated/type/tagLabel';
import { getEntityName } from '../../../utils/EntityUtils';
import { ModifiedGlossaryTerm } from '../../Glossary/GlossaryTermTab/GlossaryTermTab.interface';
import { TreeNode } from '../atoms/asyncTreeSelect/types';

export const convertToTreeNodes = (
  options: Array<{
    id: string;
    value: string;
    title: string;
    children?: any[];
    disabled?: boolean;
    selectable?: boolean;
    lazyLoad?: boolean;
    data?: any;
    isParentMutuallyExclusive?: boolean;
  }>
): TreeNode[] => {
  return options.map((option) => ({
    id: option.id,
    label: option.title,
    value: option.value,
    children: option.children ? convertToTreeNodes(option.children) : [],
    isLeaf: !option.children || option.children.length === 0,
    allowSelection: option.selectable !== false,
    lazyLoad: option.lazyLoad !== false,
    isParentMutuallyExclusive: option.isParentMutuallyExclusive,
    data: option.data
      ? ({
          tagFQN: option.data.fullyQualifiedName || '',
          name: getEntityName(option.data),
          displayName: option.data.displayName,
          source: TagSource.Glossary,
        } as TagLabel)
      : undefined,
  }));
};

export const convertGlossaryTermsToTreeOptionsWithNames = (
  options: ModifiedGlossaryTerm[] = [],
  level = 0,
  parentMutuallyExclusive = false
): Array<{
  id: string;
  value: string;
  title: string;
  children: any[];
  disabled: boolean;
  selectable: boolean;
  data: any;
  isParentMutuallyExclusive?: boolean;
}> => {
  return options.map((option) => {
    const hasChildren =
      'children' in option && option.children && option.children.length > 0;
    const isGlossaryTerm = level !== 0;

    return {
      id: option.name || option.fullyQualifiedName || option.id, // Use name first, fallback to FQN, then ID
      value: option.fullyQualifiedName || option.name || option.id,
      title: getEntityName(option),
      children: hasChildren
        ? convertGlossaryTermsToTreeOptionsWithNames(
            option.children as ModifiedGlossaryTerm[],
            level + 1,
            parentMutuallyExclusive || option.mutuallyExclusive === true
          )
        : [],
      disabled: false,
      selectable: isGlossaryTerm, // Only terms are selectable, not the top-level glossary
      lazyLoad: false, // Terms have pre-loaded children from API, no lazy loading needed
      data: option,
      isParentMutuallyExclusive: parentMutuallyExclusive && isGlossaryTerm,
    };
  });
};
