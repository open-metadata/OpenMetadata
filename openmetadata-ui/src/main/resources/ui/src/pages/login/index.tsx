/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { isEmpty } from 'lodash';
import { observer } from 'mobx-react';
import React from 'react';
import { useHistory } from 'react-router-dom';
import appState from '../../AppState';
import PageContainer from '../../components/containers/PageContainer';
import { ROUTES } from '../../constants/constants';
import { AuthTypes } from '../../enums/signin.enum';
import SVGIcons, { Icons } from '../../utils/SvgUtils';

const SigninPage = () => {
  const history = useHistory();

  const handleSignIn = () => {
    appState.authProvider.signingIn = true;
  };

  const getSignInButton = (): JSX.Element => {
    let ssoBrandName = '';
    let ssoBrandLogo = '';
    switch (appState.authProvider.provider) {
      case AuthTypes.GOOGLE: {
        ssoBrandLogo = Icons.GOOGLE_ICON;
        ssoBrandName = 'Google';

        break;
      }
      case AuthTypes.OKTA: {
        ssoBrandLogo = Icons.OKTA_ICON;
        ssoBrandName = 'Okta';

        break;
      }
      case AuthTypes.AUTH0: {
        ssoBrandLogo = Icons.AUTH0_ICON;
        ssoBrandName = 'Auth0';

        break;
      }
      // TODO: Add "case AuthTypes.GITHUB" after adding support for Github SSO
      default: {
        break;
      }
    }

    return ssoBrandName ? (
      <button className="tw-signin-button">
        <SVGIcons alt={`${ssoBrandName} Logo`} icon={ssoBrandLogo} width="22" />
        <span className="tw-ml-3">Sign in with {ssoBrandName}</span>
      </button>
    ) : (
      <></>
    );
  };

  if (appState.authDisabled || !isEmpty(appState.userDetails)) {
    history.push(ROUTES.HOME);
  }

  return (
    <PageContainer>
      <div
        className="tw-w-screen tw-h-screen tw-flex tw-justify-center"
        data-testid="signin-page">
        <div className="tw-flex tw-flex-col tw-items-center signin-box">
          <div className="tw-flex tw-justify-center tw-items-center tw-mb-7 tw-mt-20">
            <SVGIcons
              alt="OpenMetadata Logo"
              icon={Icons.LOGO_SMALL}
              width="50"
            />
          </div>
          <div className="tw-mb-7">
            <h4 className="tw-font-semibold">
              Welcome to <span className="tw-text-primary">OpenMetadata</span>
            </h4>
          </div>
          <div className="tw-text-grey-muted tw-font-light tw-mb-7">
            <h6 className="tw-mb-px">Centralized Metadata Store, Discover,</h6>
            <h6 className="tw-mb-px">Collaborate and get your Data Right</h6>
          </div>
          <div className="tw-mt-4" onClick={handleSignIn}>
            {getSignInButton()}
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default observer(SigninPage);
