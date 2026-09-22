/*
 *  Copyright 2026 Collate.
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
  Badge,
  Button,
  Input,
  Popover,
  PopoverTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ChevronRight,
  PlusCircle,
} from '@openmetadata/ui-core-components/icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OnboardingStep } from '../../../generated/entity/governance/onboardingPlaybook';
import { DTYPE_LABEL_KEY } from '../../../utils/governance/onboarding/OnboardingField.utils';
import {
  CHECK_KIND_BADGE_COLOR,
  CHECK_KIND_LABEL_KEY,
} from './Playbook.constants';
import { PlaybookFieldOption } from './Playbook.types';

/** The synthetic entries name themselves with a translation key; real fields carry their own name. */
const optionLabel = (
  option: PlaybookFieldOption,
  translate: (key: string) => string
) => (option.isTitleKey ? translate(option.title) : option.title);

interface PlaybookAddCheckProps {
  options: PlaybookFieldOption[];
  capturedFieldPaths: Set<string>;
  onAdd: (step: OnboardingStep) => void;
  onNewCustomProperty: () => void;
}

/**
 * Pick what this gate asks for.
 *
 * <p>Fields already captured at another gate are not offered - a field is only ever asked for once
 * per playbook, which is what stops two gates disagreeing about who owns it.
 */
export const PlaybookAddCheck = ({
  options,
  capturedFieldPaths,
  onAdd,
  onNewCustomProperty,
}: PlaybookAddCheckProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const available = useMemo(() => {
    const search = query.trim().toLowerCase();

    return options
      .filter(
        (option) =>
          !option.fieldPath || !capturedFieldPaths.has(option.fieldPath)
      )
      .filter(
        (option) =>
          !search ||
          `${optionLabel(option, t)} ${option.fieldPath ?? ''} ${t(
            CHECK_KIND_LABEL_KEY[option.kind]
          )}`
            .toLowerCase()
            .includes(search)
      );
  }, [options, capturedFieldPaths, query, t]);

  return (
    <PopoverTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          setQuery('');
        }
      }}>
      <Button
        color="secondary"
        data-testid="add-check"
        iconLeading={PlusCircle}
        size="sm">
        {t('label.add-check')}
      </Button>
      <Popover
        aria-label={t('label.add-check')}
        className="tw:w-85"
        placement="bottom end">
        <div className="tw:border-b tw:border-secondary tw:p-2">
          <Input
            aria-label={t('message.search-fields-custom-properties-checks')}
            inputDataTestId="check-search"
            placeholder={t('message.search-fields-custom-properties-checks')}
            value={query}
            onChange={setQuery}
          />
        </div>

        <div className="tw:max-h-75 tw:overflow-y-auto tw:p-1.5">
          {available.length === 0 ? (
            <Typography
              className="tw:block tw:p-4 tw:text-sm tw:text-tertiary"
              data-testid="no-fields-left">
              {t('message.every-other-field-is-already-captured')}
            </Typography>
          ) : (
            <ul>
              {available.map((option) => (
                <li key={option.key}>
                  <button
                    className="tw:flex tw:w-full tw:items-center tw:gap-2.5 tw:rounded-lg tw:px-2.5 tw:py-2 tw:text-left tw:hover:bg-secondary"
                    data-testid={`add-field-${option.key}`}
                    type="button"
                    onClick={() => {
                      onAdd(option.toStep());
                      setIsOpen(false);
                      setQuery('');
                    }}>
                    <span className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-0.5">
                      <span className="tw:flex tw:items-center tw:gap-1.5">
                        <span className="tw:text-sm tw:font-medium tw:text-primary">
                          {optionLabel(option, t)}
                        </span>
                        <Badge
                          color={CHECK_KIND_BADGE_COLOR[option.kind]}
                          size="sm"
                          type="pill-color">
                          {t(CHECK_KIND_LABEL_KEY[option.kind])}
                        </Badge>
                      </span>
                      <span className="tw:flex tw:items-center tw:gap-1.5">
                        {option.fieldPath && (
                          <code className="tw:text-xs tw:text-tertiary">
                            {option.fieldPath}
                          </code>
                        )}
                        <span className="tw:text-xs tw:text-quaternary">
                          {t(DTYPE_LABEL_KEY[option.dtype])}
                        </span>
                      </span>
                    </span>
                    <ChevronRight
                      aria-hidden
                      className="tw:h-4 tw:w-4 tw:flex-none tw:text-quaternary"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="tw:flex tw:items-center tw:gap-2 tw:border-t tw:border-secondary tw:bg-secondary tw:px-3 tw:py-2.5">
          <Typography className="tw:flex-1 tw:text-xs tw:text-tertiary">
            {t('message.fields-captured-elsewhere-are-not-listed')}
          </Typography>
          <Button
            color="link-color"
            data-testid="new-custom-property"
            size="sm"
            onPress={() => {
              setIsOpen(false);
              onNewCustomProperty();
            }}>
            {t('label.new-entity', { entity: t('label.custom-property') })}
          </Button>
        </div>
      </Popover>
    </PopoverTrigger>
  );
};
