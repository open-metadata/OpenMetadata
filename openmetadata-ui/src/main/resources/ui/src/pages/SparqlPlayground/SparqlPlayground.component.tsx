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

import { Badge, Card, Typography } from '@openmetadata/ui-core-components';
import { Home02 } from '@untitledui/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import SparqlQueryConsole from '../../components/SparqlQueryConsole/SparqlQueryConsole.component';

const SparqlPlayground: React.FC = () => {
  const { t } = useTranslation();

  return (
    <PageLayoutV1 pageTitle={t('label.sparql-playground')}>
      <div className="tw:flex tw:flex-col tw:gap-3">
        <TitleBreadcrumb
          useCustomArrow
          titleLinks={[
            {
              name: '',
              icon: <Home02 size={12} />,
              url: '/',
              activeTitle: true,
            },
            {
              name: t('label.sparql-playground'),
              url: '',
            },
          ]}
        />

        <Card className="tw:p-5">
          <div className="tw:flex tw:items-center tw:gap-2">
            <Typography
              as="span"
              data-testid="heading"
              size="text-md"
              weight="semibold">
              {t('label.sparql-playground')}
            </Typography>
            <Badge color="blue-light" size="sm" type="pill-color">
              {t('label.beta')}
            </Badge>
          </div>
          <Typography
            as="p"
            className="tw:mt-1 tw:text-tertiary"
            size="text-sm">
            {t('message.sparql-playground-subtitle')}
          </Typography>
        </Card>

        <SparqlQueryConsole />
      </div>
    </PageLayoutV1>
  );
};

export default SparqlPlayground;
