/*
 *  Copyright 2022 Collate.
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

import { AxiosError } from 'axios';
import { GlossaryCSVRecord } from 'components/Glossary/ImportGlossary/ImportGlossary.interface';
import { isEmpty } from 'lodash';
import { searchData } from 'rest/miscAPI';
import { WILD_CARD_CHAR } from '../constants/char.constants';
import { SearchIndex } from '../enums/search.enum';
import { Glossary } from '../generated/entity/data/glossary';
import { GlossaryTerm } from '../generated/entity/data/glossaryTerm';
import { EntityReference } from '../generated/type/entityReference';
import { SearchResponse } from '../interface/search.interface';
import { formatSearchGlossaryTermResponse } from './APIUtils';

export interface GlossaryTermTreeNode {
  children?: GlossaryTermTreeNode[];
  fullyQualifiedName: string;
  name: string;
}

/**
 * To get all glossary terms
 * @returns promise of list of formatted glossary terms
 */
export const fetchGlossaryTerms = (): Promise<GlossaryTerm[]> => {
  return new Promise<GlossaryTerm[]>((resolve, reject) => {
    searchData(WILD_CARD_CHAR, 1, 1000, '', '', '', SearchIndex.GLOSSARY)
      .then((res) => {
        const data = formatSearchGlossaryTermResponse(
          (res?.data as SearchResponse<SearchIndex.GLOSSARY>)?.hits?.hits || []
        );
        resolve(data);
      })
      .catch((error: AxiosError) => reject(error.response));
  });
};

/**
 * To get list of fqns from list of glossary terms
 * @param terms formatted glossary terms
 * @returns list of term fqns
 */
export const getGlossaryTermlist = (
  terms: Array<GlossaryTerm> = []
): Array<string> => {
  return terms.map((term: GlossaryTerm) => term.fullyQualifiedName || '');
};

export const getEntityReferenceFromGlossary = (
  glossary: Glossary
): EntityReference => {
  return {
    deleted: glossary.deleted,
    href: glossary.href,
    fullyQualifiedName: glossary.fullyQualifiedName ?? '',
    id: glossary.id,
    type: 'glossaryTerm',
    description: glossary.description,
    displayName: glossary.displayName,
    name: glossary.name,
  };
};

export const parseCSV = (csvData: string) => {
  const recordList: GlossaryCSVRecord[] = [];

  const lines = csvData.trim().split('\n').filter(Boolean);

  if (!isEmpty(lines)) {
    const headers = lines[0].split(',').map((header) => header.trim());

    lines.slice(1).forEach((line) => {
      const record: GlossaryCSVRecord = {} as GlossaryCSVRecord;
      const lineData = line.split(',');

      headers.forEach((header, index) => {
        record[header as keyof GlossaryCSVRecord] = lineData[index];
      });

      recordList.push(record);
    });
  }

  return recordList;
};
