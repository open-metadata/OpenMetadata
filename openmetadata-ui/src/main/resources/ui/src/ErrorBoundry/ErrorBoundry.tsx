import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useHistory } from 'react-router-dom';
import { ROUTES } from '../constants/constants';
import ErrorFallback from './ErrorFallback';

interface Props {
  children: React.ReactNode;
}

const ErrorBoundry: React.FC<Props> = ({ children }) => {
  const history = useHistory();

  const onErrorReset = () => {
    history.push(ROUTES.HOME);
  };

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={onErrorReset}>
      {children}
    </ErrorBoundary>
  );
};

export default ErrorBoundry;
