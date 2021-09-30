import { observer } from 'mobx-react';
import React from 'react';
import AppState from '../../../AppState';
import NoDataFoundPlaceHolder from '../../../assets/img/no-data-placeholder.png';
import { useAuth } from '../../../hooks/authHooks';

type Props = {
  type: 'error' | 'noData';
  errorMessage?: string;
  query?: string;
};

const ErrorPlaceHolderES = ({ type, errorMessage, query = '' }: Props) => {
  const { isAuthDisabled } = useAuth();
  const getUserDisplayName = () => {
    return isAuthDisabled
      ? AppState.users?.length > 0
        ? AppState.users[0].displayName
        : 'User'
      : AppState.userDetails.displayName;
  };
  const noRecordForES = () => {
    return (
      <p className="tw-text-center">
        No matching data assets found
        {query ? (
          <>
            {' '}
            for <span className="tw-text-primary tw-font-medium">{query}</span>
          </>
        ) : null}
      </p>
    );
  };

  const elasticSearchError = () => {
    const index = errorMessage?.split('[')[3]?.split(']')[0];

    return errorMessage && index ? (
      <p className="tw-max-w-sm tw-text-center">
        OpenMetadata requires index
        <span className="tw-text-primary tw-font-medium tw-mx-1">
          {index}
        </span>{' '}
        to exist while running Elasticsearch. Please check your Elasticsearch
        indexes
      </p>
    ) : (
      <p className="tw-max-w-sm tw-text-center">
        OpenMetadata requires Elasticsearch 7+ running and configured in
        <span className="tw-text-primary tw-font-medium tw-mx-1">
          openmetadata.yaml.
        </span>
        Please check the configuration and make sure the Elasticsearch is
        running.
      </p>
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
          {`Hi, ${getUserDisplayName()}!`}
        </p>
        {type === 'noData' && noRecordForES()}
        {type === 'error' && elasticSearchError()}
      </div>
    </>
  );
};

export default observer(ErrorPlaceHolderES);
