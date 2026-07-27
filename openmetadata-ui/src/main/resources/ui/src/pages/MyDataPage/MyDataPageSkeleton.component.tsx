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
import './my-data.less';

/**
 * Widget-grid placeholder shown while persona / layout data loads.
 *
 * Intentionally renders only the card grid — not a fake header — so
 * {@link MyDataPage} can always mount {@link CustomiseLandingPageHeader}
 * immediately (skeleton-first pattern). This avoids the extra API round-trip
 * that was blocking LCP on /my-data.
 *
 * Match the eight-column grid used in `MyDataPage` so cards land in roughly
 * the same place a real widget would, avoiding layout shift on reveal.
 */
export const MyDataPageSkeleton = () => {
  return (
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
  );
};

export default MyDataPageSkeleton;
