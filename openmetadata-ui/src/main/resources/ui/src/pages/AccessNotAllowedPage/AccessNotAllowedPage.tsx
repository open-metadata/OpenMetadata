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
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import NoAccessPlaceHolderIcon from '../../assets/svg/no-access-placeholder.svg?react';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../enums/common.enum';

const AccessNotAllowedPage = () => {
  const { t } = useTranslation();

  return (
    <ErrorPlaceHolder
      icon={
        <NoAccessPlaceHolderIcon
          data-testid="no-data-image"
          height={SIZE.LARGE}
          width={SIZE.LARGE}
        />
      }
      size={SIZE.LARGE}
      type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
      <Typography.Paragraph className="w-80" style={{ marginBottom: '0' }}>
        {t('message.error-self-signup-disabled')}
      </Typography.Paragraph>
    </ErrorPlaceHolder>
  );
};

export default AccessNotAllowedPage;
