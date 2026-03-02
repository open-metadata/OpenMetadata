/*
 *  Copyright 2023 Collate.
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
import { ArrowRight } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { ReactComponent as NoDataIcon } from '../../../../../assets/svg/ticket-with-check.svg';
import documentationLinksClassBase from '../../../../../utils/DocumentationLinksClassBase';
import './no-profiler-banner.less';

const NoProfilerBanner = () => {
  const { t } = useTranslation();
  const profilerDocsLink =
    documentationLinksClassBase.getDocsURLS()
      .DATA_QUALITY_PROFILER_WORKFLOW_DOCS;

  return (
    <div
      className="no-profiler-banner-container tw:flex tw:items-center tw:gap-4"
      data-testid="no-profiler-placeholder">
      <div className="tw:shrink-0">
        <div className="tw:flex tw:h-10 tw:w-10 tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-border-secondary tw:bg-primary">
          <NoDataIcon />
        </div>
      </div>

      <div className="tw:grow">
        <p className="profiler-title" data-testid="profiler-title">
          {t('message.no-profiler-title')}
        </p>
        <p className="profiler-description" data-testid="profiler-description">
          {t('message.no-profiler-message')}
        </p>
      </div>

      <div className="tw:flex tw:shrink-0 tw:items-center tw:justify-end">
        <a
          className="tw:font-semibold tw:text-brand-600 tw:flex tw:items-center tw:gap-1"
          data-testid="documentation-link"
          href={profilerDocsLink}
          rel="noreferrer"
          target="_blank"
          title="data quality observability profiler workflow">
          {t('label.learn-more')} <ArrowRight className="tw:size-4" />
        </a>
      </div>
    </div>
  );
};

export default NoProfilerBanner;
