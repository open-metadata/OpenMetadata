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
import { WILD_CARD_CHAR } from '../../../../constants/char.constants';
import {
  EntityUrlMapType,
  ENTITY_URL_MAP,
} from '../../../../constants/Feeds.constants';
import { getSearchedUsers, getUserSuggestions } from '../../../../rest/miscAPI';
import { buildMentionLink } from '../../../../utils/FeedUtils';
import { ExtensionRef } from '../BlockEditor.interface';
import MentionList from './MentionList';

export const mentionSuggestion = () => ({
  items: async ({ query }: { query: string }) => {
    if (!query) {
      const data = await getSearchedUsers(WILD_CARD_CHAR, 1, 5);
      const hits = data.data.hits.hits;

      return hits.map((hit) => ({
        id: hit._id,
        name: hit._source.name,
        label: hit._source.displayName,
        fqn: hit._source.fullyQualifiedName,
        href: buildMentionLink(
          ENTITY_URL_MAP[hit._source.entityType as EntityUrlMapType],
          hit._source.name
        ),
        type: hit._source.entityType,
      }));
    } else {
      const data = await getUserSuggestions(query);
      const hits = data.data.suggest['metadata-suggest'][0]['options'];

      return hits.map((hit) => ({
        id: hit._id,
        name: hit._source.name,
        label: hit._source.displayName,
        fqn: hit._source.fullyQualifiedName,
        href: buildMentionLink(
          ENTITY_URL_MAP[hit._source.entityType as EntityUrlMapType],
          hit._source.name
        ),
        type: hit._source.entityType,
      }));
    }
  },

  render: () => {
    let component: ReactRenderer;
    let popup: Instance<Props>[] = [];
    const hasPopup = !isEmpty(popup);

    return {
      onStart: (props: SuggestionProps) => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
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
      },

      onUpdate(props: SuggestionProps) {
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

        return (component?.ref as ExtensionRef)?.onKeyDown(props);
      },

      onExit() {
        if (hasPopup && !popup[0].state.isDestroyed) {
          popup[0].destroy();
        }
      },
    };
  },
});
