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
import { Skeleton } from '@openmetadata/ui-core-components';
import { Card, Col, Row } from 'antd';

/**
 * Widget-grid placeholder shown while persona / layout data loads.
 *
 * Intentionally renders only the card grid — not a fake header — so
 * {@link HomeLandingPage} can always mount its page header immediately
 * (skeleton-first pattern). This avoids the extra API round-trip that was
 * blocking LCP on /my-data.
 */
export const HomeLandingPageSkeleton = () => {
  return (
    <Row className="p-x-box" gutter={[16, 16]}>
      {[0, 1, 2, 3].map((i) => (
        <Col key={i} lg={12} md={24} sm={24} xl={12} xs={24}>
          <Card className="landing-page-skeleton-card">
            <div className="tw:flex tw:flex-col tw:gap-3">
              {['30%', '90%', '85%', '80%', '70%'].map((width, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <Skeleton height={16} key={index} width={width} />
              ))}
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default HomeLandingPageSkeleton;
