/*
 *  Copyright 2024 Collate.
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
import { Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { ReactComponent as NoAccessPlaceHolderIcon } from '../../assets/svg/no-access-placeholder.svg';
import DocumentTitle from '../../components/common/DocumentTitle/DocumentTitle';
import PermissionPlaceholder from '../../components/common/EmptyPlaceholder/PermissionPlaceholder';
import { SIZE } from '../../enums/common.enum';

const AccessNotAllowedPage = () => {
  const { t } = useTranslation();

  return (
    <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
      <PermissionPlaceholder
        data-testid="no-data-placeholder"
        footer={
          <>
            <DocumentTitle title={t('label.access-denied')} />
            <Typography as="p" className="w-80" style={{ marginBottom: '0' }}>
              {t('message.error-self-signup-disabled')}
            </Typography>
          </>
        }
        icon={
          <NoAccessPlaceHolderIcon
            data-testid="no-data-image"
            height={SIZE.LARGE}
            width={SIZE.LARGE}
          />
        }
      />
    </div>
  );
};

export default AccessNotAllowedPage;
