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

import { Tooltip, Typography } from '@openmetadata/ui-core-components';
import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { DATA_INSIGHT_DOCS } from '../../constants/docs.constants';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../enums/common.enum';
import { Transi18next } from '../../utils/i18next/LocalUtil';
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';

export const EmptyGraphPlaceholder = ({ icon }: { icon?: ReactElement }) => {
  const { t } = useTranslation();

  return (
    <ErrorPlaceHolder
      className="border-none"
      icon={icon}
      size={SIZE.MEDIUM}
      type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
      <Typography
        as="p"
        className="tw:text-primary"
        style={{ marginBottom: '0' }}>
        {t('message.adding-new-entity-is-easy-just-give-it-a-spin', {
          entity: t('label.data-insight'),
        })}
      </Typography>
      <Typography as="p" className="tw:mb-3.5! tw:text-primary">
        <Tooltip title={t('label.documentation')}>
          <span>
            <Transi18next
              i18nKey="message.refer-to-our-doc"
              renderElement={
                <a
                  aria-label={t('label.documentation')}
                  href={DATA_INSIGHT_DOCS}
                  rel="noreferrer"
                  target="_blank"
                />
              }
              values={{
                doc: t('label.doc-plural-lowercase'),
              }}
            />
          </span>
        </Tooltip>
      </Typography>
    </ErrorPlaceHolder>
  );
};
