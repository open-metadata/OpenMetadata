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
import Icon from '@ant-design/icons';
import { Button } from 'antd';
import { ReactComponent as IconEdit } from '../../assets/svg/edit-new.svg';
import { ROUTES } from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import {
  exportDatabaseDetailsInCSV,
  exportDatabaseSchemaDetailsInCSV,
} from '../../rest/databaseAPI';
import { exportGlossaryInCSVFormat } from '../../rest/glossaryAPI';
import { exportDatabaseServiceDetailsInCSV } from '../../rest/serviceAPI';
import { exportTableDetailsInCSV } from '../../rest/tableAPI';
import { t } from '../i18next/LocalUtil';

export const isBulkEditRoute = (pathname: string) => {
  return pathname.includes(ROUTES.BULK_EDIT_ENTITY);
};

export const getBulkEditCSVExportEntityApi = (entityType: EntityType) => {
  switch (entityType) {
    case EntityType.DATABASE_SERVICE:
      return exportDatabaseServiceDetailsInCSV;

    case EntityType.DATABASE:
      return exportDatabaseDetailsInCSV;

    case EntityType.DATABASE_SCHEMA:
      return exportDatabaseSchemaDetailsInCSV;

    case EntityType.GLOSSARY_TERM:
      return exportGlossaryInCSVFormat;

    case EntityType.TABLE:
      return exportTableDetailsInCSV;

    default:
      return exportTableDetailsInCSV;
  }
};

export const getBulkEditButton = (
  hasPermission: boolean,
  onClickHandler: () => void
) => {
  return hasPermission ? (
    <Button
      className="text-primary p-0 remove-button-background-hover"
      data-testid="bulk-edit-table"
      icon={<Icon component={IconEdit} />}
      type="text"
      onClick={onClickHandler}>
      {t('label.edit')}
    </Button>
  ) : null;
};
