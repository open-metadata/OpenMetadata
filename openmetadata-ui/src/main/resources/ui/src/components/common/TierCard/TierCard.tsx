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

import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Button,
  Popover,
  PopoverTrigger,
  RadioButton,
  RadioGroup,
} from '@openmetadata/ui-core-components';
import { ChevronRight } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { useEffect, useRef, useState } from 'react';
import { Heading } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { Tag } from '../../../generated/entity/classification/tag';
import { getTags } from '../../../rest/tagAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../Loader/Loader';
import RichTextEditorPreviewerV1 from '../RichTextEditor/RichTextEditorPreviewerV1';
import './tier-card.style.less';
import { CardWithListItems, TierCardProps } from './TierCard.interface';

// Icon-only buttons keep the legacy 46x40 footprint with a 14px glyph.
const FOOTER_BUTTON_CLASS =
  'tw:data-icon-only:px-4 tw:data-icon-only:py-3.25 tw:rounded-lg';

// Gap the antd bottomRight popover left below its trigger: @popover-distance
// (8px*sqrt(2) arrow + 4px) padding plus its 4px align offset.
const POPOVER_OFFSET = 8 * Math.SQRT2 + 8;

const TierCard = ({
  tierCardClassName,
  currentTier,
  updateTier,
  children,
  open,
  onOpenChange,
  onClose,
  footerActionButtonsClassName,
}: TierCardProps) => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [tiers, setTiers] = useState<Array<Tag>>([]);
  const [tierCardData, setTierCardData] = useState<Array<CardWithListItems>>(
    []
  );
  const [selectedTier, setSelectedTier] = useState<string>(currentTier ?? '');
  const [isLoadingTierData, setIsLoadingTierData] = useState<boolean>(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = open ?? internalOpen;
  const { t } = useTranslation();

  const getTierData = async () => {
    setIsLoadingTierData(true);
    try {
      const { data } = await getTags({
        parent: 'Tier',
        limit: 50,
        disabled: false,
      });

      if (data) {
        const tierData: CardWithListItems[] =
          data.map((tier) => ({
            id: `Tier${FQN_SEPARATOR_CHAR}${tier.name}`,
            title: getEntityName(tier),
            description: tier.description.substring(
              0,
              tier.description.indexOf('\n\n')
            ),
            data: tier.description.substring(
              tier.description.indexOf('\n\n') + 1
            ),
            style: tier.style,
          })) ?? [];
        setTierCardData(tierData);
        setTiers(data);
      } else {
        setTierCardData([]);
      }
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.tier-plural-lowercase'),
        })
      );
    } finally {
      setIsLoadingTierData(false);
    }
  };

  const handleOpenChange = (visible: boolean) => {
    setInternalOpen(visible);

    if (!visible) {
      setSelectedTier(currentTier ?? '');
    }

    onOpenChange?.(visible);
  };

  const updateTierData = async (value?: string) => {
    setIsLoadingTierData(true);
    const tier = tiers.find((tier) => tier.fullyQualifiedName === value);
    await updateTier?.(tier);
    setIsLoadingTierData(false);
    handleOpenChange(false);
  };

  const handleCloseTier = () => {
    handleOpenChange(false);
    onClose?.();
  };

  useEffect(() => {
    if (isOpen && tierCardData.length === 0) {
      getTierData();
    }
  }, [isOpen]);

  // Re-syncs selectedTier when the persisted tier changes after a successful save.
  useEffect(() => {
    if (!isOpen) {
      setSelectedTier(currentTier ?? '');
    }
  }, [currentTier, isOpen]);

  const popover = (
    <Popover
      // Light keeps the antd look: no shadow, the card's own border is the edge.
      className="tw:shadow-none tw:outline-0"
      offset={POPOVER_OFFSET}
      placement="bottom end"
      {...(isControlled && {
        isOpen,
        onOpenChange: handleOpenChange,
        triggerRef: anchorRef,
        // Presses on the anchor belong to the caller's own trigger.
        shouldCloseOnInteractOutside: (element: Element) =>
          !anchorRef.current?.contains(element),
      })}>
      <div
        className={classNames(
          'tw:w-163.75 tw:rounded-xl tw:border tw:border-secondary tw:bg-overlay-surface',
          tierCardClassName
        )}
        data-testid="cards">
        <div className="tw:flex tw:items-center tw:justify-between tw:border-b tw:border-secondary tw:px-8 tw:py-6">
          {/* `!` beats antd's unlayered h1-h6 margin/color reset. */}
          <Heading
            className="tw:m-0! tw:text-md tw:font-medium tw:text-primary!"
            slot="title">
            {t('label.edit-entity', { entity: t('label.tier') })}
          </Heading>
          <Button
            className="tw:text-md tw:font-normal tw:text-link"
            color="link-color"
            data-testid="clear-tier"
            // undefined clears the tier
            onPress={() => updateTierData()}>
            {t('label.clear')}
          </Button>
        </div>
        <div
          aria-busy={isLoadingTierData}
          className="tier-card-body tw:relative tw:p-5">
          <div
            className={classNames(
              isLoadingTierData &&
                'tw:pointer-events-none tw:select-none tw:opacity-50'
            )}>
            <RadioGroup
              aria-label={t('label.tier')}
              value={selectedTier || null}
              onChange={setSelectedTier}>
              <Accordion
                className="tw:max-h-115 tw:divide-y-0 tw:overflow-auto tw:rounded-none tw:outline-0"
                defaultExpandedKeys={selectedTier ? [selectedTier] : []}>
                {tierCardData.map((card) => (
                  <AccordionItem
                    className="tw:relative tw:border-b tw:border-primary tw:bg-transparent"
                    data-testid="card-list"
                    id={card.id}
                    key={card.id}>
                    <AccordionHeader
                      aria-label={t('label.expand')}
                      className="tw:absolute tw:top-3.5 tw:right-4 tw:w-auto tw:p-0"
                      showChevron={false}>
                      <ChevronRight
                        className="tw:text-fg-primary tw:transition-transform tw:duration-200 tw:group-data-expanded/item:rotate-90"
                        size={12}
                      />
                    </AccordionHeader>
                    <div className="tw:py-3 tw:pr-14 tw:pl-4">
                      <RadioButton
                        data-testid={`radio-btn-${card.title}`}
                        hint={
                          <span className="tw:block tw:text-xs tw:text-quaternary">
                            {card.description.replace(/\*/g, '')}
                          </span>
                        }
                        // Brand ring when unselected, as the antd radio had; transparent so
                        // it sits on the popover surface in dark.
                        indicatorClassName={
                          selectedTier === card.id
                            ? undefined
                            : 'tw:bg-transparent tw:after:outline-brand-solid'
                        }
                        label={
                          <span
                            className="tw:block tw:leading-5.5 tw:font-normal tw:text-primary"
                            style={{ color: card.style?.color }}>
                            {card.title}
                          </span>
                        }
                        value={card.id}
                      />
                    </div>
                    <AccordionPanel className="tw:border-t-0 tw:px-3 tw:py-0 tw:text-primary">
                      <div className="tw:ml-4">
                        <RichTextEditorPreviewerV1
                          className="tier-card-description"
                          enableSeeMoreVariant={false}
                          markdown={card.data}
                        />
                      </div>
                    </AccordionPanel>
                  </AccordionItem>
                ))}
              </Accordion>
            </RadioGroup>
            <div
              className={classNames(
                'tw:mt-5.5 tw:flex tw:justify-end tw:gap-2',
                footerActionButtonsClassName
              )}>
              <Button
                className={FOOTER_BUTTON_CLASS}
                color="secondary"
                data-testid="close-tier-card"
                iconLeading={<CloseOutlined />}
                onPress={handleCloseTier}
              />
              <Button
                className={FOOTER_BUTTON_CLASS}
                color="primary"
                data-testid="update-tier-card"
                iconLeading={<CheckOutlined />}
                onPress={() => updateTierData(selectedTier)}
              />
            </div>
          </div>
          {isLoadingTierData && (
            <div className="tw:absolute tw:inset-0 tw:flex tw:items-center tw:justify-center">
              <Loader size="small" />
            </div>
          )}
        </div>
      </div>
    </Popover>
  );

  if (!isControlled) {
    return (
      <PopoverTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
        {children}
        {popover}
      </PopoverTrigger>
    );
  }

  return (
    <>
      <div ref={anchorRef}>{children}</div>
      {popover}
    </>
  );
};

export default TierCard;
