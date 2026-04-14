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
import { Alert, Typography } from 'antd';

import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { SEARCH_INDEXING_APPLICATION } from '../../constants/explore.constants';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { Transi18next } from '../../utils/CommonUtils';
import { getApplicationDetailsPath } from '../../utils/RouterUtils';

export const IndexNotFoundBanner = () => {
  const { theme } = useApplicationStore();
  const { t } = useTranslation();

  return (
    <Alert
      closable
      description={
        <div className="d-flex items-start gap-3">
          <ExclamationCircleOutlined
            style={{
              color: theme.errorColor,
              fontSize: '16px',
            }}
          />
          <div className="d-flex flex-col gap-2">
            <Typography.Text className="font-semibold text-xs">
              {t('server.indexing-error')}
            </Typography.Text>
            <Typography.Paragraph className="m-b-0 text-xs">
              <Transi18next
                i18nKey="message.configure-search-re-index"
                renderElement={
                  <Link
                    className="alert-link"
                    to={getApplicationDetailsPath(SEARCH_INDEXING_APPLICATION)}
                  />
                }
                values={{
                  settings: t('label.search-index-setting-plural'),
                }}
              />
            </Typography.Paragraph>
          </div>
        </div>
      }
      type="error"
    />
  );
};
