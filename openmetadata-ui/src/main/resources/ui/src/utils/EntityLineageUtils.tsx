import React from 'react';
import { Link } from 'react-router-dom';
import { getEntityLink } from './TableUtils';

export const getHeaderLabel = (
  v = '',
  type: string,
  isMainNode: boolean,
  separator = '.'
) => {
  const length = v.split(separator).length;

  return (
    <>
      {isMainNode ? (
        <span
          className="tw-break-words description-text tw-self-center tw-font-medium"
          data-testid="lineage-entity">
          {v.split(separator)[length - 1]}
        </span>
      ) : (
        <span
          className="tw-break-words description-text tw-self-center link-text tw-font-medium"
          data-testid="lineage-entity">
          <Link to={getEntityLink(type, v)}>
            {v.split(separator)[length - 1]}
          </Link>
        </span>
      )}
    </>
  );
};
