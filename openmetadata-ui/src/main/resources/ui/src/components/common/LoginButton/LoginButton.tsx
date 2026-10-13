/*
 *  Copyright 2022 Collate.
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

import { Button } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';

interface LoginButtonProps {
  ssoBrandName: string;
  ssoBrandLogo?: string;
  onClick?: () => void;
}

const LoginButton = ({
  ssoBrandName,
  ssoBrandLogo,
  onClick,
}: LoginButtonProps) => {
  const { t } = useTranslation();

  return (
    <Button
      className="tw:w-full tw:justify-center"
      color="secondary"
      data-testid="sso-login-button"
      size="lg"
      onPress={onClick}>
      {ssoBrandLogo && (
        <img
          aria-hidden
          alt={`${ssoBrandName} Logo`}
          className="tw:mr-2 tw:h-6 tw:w-6"
          src={ssoBrandLogo}
        />
      )}
      <span className="tw:text-md tw:font-medium">
        {t('label.sign-in-with-sso', { sso: ssoBrandName })}
      </span>
    </Button>
  );
};

export default LoginButton;
