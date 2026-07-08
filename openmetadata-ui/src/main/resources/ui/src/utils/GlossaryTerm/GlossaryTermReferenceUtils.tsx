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

import { Space, Typography } from 'antd';
import { ReactComponent as IconTerm } from '../../assets/svg/book.svg';
import { DE_ACTIVE_COLOR } from '../../constants/constants';
import type { EntityReference } from '../../generated/entity/data/table';
import { TagSource, type TagLabel } from '../../generated/type/tagLabel';
import { getEntityName } from '../EntityNameUtils';
import { ENTITY_LINK_SEPARATOR } from '../EntityPureUtils';
import {
  convertEntityReferencesToTagLabels,
  convertTagLabelsToEntityReferences,
} from '../EntityReferenceUtils';

export const createGlossaryTermEntityLink = (
  fullyQualifiedName: string
): string => {
  return `<#E${ENTITY_LINK_SEPARATOR}glossaryTerm${ENTITY_LINK_SEPARATOR}${fullyQualifiedName}>`;
};

export const GlossaryTermListItemRenderer = (props: EntityReference) => {
  return (
    <Space>
      <IconTerm
        className="align-middle"
        color={DE_ACTIVE_COLOR}
        height={16}
        name="doc"
        width={16}
      />
      <Typography.Text>{getEntityName(props)}</Typography.Text>
    </Space>
  );
};

export const convertTermsToEntityReferences = (
  terms: TagLabel[]
): EntityReference[] => {
  return convertTagLabelsToEntityReferences(terms);
};

export const convertEntityReferencesToTerms = (
  refs: EntityReference[]
): TagLabel[] => {
  return convertEntityReferencesToTagLabels(refs, TagSource.Glossary);
};
