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

import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { NavigateFunction } from 'react-router-dom';
import { ReactComponent as IconEdit } from '../assets/svg/edit-new.svg';
import { ReactComponent as ExportIcon } from '../assets/svg/ic-export.svg';
import { ReactComponent as ImportIcon } from '../assets/svg/ic-import.svg';
import { ManageButtonItemLabel } from '../components/common/ManageButtonContentItem/ManageButtonContentItem.component';
import { ExportData } from '../components/Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
import { ExportTypes } from '../constants/Export.constants';
import { EntityType } from '../enums/entity.enum';
import LimitWrapper from '../hoc/LimitWrapper';
import { exportTestCasesInCSV } from '../rest/testAPI';
import { getEntityBulkEditPath, getEntityImportPath } from './EntityUtils';
import { t } from './i18next/LocalUtil';

interface TestCasePermission {
  ViewAll: boolean;
  EditAll: boolean;
}

export const ExtraTestCaseDropdownOptions = (
  fqn: string,
  permission: TestCasePermission,
  deleted: boolean,
  navigate: NavigateFunction,
  showModal: (data: ExportData) => void,
  sourceEntityType?: EntityType.TABLE | EntityType.TEST_SUITE
): ItemType[] => {
  const { ViewAll, EditAll } = permission;

  return [
    ...(EditAll && !deleted
      ? [
          {
            label: (
              <LimitWrapper resource="testCase">
                <ManageButtonItemLabel
                  description={t('message.import-entity-help', {
                    entity: t('label.test-case-lowercase-plural'),
                  })}
                  icon={ImportIcon}
                  id="import-button"
                  name={t('label.import')}
                  onClick={() => {
                    const importPath = getEntityImportPath(
                      EntityType.TEST_CASE,
                      fqn
                    );
                    const pathWithSource = sourceEntityType
                      ? `${importPath}?sourceEntityType=${sourceEntityType}`
                      : importPath;
                    navigate(pathWithSource);
                  }}
                />
              </LimitWrapper>
            ),
            key: 'import-button',
          },
        ]
      : []),
    ...(ViewAll && !deleted
      ? [
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.export-entity-help', {
                  entity: t('label.test-case-lowercase-plural'),
                })}
                icon={ExportIcon}
                id="export-button"
                name={t('label.export')}
                onClick={() =>
                  showModal({
                    name: fqn,
                    onExport: exportTestCasesInCSV,
                    exportTypes: [ExportTypes.CSV],
                  })
                }
              />
            ),
            key: 'export-button',
          },
        ]
      : []),
    ...(EditAll && !deleted
      ? [
          {
            label: (
              <LimitWrapper resource="testCase">
                <ManageButtonItemLabel
                  description={t('message.bulk-edit-entity-help', {
                    entity: t('label.test-case-lowercase-plural'),
                  })}
                  icon={IconEdit}
                  id="bulk-edit-button"
                  name={t('label.bulk-edit')}
                  onClick={() => {
                    const bulkEditPath = getEntityBulkEditPath(
                      EntityType.TEST_CASE,
                      fqn
                    );
                    const pathWithSource = sourceEntityType
                      ? `${bulkEditPath}?sourceEntityType=${sourceEntityType}`
                      : bulkEditPath;
                    navigate(pathWithSource);
                  }}
                />
              </LimitWrapper>
            ),
            key: 'bulk-edit-button',
          },
        ]
      : []),
  ];
};
