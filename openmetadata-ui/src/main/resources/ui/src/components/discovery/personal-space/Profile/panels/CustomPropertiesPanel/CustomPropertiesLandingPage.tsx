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

import {
  Box,
  Card,
  EmptyPlaceholder,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { groupBy } from 'lodash';
import React, { KeyboardEvent, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ENTITY_PATH } from '../../../../../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../../../../../constants/GlobalSettings.constants';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import { Type } from '../../../../../../generated/entity/type';
import { useAuth } from '../../../../../../hooks/authHooks';
import { getTypeByFQN } from '../../../../../../rest/metadataTypeAPI';
import { getEntityIconWithBg } from '../../../../../../utils/Assets/AssetsUtils';
import globalSettingsClassBase from '../../../../../../utils/GlobalSettingsClassBase';
import { SettingMenuItem } from '../../../../../../utils/GlobalSettingsUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';

interface CustomPropertiesLandingPageProps {
  onSelectEntityType: (entityType: Type) => void;
}

const GROUP_DATABASE_STORAGE = 'DATABASE & STORAGE';
const GROUP_DASHBOARDS_REPORTING = 'DASHBOARDS & REPORTING';
const GROUP_PIPELINES_ML = 'PIPELINES & ML';
const GROUP_API = 'API';
const GROUP_GOVERNANCE = 'GOVERNANCE';

const ENTITY_GROUP_MAP: Record<string, string> = {
  container: GROUP_DATABASE_STORAGE,
  database: GROUP_DATABASE_STORAGE,
  databaseSchema: GROUP_DATABASE_STORAGE,
  directory: GROUP_DATABASE_STORAGE,
  file: GROUP_DATABASE_STORAGE,
  storedProcedure: GROUP_DATABASE_STORAGE,
  table: GROUP_DATABASE_STORAGE,
  tableColumn: GROUP_DATABASE_STORAGE,
  chart: GROUP_DASHBOARDS_REPORTING,
  dashboard: GROUP_DASHBOARDS_REPORTING,
  dashboardDataModel: GROUP_DASHBOARDS_REPORTING,
  searchIndex: GROUP_PIPELINES_ML,
  spreadsheet: GROUP_DASHBOARDS_REPORTING,
  worksheet: GROUP_DASHBOARDS_REPORTING,
  mlmodel: GROUP_PIPELINES_ML,
  pipeline: GROUP_PIPELINES_ML,
  topic: GROUP_PIPELINES_ML,
  apiCollection: GROUP_API,
  apiEndpoint: GROUP_API,
  dataProduct: GROUP_GOVERNANCE,
  domain: GROUP_GOVERNANCE,
  glossaryTerm: GROUP_GOVERNANCE,
  metric: GROUP_GOVERNANCE,
};

const GROUP_ORDER = [
  GROUP_DATABASE_STORAGE,
  GROUP_DASHBOARDS_REPORTING,
  GROUP_PIPELINES_ML,
  GROUP_API,
  GROUP_GOVERNANCE,
];

const CustomPropertiesLandingPage: React.FC<
  CustomPropertiesLandingPageProps
> = ({ onSelectEntityType }) => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const { isAdminUser } = useAuth();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const items = useMemo<SettingMenuItem[]>(() => {
    const menu = globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
      permissions,
      isAdminUser
    );
    const customPropsCategory = menu.find(
      (m: SettingMenuItem) =>
        m.key === GlobalSettingsMenuCategory.CUSTOM_PROPERTIES
    );

    return (customPropsCategory?.items ?? []).filter(
      (item: SettingMenuItem) => item.isProtected
    );
  }, [permissions, isAdminUser]);

  const grouped = useMemo(() => {
    const byGroup = groupBy(items, (item: SettingMenuItem) => {
      const optionKey = item.key.split('.')[1] as keyof typeof ENTITY_PATH;
      const entityTypeName = ENTITY_PATH[optionKey] ?? optionKey;

      return ENTITY_GROUP_MAP[entityTypeName] ?? 'Other';
    });

    return GROUP_ORDER.filter((g) => byGroup[g]?.length).map((groupName) => ({
      groupName,
      items: byGroup[groupName],
    }));
  }, [items]);

  const handleCardClick = useCallback(
    async (entityTypeName: string, itemKey: string) => {
      setLoadingKey(itemKey);
      try {
        const type = await getTypeByFQN(entityTypeName);
        onSelectEntityType(type);
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setLoadingKey(null);
      }
    },
    [onSelectEntityType]
  );

  if (items.length === 0) {
    return (
      <Box align='center' className='tw:h-full tw:w-full' justify='center'>
      <EmptyPlaceholder
        description={t('message.no-custom-properties-defined')}
        title={t('label.custom-property-plural')}
        variant="blank"
      />
      </Box>
    );
  }

  return (
    <Box
      className="tw:flex tw:flex-col tw:gap-8"
      data-testid="custom-properties-landing"
      direction="col">
      {grouped.map(({ groupName, items: groupItems }) => (
        <Box
          className="tw:flex tw:flex-col tw:gap-3"
          direction="col"
          key={groupName}>
          <Typography
            className="tw:text-text-secondary tw:uppercase"
            size="text-xs"
            weight="semibold">
            {groupName}
          </Typography>
          <div className="tw:grid tw:grid-cols-3 tw:gap-4">
            {groupItems.map((item: SettingMenuItem) => {
              const optionKey = item.key.split(
                '.'
              )[1] as keyof typeof ENTITY_PATH;
              const entityTypeName = ENTITY_PATH[optionKey] ?? optionKey;
              const isCurrentLoading = loadingKey === item.key;

              const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (!isCurrentLoading) {
                    handleCardClick(entityTypeName, item.key);
                  }
                }
              };

              return (
                <Card
                  isClickable
                  aria-busy={isCurrentLoading}
                  data-testid={`entity-type-card-${entityTypeName}`}
                  key={item.key}
                  role="button"
                  size="md"
                  tabIndex={0}
                  onClick={() =>
                    !isCurrentLoading &&
                    handleCardClick(entityTypeName, item.key)
                  }
                  onKeyDown={handleKeyDown}>
                  <Card.Content>
                    <Box align="start" direction="row" gap={3}>
                      {getEntityIconWithBg(
                        entityTypeName,
                        { className: 'tw:h-10 tw:w-10 tw:rounded-lg' },
                        { size: 25 }
                      )}
                      <Box className="tw:min-w-0" direction="col" gap={1}>
                        <Typography
                          className="tw:text-primary-900"
                          size="text-sm"
                          weight="semibold">
                          {item.label}
                        </Typography>
                        {item.description && (
                          <Typography
                            className="tw:line-clamp-2 tw:text-text-secondary"
                            size="text-xs"
                            weight="regular">
                            {item.description}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Card.Content>
                </Card>
              );
            })}
          </div>
        </Box>
      ))}
    </Box>
  );
};

export default CustomPropertiesLandingPage;
