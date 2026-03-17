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
import { useTranslation } from 'react-i18next';
import { useBreadcrumbs } from '../../components/common/atoms/navigation/useBreadcrumbs';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import ColumnGrid from './ColumnGrid/ColumnGrid.component';

const ColumnBulkOperations = () => {
  const { t } = useTranslation();

  const { breadcrumbs } = useBreadcrumbs({
    items: [
      {
        name: t('label.column-bulk-operations'),
        url: '/column-bulk-operations',
      },
    ],
  });

  return (
    <PageLayoutV1 pageTitle={t('label.column-bulk-operations')}>
      <div>
        {breadcrumbs}
        <ColumnGrid />
      </div>
    </PageLayoutV1>
  );
};

export default ColumnBulkOperations;
