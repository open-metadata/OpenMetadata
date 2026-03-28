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
import type { ReactNode } from 'react';
import { useContext } from 'react';
import { ChevronDown } from '@untitledui/icons';
import type {
  ButtonProps as AriaButtonProps,
  DisclosureGroupProps as AriaDisclosureGroupProps,
  DisclosurePanelProps as AriaDisclosurePanelProps,
  DisclosureProps as AriaDisclosureProps,
} from 'react-aria-components';
import {
  Button as AriaButton,
  Disclosure as AriaDisclosure,
  DisclosureGroup as AriaDisclosureGroup,
  DisclosurePanel as AriaDisclosurePanel,
  DisclosureStateContext,
  Heading as AriaHeading,
} from 'react-aria-components';
import { cx } from '@/utils/cx';

export interface AccordionProps extends AriaDisclosureGroupProps {
  /**
   * Optional className for the accordion container.
   */
  className?: string;
}

export type AccordionItemProps = AriaDisclosureProps;

export interface AccordionHeaderProps extends AriaButtonProps {
  /**
   * The content to display in the accordion header trigger.
   */
  children: ReactNode;
}

export interface AccordionPanelProps extends AriaDisclosurePanelProps {
  /**
   * The content to display when the accordion item is expanded.
   */
  children: ReactNode;
  /**
   * Optional className for the panel content container.
   */
  className?: string;
}

/**
 * Accordion is a grouped set of expandable/collapsible sections, built on
 * react-aria DisclosureGroup for full accessibility support.
 *
 * @example
 * <Accordion>
 *   <AccordionItem id="item-1">
 *     <AccordionHeader>Section 1</AccordionHeader>
 *     <AccordionPanel>Content for section 1</AccordionPanel>
 *   </AccordionItem>
 *   <AccordionItem id="item-2">
 *     <AccordionHeader>Section 2</AccordionHeader>
 *     <AccordionPanel>Content for section 2</AccordionPanel>
 *   </AccordionItem>
 * </Accordion>
 */
export const Accordion = ({
  children,
  className,
  ...props
}: AccordionProps) => {
  return (
    <AriaDisclosureGroup
      {...props}
      className={cx(
        'tw:w-full tw:divide-y tw:divide-border-secondary tw:rounded-xl tw:ring-1 tw:ring-border-secondary tw:overflow-hidden',
        className
      )}>
      {children}
    </AriaDisclosureGroup>
  );
};

/**
 * AccordionItem represents a single collapsible section within an Accordion.
 * Must receive a unique `id` prop for the DisclosureGroup to track expanded state.
 */
export const AccordionItem = ({
  children,
  className,
  ...props
}: AccordionItemProps) => {
  return (
    <AriaDisclosure
      {...props}
      className={(state) =>
        cx(
          'tw:group/item tw:w-full tw:bg-primary',
          state.isDisabled && 'tw:cursor-not-allowed tw:opacity-50',
          typeof className === 'function' ? className(state) : className
        )
      }>
      {children}
    </AriaDisclosure>
  );
};

/**
 * AccordionHeader renders the clickable trigger button for an AccordionItem.
 * It displays the header text and an animated chevron icon.
 */
export const AccordionHeader = ({
  children,
  className,
  ...props
}: AccordionHeaderProps) => {
  return (
    <AriaHeading className="tw:m-0">
      <AriaButton
        slot="trigger"
        {...props}
        className={(state) =>
          cx(
            'tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:justify-between tw:gap-3 tw:px-6 tw:py-4 tw:text-left tw:outline-hidden tw:transition tw:duration-200 tw:ease-in-out',
            'tw:text-sm tw:font-semibold tw:text-primary',
            'hover:tw:bg-primary_hover',
            state.isFocusVisible && 'tw:ring-2 tw:ring-inset tw:ring-brand-300',
            state.isDisabled && 'tw:cursor-not-allowed tw:text-disabled',
            typeof className === 'function' ? className(state) : className
          )
        }>
        <span className="tw:grow">{children}</span>
        <ChevronDown
          aria-hidden="true"
          className="tw:size-5 tw:shrink-0 tw:text-fg-quaternary tw:transition-transform tw:duration-200 tw:ease-in-out tw:group-data-expanded/item:rotate-180"
        />
      </AriaButton>
    </AriaHeading>
  );
};

/**
 * AccordionPanel is the collapsible content area of an AccordionItem.
 */
export const AccordionPanel = ({
  children,
  className,
  ...props
}: AccordionPanelProps) => {
  const state = useContext(DisclosureStateContext);

  return (
    <AriaDisclosurePanel
      {...props}
      className={cx(
        'tw:overflow-hidden tw:border-t tw:border-border-secondary tw:px-6 tw:py-4 tw:text-sm tw:text-secondary',
        !state?.isExpanded && 'tw:hidden',
        className
      )}>
      {children}
    </AriaDisclosurePanel>
  );
};
