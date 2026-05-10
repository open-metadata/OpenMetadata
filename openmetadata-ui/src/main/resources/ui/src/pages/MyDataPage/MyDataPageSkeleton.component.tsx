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
import { Card, Col, Row, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import './my-data.less';

/**
 * Above-the-fold placeholder for {@link MyDataPage} while persona / layout data is loading.
 *
 * Mirrors page chrome (header band + 4-card grid) so first paint shows the actual page shape
 * instead of a centered spinner. Real widgets stream in once the layout resolves; widgets that
 * are below the fold remain {@link DeferredWidget}-gated as before.
 *
 * Match the eight-column grid used in `MyDataPage` so cards land in roughly the same place a
 * real widget would, avoiding a layout shift on reveal.
 */
export const MyDataPageSkeleton = () => {
  const { t } = useTranslation();

  return (
    // Pass the actual page title so the browser tab / a11y landmark match the real page.
    // An empty `pageTitle` would briefly clear the document title and break screen-reader
    // announcements during the skeleton phase.
    <PageLayoutV1 className="p-b-lg" pageTitle={t('label.my-data')}>
      <div className="grid-wrapper" dir="ltr">
        <div className="landing-page-skeleton-header">
          <Skeleton
            active
            paragraph={{ rows: 1, width: ['40%'] }}
            title={{ width: '20%' }}
          />
        </div>
        <Row className="p-x-box" gutter={[16, 16]}>
          {[0, 1, 2, 3].map((i) => (
            <Col key={i} lg={12} md={24} sm={24} xl={12} xs={24}>
              <Card className="landing-page-skeleton-card">
                <Skeleton
                  active
                  paragraph={{ rows: 4, width: ['90%', '85%', '80%', '70%'] }}
                  title={{ width: '30%' }}
                />
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </PageLayoutV1>
  );
};

export default MyDataPageSkeleton;
