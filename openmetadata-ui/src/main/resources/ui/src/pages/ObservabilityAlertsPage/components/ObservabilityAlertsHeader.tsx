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

import { Button, Card, Col, Row } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../../components/PageHeader/PageHeader.component';
import { LEARNING_PAGE_IDS } from '../../../constants/Learning.constants';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { ObservabilityAlertsHeaderProps } from '../ObservabilityAlertsPage.interface';

function ObservabilityAlertsHeader({
  canCreate,
  onAddAlert,
}: Readonly<ObservabilityAlertsHeaderProps>) {
  const { t } = useTranslation();

  const pageHeaderData = useMemo(
    () => ({
      header: t('label.observability-alert'),
      subHeader: t('message.alerts-description'),
    }),
    [t]
  );

  return (
    <Card>
      <Row>
        <Col span={16}>
          <PageHeader
            data={pageHeaderData}
            learningPageId={LEARNING_PAGE_IDS.DATA_OBSERVABILITY}
            title={t('label.observability-alert')}
          />
        </Col>
        <Col className="d-flex justify-end" span={8}>
          {canCreate && (
            <LimitWrapper resource="eventsubscription">
              <Button
                data-testid="create-observability"
                type="primary"
                onClick={onAddAlert}>
                {t('label.add-entity', { entity: t('label.alert') })}
              </Button>
            </LimitWrapper>
          )}
        </Col>
      </Row>
    </Card>
  );
}

export default ObservabilityAlertsHeader;
