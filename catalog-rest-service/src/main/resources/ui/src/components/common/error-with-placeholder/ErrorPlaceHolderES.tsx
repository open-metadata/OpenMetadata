import React from 'react';
import AppState from '../../../AppState';
import NoDataFoundPlaceHolder from '../../../assets/img/no-data-placeholder.png';

type Props = {
  type: 'error' | 'noData';
};

const ErrorPlaceHolderES = ({ type }: Props) => {
  const noRecordForES = () => {
    return (
      <>
        <p>
          We are unable to get any results from{' '}
          <a
            className="tw-text-primary tw-font-medium"
            href="https://docs.open-metadata.org/install/metadata-ingestion/connectors/elastic-search"
            rel="noopener noreferrer"
            target="_blank">
            Elasticsearch.
          </a>
        </p>
        <p>Please make sure you ran the Elasticsearch indexing.</p>
        <p>
          Refer to our{' '}
          <a
            className="tw-text-primary tw-font-medium"
            href="https://docs.open-metadata.org/install/metadata-ingestion/connectors/elastic-search"
            rel="noopener noreferrer"
            target="_blank">
            docs
          </a>{' '}
          for Elasticsearch indexing
        </p>
      </>
    );
  };

  return (
    <>
      <div className="tw-flex tw-flex-col tw-mt-24 tw-place-items-center">
        {' '}
        <img src={NoDataFoundPlaceHolder} width={200} />
      </div>
      <div className="tw-flex tw-flex-col tw-items-center tw-mt-10 tw-text-base tw-font-normal">
        <p className="tw-text-lg tw-font-bold tw-mb-1 tw-text-primary">
          {`Hi, ${AppState.userDetails.displayName}!`}
        </p>
        {type === 'noData' && noRecordForES()}
        {type === 'error' && (
          <p className="tw-max-w-sm tw-text-center">
            OpenMetadata requires Elasticsearch 7+ running and configured in
            <span className="tw-text-primary tw-font-medium tw-mx-1">
              openmetadata.yaml.
            </span>
            Please check the configuration and make sure the Elasticsearch is
            running.
          </p>
        )}
      </div>
    </>
  );
};

export default ErrorPlaceHolderES;
