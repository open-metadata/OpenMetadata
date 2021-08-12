/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { PaginationProps } from 'Models';
import PropTypes from 'prop-types';
import React from 'react';
import Paginations from 'react-js-pagination';
import './Pagination.css';
const Pagination: React.FC<PaginationProps> = ({
  sizePerPage,
  totalNumberOfValues,
  currentPage,
  paginate,
}): JSX.Element => {
  return (
    <div>
      <Paginations
        hideFirstLastPages
        activePage={currentPage}
        disabledClass="tw-opacity-60 disabled"
        itemClass="tw-border tw-border-primary tw-text-blue-500 tw-rounded tw-px-3 tw-py-1.5 tw-text-sm tw-mx-2"
        itemsCountPerPage={sizePerPage}
        linkClass="tw-text-primary tw-font-medium tw-link"
        nextPageText={
          <>
            Next{' '}
            <i className="fas fa-arrow-right tw-text-sm tw-align-middle tw-pl-1.5" />
          </>
        }
        pageRangeDisplayed={-1}
        prevPageText={
          <>
            <i className="fas fa-arrow-left tw-text-sm tw-align-middle tw-pr-1.5" />
            Previous{' '}
          </>
        }
        totalItemsCount={totalNumberOfValues}
        onChange={paginate}
      />
    </div>
  );
};

Pagination.propTypes = {
  sizePerPage: PropTypes.number.isRequired,
  totalNumberOfValues: PropTypes.number.isRequired,
  currentPage: PropTypes.number.isRequired,
  paginate: PropTypes.func.isRequired,
};

export default Pagination;
