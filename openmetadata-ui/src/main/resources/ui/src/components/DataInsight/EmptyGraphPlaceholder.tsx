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
import { Database01 } from '@openmetadata/ui-core-components/icons';
import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { DATA_INSIGHT_DOCS } from '../../constants/docs.constants';
import { Transi18next } from '../../utils/i18next/LocalUtil';
import NoDataPlaceholder from '../common/EmptyPlaceholder/NoDataPlaceholder';

export const EmptyGraphPlaceholder = ({ icon }: { icon?: ReactElement }) => {
  const { t } = useTranslation();

  return (
    <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
      <NoDataPlaceholder
        data-testid="no-data-placeholder"
        description={t(
          'message.adding-new-entity-is-easy-just-give-it-a-spin',
          {
            entity: t('label.data-insight'),
          }
        )}
        footer={
          <Typography as="p">
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
        }
        icon={icon ?? <Database01 />}
      />
    </div>
  );
};
