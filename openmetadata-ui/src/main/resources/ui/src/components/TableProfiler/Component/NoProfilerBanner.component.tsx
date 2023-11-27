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
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as NoDataIcon } from '../../../assets/svg/no-data-icon.svg';

const NoProfilerBanner = () => {
  const { t } = useTranslation();

  return (
    <div
      className="border d-flex items-center border-warning rounded-4 p-xs"
      data-testid="no-profiler-placeholder">
      <NoDataIcon />
      <p className="m-l-xs">
        {t('message.no-profiler-message')}
        <Link
          target="_blank"
          to={{
            pathname:
              'https://docs.open-metadata.org/connectors/ingestion/workflows/profiler',
          }}>
          {`${t('label.here-lowercase')}.`}
        </Link>
      </p>
    </div>
  );
};

export default NoProfilerBanner;
