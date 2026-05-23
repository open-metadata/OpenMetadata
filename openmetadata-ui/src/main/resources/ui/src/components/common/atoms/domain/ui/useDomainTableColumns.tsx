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

import { ReactNode, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Domain } from '../../../../../generated/entity/domains/domain';
import { ColumnDef } from '../../../EntityListingTable/EntityListingTable.interface';
import {
  renderDomainClassificationTagsCell,
  renderDomainGlossaryTagsCell,
  renderDomainNameCell,
  renderDomainOwnersCell,
  renderDomainTypeCell,
} from './domainFieldRenderers';

interface UseDomainTableColumnsOptions {
  nameLabelKey?: string;
  tagSize?: 'sm' | 'lg';
}

export const useDomainTableColumns = ({
  nameLabelKey = 'label.domain',
  tagSize = 'sm',
}: UseDomainTableColumnsOptions = {}) => {
  const { t } = useTranslation();

  const columns: ColumnDef[] = useMemo(
    () => [
      { id: 'name', label: t(nameLabelKey) },
      { id: 'owners', label: t('label.owner-plural') },
      { id: 'glossaryTerms', label: t('label.glossary-term-plural') },
      { id: 'domainType', label: t('label.domain-type') },
      { id: 'tags', label: t('label.tag-plural') },
    ],
    [t, nameLabelKey]
  );

  const renderCell = useCallback(
    (entity: Domain, columnId: string): ReactNode => {
      switch (columnId) {
        case 'name':
          return renderDomainNameCell(entity);
        case 'domainType':
          return renderDomainTypeCell(entity);
        case 'owners':
          return renderDomainOwnersCell(entity);
        case 'glossaryTerms':
          return renderDomainGlossaryTagsCell(entity, { size: tagSize });
        case 'tags':
          return renderDomainClassificationTagsCell(entity, { size: tagSize });
        default:
          return null;
      }
    },
    [tagSize]
  );

  return { columns, renderCell };
};
