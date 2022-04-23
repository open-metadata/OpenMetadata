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
import notFoundImage from '../../assets/img/404-image.png';
import notFoundNumber from '../../assets/svg/404-number.svg';
import { Button } from '../../components/buttons/Button/Button';
import { ROUTES } from '../../constants/constants';

const PageNotFound = () => {
  return (
    <div className="page-not-found-container tw-relative">
      <div className="tw-flex-center tw-hw-full tw-absolute tw-inset-0">
        <img alt="not found" src={notFoundNumber} />
      </div>
      <div className="tw-flex tw-hw-full tw-absolute tw-inset-0">
        <div className="tw-hw-full tw-flex-center">
          <div className="tw-text-center">
            <h4 className="tw-font-bold tw-text-3xl tw-text-grey-muted">
              Page Not Found
            </h4>
            <p className="tw-text-lg tw-text-grey-muted-muted">
              The page you are looking for is not available
            </p>
            <div className="tw-text-center tw-mt-16">
              <Link to={ROUTES.HOME}>
                <Button className="tw-mr-5" theme="primary">
                  Go To Homepage
                </Button>
              </Link>
              <Link to={ROUTES.EXPLORE}>
                <Button className="tw-opacity-40" theme="primary">
                  Explore
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <div className="tw-hw-full tw-flex-center">
          <img alt="not found" src={notFoundImage} />
        </div>
      </div>
    </div>
  );
};

export default PageNotFound;
