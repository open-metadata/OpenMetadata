/*
 *  Copyright 2021 Collate
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

export const REACTION_TYPE_LIST = Object.values(ReactionType);
export const REACTION_LIST = [
  { emoji: '👍', reaction: ReactionType.ThumbsUp, alias: '+1' },
  { emoji: '👎', reaction: ReactionType.ThumbsDown, alias: '-1' },
  { emoji: '😄', reaction: ReactionType.Laugh, alias: 'smile' },
  { emoji: '🎉', reaction: ReactionType.Hooray, alias: 'tada' },
  { emoji: '😕', reaction: ReactionType.Confused, alias: 'thinking_face' },
  { emoji: '❤️', reaction: ReactionType.Heart, alias: 'heart' },
  { emoji: '👀', reaction: ReactionType.Eyes, alias: 'rocket' },
  { emoji: '🚀', reaction: ReactionType.Rocket, alias: 'eyes' },
];
