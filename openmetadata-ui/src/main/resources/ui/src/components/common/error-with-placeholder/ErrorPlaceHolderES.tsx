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

import { Typography } from 'antd';
import { uniqueId } from 'lodash';
import { observer } from 'mobx-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from 'utils/i18next/LocalUtil';
import AppState from '../../../AppState';
import { CONNECTORS_DOCS } from '../../../constants/docs.constants';
import { NoDataFoundPlaceHolder } from '../../../constants/Services.constant';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';

type Props = {
  type: 'error' | 'noData';
  errorMessage?: string;
  query?: string;
};

const stepsData = [
  {
    step: 1,
    title: i18n.t('label.ingest-sample-data'),
    description: i18n.t('message.run-sample-data-to-ingest-sample-data'),
    link: 'https://docs.open-metadata.org/openmetadata/ingestion/workflows/profiler',
  },
  {
    step: 2,
    title: i18n.t('label.start-elasticsearch-docker'),
    description: i18n.t('message.ensure-elasticsearch-is-up-and-running'),
    link: 'https://docs.open-metadata.org/quick-start/local-deployment',
  },
  {
    step: 3,
    title: i18n.t('label.install-service-connectors'),
    description: i18n.t('message.service-connectors-message'),
    link: 'https://docs.open-metadata.org/integrations/connectors',
  },
  {
    step: 4,
    title: i18n.t('label.more-help'),
    description: i18n.t('message.still-running-into-issue'),
    link: 'https://slack.open-metadata.org',
  },
];

const ErrorPlaceHolderES = ({ type, errorMessage, query = '' }: Props) => {
  const { t } = useTranslation();
  const { isAuthDisabled } = useAuthContext();
  const getUserDisplayName = () => {
    return isAuthDisabled
      ? AppState.users?.length > 0
        ? AppState.users[0].displayName || AppState.users[0].name
        : t('label.user')
      : AppState.userDetails.displayName || AppState.userDetails.name;
  };
  const noRecordForES = () => {
    return (
      <div className="tw-text-center" data-testid="no-search-results">
        <div className="flex-center flex-col tw-mt-32 " data-testid="error">
          {' '}
          <img
            data-testid="no-data-image"
            src={NoDataFoundPlaceHolder}
            width="100"
          />
        </div>
        <div className="tw-flex tw-flex-col tw-items-center tw-mt-6 tw-text-base tw-font-medium">
          {query ? (
            <>
              {t('label.no-matching-data-asset')}
              {query ? (
                <>
                  {' '}
                  {t('label.for-lowercase')}
                  <span className="tw-text-primary tw-font-medium">
                    {query}
                  </span>
                </>
              ) : null}
            </>
          ) : (
            <>
              {' '}
              <Typography.Text className="tw-text-sm">
                {t('message.no-data-available')}
              </Typography.Text>
              <Typography.Text className="tw-text-sm">
                {t('message.add-service-connection')}
              </Typography.Text>
              <Typography.Text className="tw-text-sm">
                {t('label.refer-to-our')}{' '}
                <Typography.Link href={CONNECTORS_DOCS} target="_blank">
                  {t('label.doc-plural')}
                </Typography.Link>{' '}
                {t('label.for-more-info')}
              </Typography.Text>
              <span />
            </>
          )}
        </div>
      </div>
    );
  };

  const elasticSearchError = () => {
    const index = errorMessage?.split('[')[3]?.split(']')[0];
    const errorText = errorMessage && index ? `find ${index} in` : 'access';

    return (
      <div className="tw-mb-5" data-testid="es-error">
        <div className="tw-mb-3 tw-text-center">
          <p>
            <span>{t('label.welcome-to-open-metadata')} </span>
            <span data-testid="error-text">
              {t('message.unable-to-error-elasticsearch', { error: errorText })}
            </span>
          </p>

          <p>{t('message.elasticsearch-setup')}</p>
        </div>
        <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-mt-5">
          {stepsData.map((data) => (
            <div
              className="tw-card tw-flex tw-flex-col tw-justify-between tw-p-5"
              key={uniqueId()}>
              <div>
                <div className="tw-flex tw-mb-2">
                  <div className="tw-rounded-full tw-flex tw-justify-center tw-items-center tw-h-10 tw-w-10 tw-border-2 tw-border-primary tw-text-lg tw-font-bold tw-text-primary">
                    {data.step}
                  </div>
                </div>

                <h6
                  className="tw-text-base tw-text-grey-body tw-font-medium"
                  data-testid="service-name">
                  {data.title}
                </h6>

                <p className="tw-text-grey-body tw-pb-1 tw-text-sm tw-mb-5">
                  {data.description}
                </p>
              </div>

              <p>
                <a href={data.link} rel="noopener noreferrer" target="_blank">
                  {`${t('label.click-here')} >>`}
                </a>
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="tw-mt-10 tw-text-base tw-font-medium">
      {type !== 'noData' && (
        <p className="tw-text-center tw-text-lg tw-font-bold tw-mb-1 tw-text-primary">
          {`Hi, ${getUserDisplayName()}!`}
        </p>
      )}
      {type === 'noData' && noRecordForES()}
      {type === 'error' && elasticSearchError()}
    </div>
  );
};

export default observer(ErrorPlaceHolderES);
