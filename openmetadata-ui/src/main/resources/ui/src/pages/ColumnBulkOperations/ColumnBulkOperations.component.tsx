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
import HeaderBreadcrumb from '../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import {
  getGlossaryHomeCrumb,
  getHomeCrumb,
} from '../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.utils';
import HeaderShell from '../../components/common/HeaderShell/HeaderShell.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { useIsAiMode } from '../../hooks/useAppMode';
import ColumnGrid from './ColumnGrid/ColumnGrid.component';

const ColumnBulkOperations = () => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();

  const breadcrumbItems = [
    isAiMode ? getGlossaryHomeCrumb(t) : getHomeCrumb(t),
    { label: t('label.column-bulk-operations') },
  ];

  return (
    <PageLayoutV1
      pageContainerStyle={
        isAiMode ? { padding: 8, paddingBottom: 16 } : undefined
      }
      pageTitle={t('label.column-bulk-operations')}>
      <div className="tw:flex tw:flex-col tw:gap-4">
        {isAiMode ? (
          <HeaderShell
            breadcrumb={
              <HeaderBreadcrumb
                noMargin
                items={breadcrumbItems}
                showHome={false}
              />
            }
            className="tw:mb-0!"
            padding="comfortable"
            subtitle={t('message.column-bulk-operations-subtitle')}
            title={t('label.column-bulk-operations')}
            variant="gradient"
          />
        ) : (
          <HeaderBreadcrumb items={breadcrumbItems} showHome={false} />
        )}
        <ColumnGrid />
      </div>
    </PageLayoutV1>
  );
};

export default ColumnBulkOperations;
