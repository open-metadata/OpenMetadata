import { isEmpty } from 'lodash';
import { observer } from 'mobx-react';
import React from 'react';
import { useHistory } from 'react-router-dom';
import appState from '../../AppState';
import PageContainer from '../../components/containers/PageContainer';
import { ROUTES } from '../../constants/constants';
import { AuthTypes } from '../../enums/signin.enum';

const SigninPage = () => {
  const history = useHistory();

  const handleSignIn = () => {
    appState.authProvider.signingIn = true;
  };

  if (appState.authDisabled || !isEmpty(appState.userDetails)) {
    history.push(ROUTES.HOME);
  }

  return (
    <PageContainer>
      <div className="tw-w-screen tw-h-screen tw-flex  tw-justify-center">
        <div className="tw-flex tw-flex-col tw-mt-52">
          <div>
            <h3>Sign in to OpenMetadata</h3>
          </div>
          <div className="tw-flex tw-flex-col tw-mt-4" onClick={handleSignIn}>
            {appState.authProvider.provider === AuthTypes.GOOGLE && (
              <button className="tw-signin-button tw-bg-red-700 hover:tw-bg-red-600">
                Sign in with Google
              </button>
            )}
            {appState.authProvider.provider === AuthTypes.OKTA && (
              <button className="tw-signin-button tw-bg-blue-700 hover:tw-bg-blue-600">
                Sign in with Okta
              </button>
            )}
            {appState.authProvider.provider === AuthTypes.GITHUB && (
              <button className="tw-signin-button tw-bg-gray-800 hover:tw-bg-gray-700">
                Sign in with Github
              </button>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default observer(SigninPage);
