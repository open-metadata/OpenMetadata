/*
 *  Copyright 2023 Collate.
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
import {
  Box,
  Button,
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowRight, XClose } from '@openmetadata/ui-core-components/icons';
import { split } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import { useTheme } from '../../../context/UntitledUIThemeProvider/theme-provider';
import { ServiceCategory } from '../../../enums/service.enum';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useIsAiMode } from '../../../hooks/useAppMode';
import brandClassBase from '../../../utils/BrandData/BrandClassBase';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { Transi18next } from '../../../utils/i18next/LocalUtil';
import { useAddServiceAction } from '../../integration/ConnectionsPage/useAddServiceAction';
import {
  getWelcomeAccentStyle,
  isThemeDefaultPrimary,
  WELCOME_GLOW_DARK,
  WELCOME_GLOW_LIGHT,
} from './WelcomeScreen.constants';

interface WelcomeScreenProps {
  onClose: () => void;
}

const WelcomeScreen = ({ onClose }: WelcomeScreenProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { currentUser, applicationConfig } = useApplicationStore();
  // An admin-configured brand colour wins over the product accent; the store
  // fills an unset colour with the default, so "configured" means "changed".
  // The call is optional: a downstream build that swaps in its own brand
  // class may not define it, and then the theme colour applies.
  const hasCustomPrimary = !isThemeDefaultPrimary(
    applicationConfig?.customTheme?.primaryColor
  );
  const accent = hasCustomPrimary
    ? undefined
    : brandClassBase.getWelcomeAccentColor?.();
  // AI mode's Connections opens on every connector; classic keeps its
  // database-services entry point. The hook also owns the create-permission
  // check, so the button is absent for users who could not save a service.
  const { addService, canAddService } = useAddServiceAction(
    useIsAiMode() ? 'all' : ServiceCategory.DATABASE_SERVICES
  );
  const greeting = t('label.welcome', {
    name: split(getEntityName(currentUser), ' ')[0] || t('label.user'),
  });

  // Close before leaving: the AI-mode home is kept alive, so without this the
  // welcome screen would still be there when the user comes back.
  const handleConnect = () => {
    onClose();
    addService();
  };

  const handleTour = () => {
    onClose();
    navigate(ROUTES.TOUR);
  };

  return (
    <div
      className="tw:relative tw:h-full tw:overflow-hidden tw:rounded-2xl tw:bg-primary tw:dark:bg-canvas"
      data-testid="welcome-screen"
      style={getWelcomeAccentStyle(accent)}>
      <div
        aria-hidden
        className="tw:pointer-events-none tw:absolute tw:inset-x-0 tw:bottom-0 tw:h-2/3"
        style={{
          backgroundImage:
            theme === 'dark' ? WELCOME_GLOW_DARK : WELCOME_GLOW_LIGHT,
        }}
      />
      <ButtonUtility
        className="tw:absolute tw:top-4 tw:right-4 tw:z-10"
        color="tertiary"
        data-testid="welcome-screen-close-btn"
        icon={XClose}
        tooltip={t('label.close')}
        onClick={onClose}
      />
      <Box
        align="center"
        className="tw:relative tw:h-full tw:gap-15 tw:overflow-y-auto tw:px-6 tw:py-12 tw:text-center"
        direction="col"
        justify="center">
        <img
          alt={greeting}
          className="tw:w-full tw:max-w-142.5"
          data-testid="welcome-screen-img"
          src={brandClassBase.getWelcomeScreenImg(theme)}
        />
        <Box align="center" direction="col" gap={10}>
          <Box align="center" direction="col" gap={3}>
            <div className="tw:text-primary">
              <p className="tw:m-0 tw:text-display-xs tw:leading-12.5 tw:font-medium">{`${greeting} 👋`}</p>
              <h1 className="tw:m-0 tw:mt-5 tw:text-display-sm tw:font-normal tw:text-primary">
                <Transi18next
                  i18nKey="message.your-platform-is-ready"
                  renderElement={<span />}
                  values={{ platform: brandClassBase.getPlatformName() }}
                />
              </h1>
            </div>
            <Typography as="p" className="tw:text-tertiary" size="text-md">
              {t('message.welcome-screen-message')}
            </Typography>
          </Box>
          <Box
            align="center"
            className="tw:flex-wrap"
            direction="row"
            gap={5}
            justify="center">
            {canAddService && (
              <Button
                className="tw:h-14 tw:px-7.5 tw:text-lg"
                color="primary"
                data-testid="welcome-screen-connect-btn"
                iconTrailing={ArrowRight}
                size="xl"
                onPress={handleConnect}>
                {t('label.connect-a-data-source')}
              </Button>
            )}
            <Button
              className="tw:h-14 tw:px-7.5 tw:text-lg"
              color="secondary"
              data-testid="welcome-screen-tour-btn"
              size="xl"
              onPress={handleTour}>
              {t('message.take-quick-product-tour')}
            </Button>
          </Box>
        </Box>
      </Box>
    </div>
  );
};

export default WelcomeScreen;
