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
  Button,
  EmptyPlaceholder,
  Grid,
  PaginationCardWithControls,
  Skeleton,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { GridView } from '@openmetadata/ui-core-components/icons';
import { FC, ReactNode, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../../../../../constants/constants';
import { Include } from '../../../../../../generated/type/include';
import LimitWrapper from '../../../../../../hoc/LimitWrapper';
import { useAuth } from '../../../../../../hooks/authHooks';
import {
  CursorPageParams,
  useCursorPagedList,
} from '../../../../../../hooks/useCursorPagedList';
import { getApplicationList } from '../../../../../../rest/applicationAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import ApplicationCard from './ApplicationCard';
import type { ApplicationsViewProps } from './Applications.types';
import { getRuntimeDisabledReasonKey } from './Applications.utils';

/** Two cards per row: half of the 24-column core grid. */
export const CARD_SPAN = 12;

export const PAGE_SIZE_OPTIONS = [
  PAGE_SIZE_BASE,
  PAGE_SIZE_MEDIUM,
  PAGE_SIZE_LARGE,
];

export const ApplicationsGrid: FC<{
  isLoading: boolean;
  children: ReactNode;
}> = ({ isLoading, children }) => (
  <Grid data-testid="applications-grid" gap="5">
    {isLoading
      ? [1, 2, 3, 4].map((key) => (
          <Grid.Item key={key} span={CARD_SPAN}>
            <Skeleton height={88} variant="rounded" width="100%" />
          </Grid.Item>
        ))
      : children}
  </Grid>
);

export const ApplicationsPagination: FC<
  Pick<
    ReturnType<typeof useCursorPagedList>,
    'page' | 'pageSize' | 'totalPages' | 'onPageChange' | 'onPageSizeChange'
  >
> = ({ page, pageSize, totalPages, onPageChange, onPageSizeChange }) => (
  // Minimal (prev/next only): cursor paging can only reach adjacent pages.
  <PaginationCardWithControls
    minimal
    page={page}
    pageSize={pageSize}
    pageSizeOptions={PAGE_SIZE_OPTIONS}
    total={totalPages}
    onPageChange={onPageChange}
    onPageSizeChange={onPageSizeChange}
  />
);

const ApplicationsList: FC<ApplicationsViewProps> = ({
  onNavigate,
  onHeaderChange,
}) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const [showDisabled, setShowDisabled] = useState(false);

  const fetchPage = useCallback(
    (params: CursorPageParams) =>
      getApplicationList({
        ...params,
        include: showDisabled ? Include.Deleted : Include.NonDeleted,
      }),
    [showDisabled]
  );
  const {
    items: apps,
    isLoading,
    showPagination,
    ...pagination
  } = useCursorPagedList(fetchPage);

  useEffect(() => {
    onHeaderChange({
      actions: (
        <Box align="center" direction="row" gap={4}>
          <Box align="center" direction="row" gap={2}>
            <Toggle
              aria-label={t('label.show-disabled')}
              data-testid="show-disabled"
              isSelected={showDisabled}
              onChange={setShowDisabled}
            />
            <Typography size="text-sm" weight="medium">
              {t('label.show-disabled')}
            </Typography>
          </Box>
          {isAdminUser && (
            <LimitWrapper resource="app">
              <Button
                color="primary"
                data-testid="browse-apps"
                size="sm"
                onPress={() => onNavigate({ type: 'marketplace' })}>
                {t('label.browse-app-plural')}
              </Button>
            </LimitWrapper>
          )}
        </Box>
      ),
    });
  }, [isAdminUser, onHeaderChange, onNavigate, showDisabled, t]);

  return (
    <Box className="tw:px-8 tw:pb-8" direction="col" gap={4}>
      <Typography
        className="tw:text-secondary tw:uppercase"
        size="text-xs"
        weight="semibold">
        {showDisabled
          ? t('label.disabled-application-plural')
          : t('label.installed-application-plural')}
      </Typography>

      {!isLoading && apps.length === 0 ? (
        <Box className="tw:relative tw:min-h-90">
          <EmptyPlaceholder
            data-testid="no-applications"
            description={
              showDisabled
                ? undefined
                : t('message.no-installed-applications-found')
            }
            icon={GridView}
            title={t('label.no-entity', {
              entity: t('label.application-plural'),
            })}
          />
        </Box>
      ) : (
        <ApplicationsGrid isLoading={isLoading}>
          {apps.map((app) => {
            const reasonKey = getRuntimeDisabledReasonKey(app);

            return (
              <Grid.Item key={app.id} span={CARD_SPAN}>
                <ApplicationCard
                  actionLabel={t('label.configure')}
                  appName={app.name}
                  isDisabled={app.deleted || Boolean(reasonKey)}
                  title={getEntityName(app)}
                  unavailableReason={reasonKey && t(reasonKey)}
                  onClick={() =>
                    onNavigate({
                      type: 'detail',
                      fqn: app.fullyQualifiedName ?? app.name,
                    })
                  }
                />
              </Grid.Item>
            );
          })}
        </ApplicationsGrid>
      )}

      {showPagination && <ApplicationsPagination {...pagination} />}
    </Box>
  );
};

export default ApplicationsList;
