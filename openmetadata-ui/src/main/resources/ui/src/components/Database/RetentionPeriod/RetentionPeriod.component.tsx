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
  Alert,
  Button,
  Dialog,
  Input,
  Modal,
  ModalOverlay,
  Tooltip,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { Duration } from 'luxon';
import { FormEvent, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { showErrorToast } from '../../../utils/ToastUtils';
import './retention-period.less';
import { RetentionPeriodProps } from './RetentionPeriod.interface';
// Pluralize a duration component, e.g. pluralizeDurationUnit(2, 'year') => '2 years'
const pluralizeDurationUnit = (value: number, unit: string): string => {
  const pluralSuffix = value > 1 ? 's' : '';

  return value ? `${value} ${unit}${pluralSuffix}` : '';
};

const ISO_DURATION_REGEX =
  /^P(?!$)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(\d+H)?(\d+M)?(\d+S)?)?$/;

// Helper function to detect and format ISO 8601 duration
const formatRetentionPeriod = (retentionPeriod: string | undefined) => {
  if (!retentionPeriod) {
    return NO_DATA_PLACEHOLDER;
  }

  // If it's not ISO, return the plain string
  if (!ISO_DURATION_REGEX.test(retentionPeriod)) {
    return retentionPeriod;
  }

  const duration = Duration.fromISO(retentionPeriod);

  const formattedDuration = [
    pluralizeDurationUnit(duration.years, 'year'),
    pluralizeDurationUnit(duration.months, 'month'),
    pluralizeDurationUnit(duration.weeks, 'week'),
    pluralizeDurationUnit(duration.days, 'day'),
    pluralizeDurationUnit(duration.hours, 'hour'),
    pluralizeDurationUnit(duration.minutes, 'minute'),
    pluralizeDurationUnit(duration.seconds, 'second'),
  ]
    .filter(Boolean)
    .join(' ');

  return formattedDuration || NO_DATA_PLACEHOLDER;
};
const RetentionPeriod = ({
  retentionPeriod,
  onUpdate,
  hasPermission,
}: RetentionPeriodProps) => {
  const { t } = useTranslation();
  const [value, setValue] = useState(retentionPeriod);
  const [isLoading, setIsLoading] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  const onCancel = useCallback(() => setIsEdit(false), []);

  const onEdit = () => {
    setValue(retentionPeriod);
    setIsEdit(true);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // ponytail: an untouched empty field submits undefined, exactly as the
      // antd form did; drop the cast once DataAssetsHeader's
      // onUpdateRetentionPeriod accepts `value?: string` (the Table handler does).
      await onUpdate(value as string);
      onCancel();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const editTitle = t('label.edit-entity', {
    entity: t('label.retention-period'),
  });

  return (
    <div className="d-flex items-start gap-1">
      <div
        className="d-flex retention-period-container align-start"
        data-testid="retention-period-container">
        <div className="text-sm d-flex flex-col gap-2 tw:text-primary">
          <div className="d-flex items-center gap-1">
            <span className="extra-info-label-heading tw:text-secondary">
              {t('label.retention-period')}
            </span>
            {hasPermission && (
              <Tooltip title={editTitle}>
                <Button
                  aria-label={editTitle}
                  className="tw:size-5 tw:rounded-sm tw:p-0 tw:text-quaternary tw:shadow-none tw:after:outline-secondary tw:data-icon-only:p-0"
                  color="secondary"
                  data-testid="edit-retention-period-button"
                  iconLeading={<EditIcon aria-hidden width="12px" />}
                  onPress={onEdit}
                />
              </Tooltip>
            )}
          </div>

          <span className="font-medium extra-info-value">
            {formatRetentionPeriod(retentionPeriod)}
          </span>
        </div>
      </div>

      <ModalOverlay
        isKeyboardDismissDisabled={isLoading}
        isOpen={isEdit}
        onOpenChange={(open) => !open && onCancel()}>
        <Modal>
          {/* Overrides reproduce the antd Modal (modal.less) this replaced. */}
          <Dialog
            data-testid="retention-period-modal"
            panelClassName="tw:rounded-lg tw:shadow-[2px_4px_12px_var(--om-legacy-color-0-0-0-0-2)] tw:dark:shadow-overlay"
            width={520}>
            <Dialog.Header
              className={classNames(
                'tw:border-b tw:border-[var(--om-legacy-color-dde3ea)] tw:px-6 tw:py-4',
                'tw:sm:px-6 tw:sm:pt-4 tw:*:font-medium! tw:*:leading-[22px]!',
                'tw:*:text-black/85! tw:dark:border-subtle tw:dark:*:text-primary!'
              )}
              title={editTitle}
            />
            <form
              data-testid="retention-period-form"
              id="retention-period-form"
              onSubmit={handleSubmit}>
              <Dialog.Content className="tw:gap-3 tw:px-6 tw:pt-6 tw:pb-12 tw:sm:px-6">
                <Alert
                  className={classNames(
                    'tw:rounded-xs tw:border-[var(--ant-info-color-deprecated-border)]',
                    'tw:bg-[var(--ant-info-color-deprecated-bg)] tw:p-[15px]',
                    'tw:dark:border-utility-blue-300 tw:dark:bg-utility-blue-50'
                  )}
                  showIcon={false}
                  variant="brand">
                  <span className="tw:leading-[22px] tw:text-primary">
                    {t('message.retention-period-description')}
                  </span>
                </Alert>
                <Input
                  inputDataTestId="retention-period-input"
                  label={t('label.retention-period')}
                  value={value ?? ''}
                  onChange={setValue}
                />
              </Dialog.Content>
              <Dialog.Footer className="tw:mt-0 tw:border-[var(--om-legacy-color-dde3ea)] tw:sm:mt-0 tw:dark:border-subtle tw:*:gap-[13px]! tw:*:px-[23px]! tw:*:py-4!">
                <Button
                  className="tw:h-10 tw:rounded-lg tw:px-[15px] tw:py-0 tw:font-normal tw:text-[var(--ant-primary-color)] tw:hover:bg-transparent tw:hover:text-[var(--ant-primary-color-hover)]"
                  color="tertiary"
                  data-testid="cancel-button"
                  onPress={onCancel}>
                  {t('label.cancel')}
                </Button>
                <Button
                  className="tw:h-10 tw:rounded-lg tw:px-[15px] tw:py-0 tw:font-normal"
                  color="primary"
                  data-testid="save-button"
                  isLoading={isLoading}
                  type="submit">
                  {t('label.save')}
                </Button>
              </Dialog.Footer>
            </form>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </div>
  );
};

export default RetentionPeriod;
