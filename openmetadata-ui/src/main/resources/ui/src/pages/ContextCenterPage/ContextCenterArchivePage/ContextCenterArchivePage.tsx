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

import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ContextCenterHeader from '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component';
import { ROUTES } from '../../../constants/constants';

const ContextCenterArchivePage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div
      className="tw:flex tw:flex-col tw:w-full tw:bg-secondary tw:px-5"
      data-testid="context-center-archive-page">
      <ContextCenterHeader
        breadcrumbs={[
          { name: t('label.context-center'), url: ROUTES.CONTEXT_CENTER },
          {
            activeTitle: true,
            name: t('label.archive'),
            url: '',
          },
        ]}
        subtitle={t('message.context-center-archive-subtitle', {
          defaultValue: 'View archived articles and documents',
        })}
        title={t('label.archive')}
        onCreateArticle={() => navigate(ROUTES.CONTEXT_CENTER_ARTICLES)}
        onUploadFile={() => undefined}
      />
    </div>
  );
};

export default ContextCenterArchivePage;
