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
import { ReactionType } from '../generated/type/reaction';
import { REACTION_LIST, REACTION_TYPE_LIST } from './reactions.constant';

// Canonical @github/g-emoji-element (gemoji) alias for each ReactionType.
// The <g-emoji> custom element copies `alias` into the `alt` attribute of the
// fallback <img> it renders on platforms without native color-emoji support
// (Linux desktop, FreeBSD, Windows 7/8/8.1). A transposed alias therefore makes
// a screen reader announce the wrong emoji name for the affected reaction pill.
const CANONICAL_ALIASES: Record<ReactionType, string> = {
  [ReactionType.ThumbsUp]: '+1',
  [ReactionType.ThumbsDown]: '-1',
  [ReactionType.Laugh]: 'smile',
  [ReactionType.Hooray]: 'tada',
  [ReactionType.Confused]: 'thinking_face',
  [ReactionType.Heart]: 'heart',
  [ReactionType.Eyes]: 'eyes',
  [ReactionType.Rocket]: 'rocket',
};

describe('REACTION_LIST', () => {
  it.each(REACTION_LIST)(
    'alias for $reaction should match the canonical gemoji alias',
    ({ reaction, alias }) => {
      expect(alias).toBe(CANONICAL_ALIASES[reaction]);
    }
  );

  it('covers every ReactionType exactly once', () => {
    const coveredReactions = REACTION_LIST.map((entry) => entry.reaction);

    expect(coveredReactions).toEqual(
      expect.arrayContaining(REACTION_TYPE_LIST)
    );
    expect(coveredReactions).toHaveLength(REACTION_TYPE_LIST.length);
  });

  it('has unique aliases', () => {
    const aliases = REACTION_LIST.map((entry) => entry.alias);

    expect(new Set(aliases).size).toBe(aliases.length);
  });

  it('has unique emojis', () => {
    const emojis = REACTION_LIST.map((entry) => entry.emoji);

    expect(new Set(emojis).size).toBe(emojis.length);
  });
});
