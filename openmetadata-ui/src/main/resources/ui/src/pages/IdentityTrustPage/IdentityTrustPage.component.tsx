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

import { Card, Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';

const IdentityTrustPage = () => {
  const { t } = useTranslation();

  return (
    <PageLayoutV1 pageTitle={t('label.identity-trust')}>
      <Card className="tw:p-6">
        <Typography.Heading level={5}>
          {t('label.identity-trust')}
        </Typography.Heading>
        <Typography.Paragraph className="tw:mb-0">
          {t('message.identity-trust-placeholder')}
        </Typography.Paragraph>
      </Card>
    </PageLayoutV1>
  );
};

export default IdentityTrustPage;

