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
        itemClass="tw-border tw-border-blue-500 tw-text-blue-500 tw-rounded tw-px-3 tw-py-1.5 tw-text-sm tw-mx-2"
        itemsCountPerPage={sizePerPage}
        linkClass="tw-text-blue-500 tw-font-medium tw-link"
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
