/*
 *  Copyright 2025 Collate.
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
import { TreeSelectNode } from '@openmetadata/ui-core-components';
import { TagSource } from '../../../generated/entity/data/container';
import { TagLabel } from '../../../generated/type/tagLabel';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { ModifiedGlossaryTerm } from '../../Glossary/GlossaryTermTab/GlossaryTermTab.interface';

export interface TreeOptionNode {
  id: string;
  value: string;
  title: string;
  children?: TreeOptionNode[];
  disabled?: boolean;
  selectable?: boolean;
  lazyLoad?: boolean;
  data?: ModifiedGlossaryTerm;
  isParentMutuallyExclusive?: boolean;
}

export const convertToTreeNodes = (
  options: TreeOptionNode[]
): TreeSelectNode<TagLabel>[] => {
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
): TreeOptionNode[] => {
  return options.map((option) => {
    const hasChildren =
      'children' in option && option.children && option.children.length > 0;
    const isGlossaryTerm = level !== 0;

    return {
      // FQN first so ids match the tag.tagFQN-keyed selection seeded in GlossaryTermTreeSelect
      id: option.fullyQualifiedName || option.name || option.id,
      value: option.fullyQualifiedName || option.name || option.id,
      title: getEntityName(option),
      children: hasChildren
        ? convertGlossaryTermsToTreeOptionsWithNames(
            option.children as ModifiedGlossaryTerm[],
            level + 1,
            option.mutuallyExclusive === true
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
