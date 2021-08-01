import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/buttons/Button/Button';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import PageContainer from '../../components/containers/PageContainer';

const PageNotFound = () => {
  return (
    <PageContainer>
      <div className="tw-flex tw-flex-col tw-place-items-center tw-mt-24">
        <ErrorPlaceHolder />
        <div className="tw-flex tw-mt-3 tw-justify-around">
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
