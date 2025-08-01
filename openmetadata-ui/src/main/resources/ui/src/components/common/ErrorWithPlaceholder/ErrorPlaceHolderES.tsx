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

import { Col, Row, Space, Typography } from 'antd';
import Qs from 'qs';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import {
  CONNECTORS_DOCS,
  DATA_DISCOVERY_DOCS,
  GLOSSARIES_DOCS,
  INGESTION_DOCS,
  LOCAL_DEPLOYMENT,
  OMD_SLACK_LINK,
  TAGS_DOCS,
} from '../../../constants/docs.constants';
import {
  ELASTICSEARCH_ERROR_PLACEHOLDER_TYPE,
  ERROR_PLACEHOLDER_TYPE,
  SIZE,
} from '../../../enums/common.enum';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useDomainStore } from '../../../hooks/useDomainStore';
import { Transi18next } from '../../../utils/CommonUtils';
import i18n from '../../../utils/i18next/LocalUtil';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import ErrorPlaceHolder from './ErrorPlaceHolder';

type Props = {
  type: ELASTICSEARCH_ERROR_PLACEHOLDER_TYPE;
  errorMessage?: string;
  query?: Qs.ParsedQs;
  size?: SIZE;
};

const stepsData = [
  {
    step: 1,
    title: i18n.t('label.ingest-sample-data'),
    description: i18n.t('message.run-sample-data-to-ingest-sample-data'),
    link: INGESTION_DOCS,
  },
  {
    step: 2,
    title: i18n.t('label.start-elasticsearch-docker'),
    description: i18n.t('message.ensure-elasticsearch-is-up-and-running'),
    link: LOCAL_DEPLOYMENT,
  },
  {
    step: 3,
    title: i18n.t('label.install-service-connectors'),
    description: i18n.t('message.checkout-service-connectors-doc'),
    link: CONNECTORS_DOCS,
  },
  {
    step: 4,
    title: i18n.t('label.more-help'),
    description: i18n.t('message.still-running-into-issue'),
    link: OMD_SLACK_LINK,
  },
];

const ErrorPlaceHolderES = ({ type, errorMessage, query, size }: Props) => {
  const { showDeleted, search, queryFilter, quickFilter } = query ?? {};
  const { tab } = useRequiredParams<{ tab: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeDomain } = useDomainStore();
  const { theme } = useApplicationStore();

  const isQuery = useMemo(
    () =>
      Boolean(search || queryFilter || quickFilter || showDeleted === 'true'),
    [search, queryFilter, quickFilter, showDeleted]
  );

  const noRecordForES = useMemo(() => {
    if (isQuery) {
      return (
        <div className="text-center" data-testid="no-search-results">
          <ErrorPlaceHolder
            className="border-none"
            size={size}
            type={ERROR_PLACEHOLDER_TYPE.FILTER}
          />
        </div>
      );
    }

    if (['glossaries', 'tags'].includes(tab)) {
      return (
        <div className="text-center" data-testid="no-search-results">
          <ErrorPlaceHolder
            permission
            className="border-none"
            doc={tab === 'tags' ? TAGS_DOCS : GLOSSARIES_DOCS}
            heading={
              tab === 'tags' ? t('label.tag-plural') : t('label.glossary')
            }
            size={size}
            type={ERROR_PLACEHOLDER_TYPE.CREATE}
            onClick={() =>
              navigate(tab === 'tags' ? ROUTES.TAGS : ROUTES.GLOSSARY)
            }
          />
        </div>
      );
    }

    return (
      <div className="text-center" data-testid="no-search-results">
        <ErrorPlaceHolder
          className="border-none"
          size={size}
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          <Typography.Paragraph style={{ marginBottom: '0' }}>
            <Transi18next
              i18nKey="message.no-data-available-entity"
              renderElement={<b />}
              values={{
                entity: activeDomain,
              }}
            />
          </Typography.Paragraph>
          <Typography.Paragraph style={{ marginBottom: '0' }}>
            <Transi18next
              i18nKey="message.add-data-asset-domain"
              renderElement={<b />}
              values={{
                domain: activeDomain,
              }}
            />
          </Typography.Paragraph>
          <Typography.Paragraph>
            <Transi18next
              i18nKey="message.refer-to-our-doc"
              renderElement={
                <a
                  href={DATA_DISCOVERY_DOCS}
                  rel="noreferrer"
                  style={{ color: theme.primaryColor }}
                  target="_blank"
                />
              }
              values={{
                doc: t('label.doc-plural-lowercase'),
              }}
            />
          </Typography.Paragraph>
        </ErrorPlaceHolder>
      </div>
    );
  }, [isQuery, tab, activeDomain]);

  const elasticSearchError = useMemo(() => {
    const index = errorMessage?.split('[')[3]?.split(']')[0];
    const errorText = errorMessage && index ? `find ${index} in` : 'access';

    return (
      <div data-testid="es-error">
        <div className="m-b-lg text-center">
          <p>
            <span>{t('message.welcome-to-open-metadata')} </span>
            <span data-testid="error-text">
              {t('message.unable-to-error-elasticsearch', { error: errorText })}
            </span>
          </p>

          <p>{t('message.elasticsearch-setup')}</p>
        </div>
        <Row gutter={16}>
          {stepsData.map((data) => (
            <Col key={data.step} span={6}>
              <Space
                className="justify-between h-full border rounded-4 p-sm"
                direction="vertical">
                <div>
                  <div className="d-flex m-b-xs">
                    <div className="flex-center rounded-full h-10 w-10 border-2-primary text-primary text-lg font-bold">
                      {data.step}
                    </div>
                  </div>

                  <h6
                    className="text-base text-grey-body font-medium"
                    data-testid="service-name">
                    {data.title}
                  </h6>

                  <p className="text-grey-body text-sm m-b-lg">
                    {data.description}
                  </p>
                </div>

                <p>
                  <a href={data.link} rel="noopener noreferrer" target="_blank">
                    {`${t('label.click-here')} >>`}
                  </a>
                </p>
              </Space>
            </Col>
          ))}
        </Row>
      </div>
    );
  }, [errorMessage]);

  return (
    <div className="text-base font-medium">
      {type === ELASTICSEARCH_ERROR_PLACEHOLDER_TYPE.NO_DATA
        ? noRecordForES
        : elasticSearchError}
    </div>
  );
};

export default ErrorPlaceHolderES;
