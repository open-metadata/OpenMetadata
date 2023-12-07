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
import { ReactRenderer } from '@tiptap/react';
import { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { isEmpty } from 'lodash';
import tippy, { Instance, Props } from 'tippy.js';
import { SlashCommandList, SlashCommandRef } from './SlashCommandList';

const renderItems = () => {
  let component: ReactRenderer;
  let popup: Instance<Props>[] = [];
  let suggestionProps: SuggestionProps;
  let hasPopup = !isEmpty(popup);

  return {
    onStart: (props: SuggestionProps) => {
      suggestionProps = props;
      component = new ReactRenderer(SlashCommandList, {
        props,
        editor: props.editor,
      });

      if (
        !props.clientRect ||
        props.editor.isActive('table') ||
        props.editor.isActive('callout')
      ) {
        return;
      }

      popup = tippy('body', {
        getReferenceClientRect:
          props.clientRect as Props['getReferenceClientRect'],
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
      });
      hasPopup = !isEmpty(popup);
    },
    onUpdate: (props: SuggestionProps) => {
      suggestionProps = props;
      component.updateProps(props);

      if (!props.clientRect) {
        return;
      }
      if (hasPopup) {
        popup[0].setProps({
          getReferenceClientRect:
            props.clientRect as Props['getReferenceClientRect'],
        });
      }
    },
    onKeyDown(props: SuggestionKeyDownProps) {
      if (
        props.event.key === 'Escape' &&
        hasPopup &&
        !popup[0].state.isDestroyed
      ) {
        popup[0].hide();

        return true;
      }

      if (props.event.key === 'Enter') {
        if (
          suggestionProps.items.filter((item) =>
            item.title
              .toLowerCase()
              .startsWith(suggestionProps.query.toLowerCase())
          ).length === 0
        ) {
          this.onExit();
        }
      }

      return (component?.ref as SlashCommandRef)?.onKeyDown(props) || false;
    },
    onExit() {
      if (hasPopup && !popup[0].state.isDestroyed) {
        popup[0].destroy();
      }
    },
  };
};

export default renderItems;
