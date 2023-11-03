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
import FqnListener from '../generated/antlr/FqnListener';

export default class SplitListener extends FqnListener {
  constructor() {
    super();
    this.xs = [];
  }

  // Enter a parse tree produced by FqnParser#unquotedName.
  enterUnquotedName(ctx) {
    this.xs.push(ctx.getText());
  }

  // Enter a parse tree produced by FqnParser#quotedName.
  enterQuotedName(ctx) {
    this.xs.push(ctx.getText());
  }

  split() {
    return this.xs;
  }
}
