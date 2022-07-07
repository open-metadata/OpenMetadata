import React, { Suspense } from 'react';
import Loader from '../components/Loader/Loader';

export default function withSuspenseFallback(Component) {
  return function DefaultFallback(props) {
    return (
      <Suspense fallback={<Loader />}>
        <Component {...props} />
      </Suspense>
    );
  };
}
