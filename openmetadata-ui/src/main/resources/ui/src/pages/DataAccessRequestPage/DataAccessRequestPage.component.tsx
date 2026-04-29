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

import { Button } from '@openmetadata/ui-core-components';
import { Plus } from '@untitledui/icons';
import { Typography } from 'antd';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { DataAccessTab } from '../../components/DataAccessRequest/DataAccessRequest.interface';
import DataAccessDatasetPicker from '../../components/DataAccessRequest/DataAccessRequestDrawer/DataAccessDatasetPicker.component';
import DataAccessRequestDrawer from '../../components/DataAccessRequest/DataAccessRequestDrawer/DataAccessRequestDrawer.component';
import DataAccessRequestList from '../../components/DataAccessRequest/DataAccessRequestList/DataAccessRequestList.component';
import { PLACEHOLDER_ROUTE_TAB, ROUTES } from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';

const { Title, Text } = Typography;

const VALID_TABS: DataAccessTab[] = ['my-requests', 'my-approvals'];

const DataAccessRequestPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tab } = useParams<{ tab: string }>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [requestTarget, setRequestTarget] = useState<{
    fqn: string;
    displayName: string;
    entityType: EntityType;
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const activeTab: DataAccessTab = useMemo(() => {
    if (tab && VALID_TABS.includes(tab as DataAccessTab)) {
      return tab as DataAccessTab;
    }

    return 'my-requests';
  }, [tab]);

  const handleTabChange = useCallback(
    (key: DataAccessTab) => {
      navigate(
        ROUTES.DATA_ACCESS_REQUESTS_WITH_TAB.replace(PLACEHOLDER_ROUTE_TAB, key)
      );
    },
    [navigate]
  );

  return (
    <div
      className="tw:px-8 tw:py-6 tw:bg-(--color-bg-secondary) tw:min-h-full"
      data-testid="data-access-request-page">
      <TitleBreadcrumb
        className="tw:mb-3"
        titleLinks={[
          { name: t('label.market-place'), url: ROUTES.DATA_MARKETPLACE },
          {
            name: t('label.data-access-request'),
            url: '',
            activeTitle: true,
          },
        ]}
      />

      <div className="tw:flex tw:items-start tw:justify-between tw:mb-5">
        <div>
          <Title className="tw:!mb-1" level={3}>
            {t('label.data-access-request')}
          </Title>
          <Text type="secondary">
            {t('message.data-access-request-page-description')}
          </Text>
        </div>
        <Button
          color="primary"
          data-testid="dar-add-request-button"
          iconLeading={Plus}
          size="md"
          onClick={() => setPickerOpen(true)}>
          {t('label.add-request')}
        </Button>
      </div>

      <DataAccessRequestList
        activeTab={activeTab}
        key={`list-${refreshKey}`}
        onTabChange={handleTabChange}
      />

      <DataAccessDatasetPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(opt) => {
          setPickerOpen(false);
          setRequestTarget(opt);
        }}
      />

      {requestTarget && (
        <DataAccessRequestDrawer
          entityDisplayName={requestTarget.displayName}
          entityFqn={requestTarget.fqn}
          entityType={requestTarget.entityType}
          open
          onClose={() => setRequestTarget(null)}
          onCreated={() => {
            setRequestTarget(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
};

export default DataAccessRequestPage;
