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
import { Grid } from '@openmetadata/ui-core-components';
import { getLayoutGutter } from '../../utils/common/layout.utils';

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DeleteModal from '../../components/common/DeleteModal/DeleteModal';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { EntityType } from '../../enums/entity.enum';
import { hardDeleteEntity } from '../../utils/DeleteWidget/DeleteWidgetUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import ObservabilityAlertsHeader from './components/ObservabilityAlertsHeader';
import ObservabilityAlertsTable from './components/ObservabilityAlertsTable';
import { useObservabilityAlerts } from './hooks/useObservabilityAlerts';

const ObservabilityAlertsPage = () => {
  const { t } = useTranslation();
  const {
    alertPermissions,
    alertResourcePermission,
    hasResourcePermissionError,
    refetchResourcePermission,
    alerts,
    columnList,
    pageSize,
    currentPage,
    getAlertDetailsPath,
    handlePageSizeChange,
    showPagination,
    paging,
    loading,
    loadingCount,
    selectedAlert,
    handleAddAlert,
    handleAlertDelete,
    handleSelectAlert,
    onViewAlert,
    onPageChange,
  } = useObservabilityAlerts();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAlertHardDelete = useCallback(async () => {
    setIsDeleting(true);
    const isSuccess = await hardDeleteEntity(
      getEntityName(selectedAlert),
      selectedAlert?.id ?? '',
      EntityType.SUBSCRIPTION
    );
    if (isSuccess) {
      await handleAlertDelete();
    } else {
      handleSelectAlert(undefined);
    }
    setIsDeleting(false);
  }, [selectedAlert, handleAlertDelete, handleSelectAlert]);

  return (
    <PageLayoutV1 pageTitle={t('label.observability-alert')}>
      <Grid
        className="layout-row layout-grid"
        style={{ ...getLayoutGutter(0, 16) }}>
        <Grid.Item className="layout-column" span={24}>
          <ObservabilityAlertsHeader
            canCreate={Boolean(
              alertResourcePermission?.Create || alertResourcePermission?.All
            )}
            onAddAlert={handleAddAlert}
          />
        </Grid.Item>
        <Grid.Item className="layout-column" span={24}>
          <ObservabilityAlertsTable
            alertPermissions={alertPermissions}
            alertResourcePermission={alertResourcePermission}
            alerts={alerts}
            columnList={columnList}
            currentPage={currentPage}
            getAlertDetailsPath={getAlertDetailsPath}
            hasResourcePermissionError={hasResourcePermissionError}
            loading={loading}
            loadingCount={loadingCount}
            pageSize={pageSize}
            paging={paging}
            showPagination={showPagination}
            onAddAlert={handleAddAlert}
            onPageChange={onPageChange}
            onPageSizeChange={handlePageSizeChange}
            onRetryPermission={refetchResourcePermission}
            onSelectAlert={handleSelectAlert}
            onViewAlert={onViewAlert}
          />
        </Grid.Item>
        <Grid.Item className="layout-column" span={24}>
          <DeleteModal
            entityTitle={getEntityName(selectedAlert)}
            isDeleting={isDeleting}
            message={t('message.permanently-delete-common-message', {
              entity: getEntityName(selectedAlert)?.toLowerCase?.() ?? '',
            })}
            open={Boolean(selectedAlert)}
            onCancel={() => handleSelectAlert(undefined)}
            onDelete={handleAlertHardDelete}
          />
        </Grid.Item>
      </Grid>
    </PageLayoutV1>
  );
};

export default ObservabilityAlertsPage;
