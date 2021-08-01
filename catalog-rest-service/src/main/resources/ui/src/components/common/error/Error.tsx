import React from 'react';

const Error = ({ error }: { error: string }) => {
  return (
    <div className="tw-flex tw-justify-center tw-items-center tw-mt-5">
      <h2>{error}</h2>
    </div>
  );
};

export default Error;
