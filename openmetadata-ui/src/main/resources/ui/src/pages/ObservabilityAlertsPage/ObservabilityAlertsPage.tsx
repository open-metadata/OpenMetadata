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
import { Col, Row } from 'antd';
import { useTranslation } from 'react-i18next';
import DeleteWidgetModal from '../../components/common/DeleteWidget/DeleteWidgetModal';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { EntityType } from '../../enums/entity.enum';
import { getEntityName } from '../../utils/EntityNameUtils';
import ObservabilityAlertsHeader from './components/ObservabilityAlertsHeader';
import ObservabilityAlertsTable from './components/ObservabilityAlertsTable';
import { useObservabilityAlerts } from './hooks/useObservabilityAlerts';

const ObservabilityAlertsPage = () => {
  const { t } = useTranslation();
  const {
    alertPermissions,
    alertResourcePermission,
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

  return (
    <PageLayoutV1 pageTitle={t('label.observability-alert')}>
      <Row gutter={[0, 16]}>
        <Col span={24}>
          <ObservabilityAlertsHeader
            canCreate={Boolean(
              alertResourcePermission?.Create || alertResourcePermission?.All
            )}
            onAddAlert={handleAddAlert}
          />
        </Col>
        <Col span={24}>
          <ObservabilityAlertsTable
            alertPermissions={alertPermissions}
            alerts={alerts}
            columnList={columnList}
            currentPage={currentPage}
            getAlertDetailsPath={getAlertDetailsPath}
            loading={loading}
            loadingCount={loadingCount}
            pageSize={pageSize}
            paging={paging}
            showPagination={showPagination}
            onAddAlert={handleAddAlert}
            onPageChange={onPageChange}
            onPageSizeChange={handlePageSizeChange}
            onSelectAlert={handleSelectAlert}
            onViewAlert={onViewAlert}
          />
        </Col>
        <Col span={24}>
          <DeleteWidgetModal
            afterDeleteAction={handleAlertDelete}
            allowSoftDelete={false}
            entityId={selectedAlert?.id ?? ''}
            entityName={getEntityName(selectedAlert)}
            entityType={EntityType.SUBSCRIPTION}
            visible={Boolean(selectedAlert)}
            onCancel={() => handleSelectAlert(undefined)}
          />
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default ObservabilityAlertsPage;
