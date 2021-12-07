/*
 *  Copyright 2021 Collate
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
import { Link } from 'react-router-dom';
import { Button } from '../../components/buttons/Button/Button';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import PageContainer from '../../components/containers/PageContainer';

const PageNotFound = () => {
  return (
    <PageContainer>
      <div
        className="tw-flex tw-flex-col tw-place-items-center tw-mt-24"
        data-testid="no-page-found">
        <ErrorPlaceHolder />
        <div
          className="tw-flex tw-mt-3 tw-justify-around"
          data-testid="route-links">
          <Link className="tw-mr-2" to="/">
            <Button size="regular" theme="primary" variant="contained">
              Go to Home
            </Button>
          </Link>
          <Link className="tw-mr-2" to="/explore">
            <Button size="regular" theme="primary" variant="contained">
              Explore
            </Button>
          </Link>
        </div>
      </div>
    </PageContainer>
  );
};

export default PageNotFound;
