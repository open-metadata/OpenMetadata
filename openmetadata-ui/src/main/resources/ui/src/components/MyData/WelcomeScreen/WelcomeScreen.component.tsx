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
import brandClassBase from '../../../utils/BrandData/BrandClassBase';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { Transi18next } from '../../../utils/i18next/LocalUtil';
import { getAddServicePath } from '../../../utils/RouterUtils';

// Figma 15448:9083 — a radial glow rising into the brand colour along the
// bottom 65% of the panel; dark mode keeps it faint.
const brandMix = (percent: number) =>
  `color-mix(in srgb, var(--tw-color-brand-500) ${percent}%, transparent)`;
const GLOW_SHAPE = 'ellipse 168% 168% at 56% -31%';
const GLOW_LIGHT = `radial-gradient(${GLOW_SHAPE}, transparent 55%, ${brandMix(
  50
)} 77.5%, ${brandMix(75)} 88.75%, var(--tw-color-brand-500))`;
const GLOW_DARK = `radial-gradient(${GLOW_SHAPE}, transparent 47%, ${brandMix(
  8
)} 60%, ${brandMix(20)} 73%, ${brandMix(20)})`;

interface WelcomeScreenProps {
  onClose: () => void;
}

const WelcomeScreen = ({ onClose }: WelcomeScreenProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { currentUser } = useApplicationStore();
  const greeting = t('label.welcome', {
    name: split(getEntityName(currentUser), ' ')[0] || t('label.user'),
  });

  return (
    <div
      className="tw:relative tw:h-full tw:overflow-hidden tw:rounded-2xl tw:bg-primary tw:dark:bg-canvas"
      data-testid="welcome-screen">
      <div
        aria-hidden
        className="tw:pointer-events-none tw:absolute tw:inset-x-0 tw:bottom-0 tw:h-[65%]"
        style={{ backgroundImage: theme === 'dark' ? GLOW_DARK : GLOW_LIGHT }}
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
        className="tw:relative tw:h-full tw:gap-22.5 tw:overflow-y-auto tw:px-6 tw:py-12 tw:text-center"
        direction="col"
        justify="center">
        <img
          alt={greeting}
          className="tw:w-full tw:max-w-[518px]"
          data-testid="welcome-screen-img"
          src={brandClassBase.getWelcomeScreenImg(theme)}
        />
        <Box align="center" direction="col" gap={12}>
          <Box align="center" direction="col" gap={6}>
            <div className="tw:text-[40px] tw:leading-12 tw:text-primary">
              <p className="tw:m-0">{`${greeting} 👋`}</p>
              <h1 className="tw:m-0 tw:mt-2.5 tw:text-[40px] tw:leading-12 tw:font-bold tw:text-primary">
                <Transi18next
                  i18nKey="message.your-platform-is-ready"
                  renderElement={
                    <span className="tw:text-utility-brand-600 tw:dark:text-brand-600" />
                  }
                  values={{ platform: brandClassBase.getPlatformName() }}
                />
              </h1>
            </div>
            <Typography as="p" className="tw:text-tertiary" size="text-xl">
              {t('message.welcome-screen-message')}
            </Typography>
          </Box>
          <Box align="center" direction="row" gap={5}>
            <Button
              className="tw:h-14 tw:px-7.5 tw:text-[17px]"
              color="primary"
              data-testid="welcome-screen-connect-btn"
              iconTrailing={ArrowRight}
              size="xl"
              onPress={() =>
                navigate(getAddServicePath(ServiceCategory.DATABASE_SERVICES))
              }>
              {t('label.connect-a-data-source')}
            </Button>
            <Button
              className="tw:h-14 tw:px-7.5 tw:text-[17px]"
              color="secondary"
              data-testid="welcome-screen-tour-btn"
              size="xl"
              onPress={() => navigate(ROUTES.TOUR)}>
              {t('message.take-quick-product-tour')}
            </Button>
          </Box>
        </Box>
      </Box>
    </div>
  );
};

export default WelcomeScreen;
