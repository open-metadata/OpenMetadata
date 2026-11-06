/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthProvider } from '../../components/Auth/AuthProviders/AuthProvider';
import DocumentTitle from '../../components/common/DocumentTitle/DocumentTitle';
import Loader from '../../components/common/Loader/Loader';

export const LogoutPage = () => {
  const { t } = useTranslation();
  const { onLogoutHandler } = useAuthProvider();

  useEffect(() => {
    onLogoutHandler();
  }, []);

  // Logging out is not instant, so without this the tab would keep the title
  // of the page the user logged out from.
  return (
    <>
      <DocumentTitle title={t('label.logout')} />
      <Loader fullScreen />
    </>
  );
};
