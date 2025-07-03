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
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Table from '../../common/Table/Table';

export const ContractSchemaFormTab = () => {
  const { t } = useTranslation();
  const columns = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
      },
      {
        title: t('label.type'),
        dataIndex: 'type',
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: 'glossaryTerms',
      },
      {
        title: t('label.contraint-plural'),
        dataIndex: 'contraints',
      },
    ],
    [t]
  );

  return <Table columns={columns} dataSource={[]} />;
};
