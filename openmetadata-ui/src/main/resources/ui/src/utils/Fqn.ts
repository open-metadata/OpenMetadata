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

import antlr4 from 'antlr4';
import { ParseTreeWalker } from 'antlr4/src/antlr4/tree';
import SplitListener from '../antlr/SplitListener';
import FqnLexer from '../generated/antlr/FqnLexer';
import FqnParser from '../generated/antlr/FqnParser';
import i18n from './i18next/LocalUtil';

export default class Fqn {
  // Equivalent of Java's FullyQualifiedName#split
  static split(fqn: string) {
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
  static build(...xs: string[]) {
    const result = [];
    for (const x of xs) {
      result.push(this.quoteName(x));
    }

    return result.join('.');
  }

  // Equivalent of Java's FullyQualifiedName#quoteName
  static quoteName(name: string): string {
    this.validateName(name);

    if (this.isQuotedName(name)) {
      const unquotedName = this.decodeQuotedName(name);

      return this.needsQuoting(unquotedName) ? name : unquotedName;
    }

    return this.needsQuoting(name)
      ? '"' + name.replace(/"/g, '""') + '"'
      : name;
  }

  // Equivalent of Java's FullyQualifiedName#unquoteName
  static unquoteName(name: string): string {
    this.validateName(name);

    return this.isQuotedName(name) ? this.decodeQuotedName(name) : name;
  }

  private static validateName(name: string): void {
    const matcher = /^(")([^"]+)(")$|^(.*)$/.exec(name);
    if (matcher?.[0].length !== name.length) {
      throw new Error(`${i18n.t('label.invalid-name')} ${name}`);
    }
  }

  private static needsQuoting(rawName: string): boolean {
    return rawName.includes('.') || rawName.includes('"');
  }

  private static isQuotedName(name: string): boolean {
    if (
      name.length < 2 ||
      name.charAt(0) !== '"' ||
      name.charAt(name.length - 1) !== '"'
    ) {
      return false;
    }
    const body = name.substring(1, name.length - 1);

    return !body.replace(/""/g, '').includes('"');
  }

  private static decodeQuotedName(name: string): string {
    return name.substring(1, name.length - 1).replace(/""/g, '"');
  }
}
