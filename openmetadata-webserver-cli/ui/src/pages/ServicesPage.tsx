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
import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import TitleBreadcrumb from '../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import PageLayoutV1 from '../components/PageLayoutV1/PageLayoutV1';
import Services from '../components/Settings/Services/Services';
import { SERVICE_CATEGORY } from '../constants/Services.constant';
import { ServiceCategory } from '../enums/service.enum';

const ServicesPage = () => {
  const { tab } = useParams<{ tab: string }>();
  const serviceName = useMemo(
    () =>
      SERVICE_CATEGORY[tab] ?? ServiceCategory.DATABASE_SERVICES,
    [tab]
  );

  return (
    <PageLayoutV1 pageTitle={serviceName}>
      <Row className="page-container" gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={[]} />
        </Col>
        <Col span={24}>
          <Services serviceName={serviceName} />
        </Col>
      </Row>
    </PageLayoutV1>
  )
};

export default ServicesPage;
