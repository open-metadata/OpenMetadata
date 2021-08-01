import React, { FunctionComponent } from 'react';
import AuthenticatedAppRouter from './AuthenticatedAppRouter';
import AuthProvider from '../auth-provider/AuthProvider';

const AppRouter: FunctionComponent = () => {
  return (
    <AuthProvider childComponentType={AuthenticatedAppRouter}>
      <AuthenticatedAppRouter />
    </AuthProvider>
  );
};

export default AppRouter;
