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

import { Typography } from '@openmetadata/ui-core-components';
import { Database01 } from '@openmetadata/ui-core-components/icons';
import Qs from 'qs';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import {
  DATA_DISCOVERY_DOCS,
  GLOSSARIES_DOCS,
  TAGS_DOCS,
} from '../../../constants/docs.constants';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useDomainStore } from '../../../hooks/useDomainStore';
import { Transi18next } from '../../../utils/i18next/LocalUtil';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import CreatePlaceholder from '../../common/EmptyPlaceholder/CreatePlaceholder';
import NoDataPlaceholder from '../../common/EmptyPlaceholder/NoDataPlaceholder';
import NoFilteredResultsPlaceholder from '../../common/EmptyPlaceholder/NoFilteredResultsPlaceholder';
import NoSearchResultsPlaceholder from '../../common/EmptyPlaceholder/NoSearchResultsPlaceholder';

type Props = {
  query?: Qs.ParsedQs;
};

const SearchEmptyState = ({ query }: Props) => {
  const { showDeleted, search, queryFilter, quickFilter, browsePath } =
    query ?? {};
  const { tab } = useRequiredParams<{ tab: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeDomain } = useDomainStore();
  const { theme } = useApplicationStore();

  const isQuery = useMemo(() => {
    const hasActiveSearchInput = search || queryFilter || quickFilter;

    return Boolean(
      hasActiveSearchInput || browsePath || showDeleted === 'true'
    );
  }, [search, queryFilter, quickFilter, browsePath, showDeleted]);

  const noRecordForES = useMemo(() => {
    if (isQuery) {
      const EmptyStatePlaceholder = search
        ? NoSearchResultsPlaceholder
        : NoFilteredResultsPlaceholder;

      return (
        <div className="text-center tw:w-full" data-testid="no-search-results">
          <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
            <EmptyStatePlaceholder
              data-testid="search-error-placeholder"
              description={t('message.try-adjusting-filter')}
              title={search ? t('label.no-result-found') : undefined}
            />
          </div>
        </div>
      );
    }

    if (['glossaries', 'tags'].includes(tab)) {
      return (
        <div className="text-center tw:w-full" data-testid="no-search-results">
          <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
            <CreatePlaceholder
              permission
              data-testid={`create-error-placeholder-${
                tab === 'tags' ? t('label.tag-plural') : t('label.glossary')
              }`}
              doc={tab === 'tags' ? TAGS_DOCS : GLOSSARIES_DOCS}
              heading={
                tab === 'tags' ? t('label.tag-plural') : t('label.glossary')
              }
              onCreate={() =>
                navigate(tab === 'tags' ? ROUTES.TAGS : ROUTES.GLOSSARY)
              }
            />
          </div>
        </div>
      );
    }

    return (
      <div className="text-center tw:w-full" data-testid="no-search-results">
        <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
          <NoDataPlaceholder
            data-testid="no-data-placeholder"
            description={t('message.add-data-asset-domain', {
              domain: activeDomain,
            })}
            footer={
              <>
                <Typography as="p" color="secondary" size="text-xs">
                  <Transi18next
                    i18nKey="message.refer-to-our-doc"
                    renderElement={
                      <a
                        aria-label={t('label.documentation')}
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
                </Typography>
              </>
            }
            icon={<Database01 />}
            title={t('message.no-data-available-entity', {
              entity: activeDomain,
            })}
          />
        </div>
      </div>
    );
  }, [isQuery, tab, activeDomain, search]);

  return <div className="text-base font-medium tw:w-full">{noRecordForES}</div>;
};

export default SearchEmptyState;
