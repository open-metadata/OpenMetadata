/*
 *  Copyright 2023 Collate.
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
import { Card, Grid } from '@openmetadata/ui-core-components';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import IncidentManager from '../../components/IncidentManager/IncidentManager.component';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { LEARNING_PAGE_IDS } from '../../constants/Learning.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { getLayoutGutter } from '../../utils/common/layout.utils';
import incidentManagerClassBase from './IncidentManagerClassBase';

const IncidentManagerPage = () => {
  const { t } = useTranslation();
  const WidgetComponent = useMemo(
    () => incidentManagerClassBase.getIncidentWidgets(),
    []
  );

  const pageHeaderData = useMemo(
    () => ({
      header: t(PAGE_HEADERS.INCIDENT_MANAGER.header),
      subHeader: t(PAGE_HEADERS.INCIDENT_MANAGER.subHeader),
    }),
    [t]
  );

  return (
    <PageLayoutV1 pageTitle={t('label.incident-manager')}>
      <Grid
        className="layout-row layout-grid m-t-xs"
        style={{ ...getLayoutGutter(0, 16) }}>
        <Grid.Item className="layout-column" span={24}>
          <Card>
            <Card.Content className="tw:p-5">
              <PageHeader
                data={pageHeaderData}
                learningPageId={LEARNING_PAGE_IDS.INCIDENT_MANAGER}
              />
            </Card.Content>
          </Card>
        </Grid.Item>

        {WidgetComponent && (
          <Grid.Item className="layout-column" span={24}>
            <WidgetComponent />
          </Grid.Item>
        )}

        <Grid.Item className="layout-column" span={24}>
          <IncidentManager />
        </Grid.Item>
      </Grid>
    </PageLayoutV1>
  );
};

export default IncidentManagerPage;
