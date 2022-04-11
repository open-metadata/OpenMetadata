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

import antlr4 from 'antlr4';
import FqnLexer from '../antlr/FqnLexer';
import FqnParser from '../antlr/FqnParser';
import SplitListener from '../antlr/SplitListner';
import { ParseTreeWalker } from 'antlr4/src/antlr4/tree';

export default class Fqn {
  // Equivalent of Java's FullyQualifiedName#split
  static split(fqn) {
    const chars = new antlr4.InputStream(fqn);
    const lexer = new FqnLexer(chars);
    const tokens = new antlr4.CommonTokenStream(lexer);
    const parser = new FqnParser(tokens);
    const tree = parser.fqn();
    const splitter = new SplitListener();
    ParseTreeWalker.DEFAULT.walk(splitter, tree);

    return splitter.split();
  }

  // Equivalent of Java's FullyQualifiedName#build
  static build(...xs) {
    const result = [];
    for (const x of xs) {
      result.push(this.quoteName(x));
    }

    return result.join('.');
  }

  // Equivalent of Java's FullyQualifiedName#quoteName
  static quoteName(name) {
    if (/[.|"]/.test(name)) {
      return '"' + name.replace(/"/g, '""') + '"';
    } else {
      return name;
    }
  }

  // Equivalent of Java's FullyQualifiedName#unquoteName
  static unquoteName(name) {
    return name.replace(/^"|"$/g, '').replace(/""/, '"');
  }
}
