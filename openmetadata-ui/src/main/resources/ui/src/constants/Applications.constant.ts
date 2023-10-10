import { StepperStepType } from 'Models';
import { t } from 'i18next';

export const STEPS_FOR_APP_INSTALL: Array<StepperStepType> = [
  {
    name: t('label.detail-plural'),
    step: 1,
  },
  { name: t('label.configure'), step: 2 },
  { name: t('label.schedule'), step: 3 },
];
