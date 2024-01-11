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

import EntityLinkListener from '../generated/antlr/EntityLinkListener';

export default class EntityLinkSplitListener extends EntityLinkListener {
  constructor() {
    super();
    this.entityLinkParts = [];
  }

  // Enter a parse tree produced by EntityLinkParser#entityType.
  enterEntityType(ctx) {
    this.entityLinkParts.push(ctx.getText());
  }

  // Enter a parse tree produced by EntityLinkParser#entityAttribute.
  enterNameOrFQN(ctx) {
    this.entityLinkParts.push(ctx.getText());
  }

  // Enter a parse tree produced by EntityLinkParser#entityField.
  enterEntityField(ctx) {
    this.entityLinkParts.push(ctx.getText());
  }

  split() {
    return this.entityLinkParts;
  }
}
