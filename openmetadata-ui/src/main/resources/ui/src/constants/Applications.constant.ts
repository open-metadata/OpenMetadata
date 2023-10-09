import { StepperStepType } from 'Models';
import { t } from 'i18next';

export const STEPS_FOR_APP_INSTALL: Array<StepperStepType> = [
  {
    name: t('label.configure-entity', {
      entity: t('label.test-case-lowercase'),
    }),
    step: 1,
  },
  { name: t('label.configure'), step: 2 },
  { name: t('label.success'), step: 3 },
];
