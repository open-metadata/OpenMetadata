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

import { AxiosError } from 'axios';
import parse from 'html-react-parser';
import { get, isString } from 'lodash';

export const stringToSlug = (dataString: string, slugString = '') => {
  return dataString.toLowerCase().replace(/ /g, slugString);
};

/**
 * Convert a template string into HTML DOM nodes
 * Same as React.createElement(type, options, children)
 * @param  {String} str The template string
 * @return {Node}       The template HTML
 */
export const stringToHTML = function (
  strHTML: string
): string | JSX.Element | JSX.Element[] {
  return strHTML ? parse(strHTML) : strHTML;
};

/**
 * Convert a template string into rendered HTML DOM
 * @param  {String} str The template string
 * @return {BodyNode}   The rendered template HTML
 */
export const stringToDOMElement = function (strHTML: string): HTMLElement {
  const parser = new DOMParser();
  const doc = parser.parseFromString(strHTML, 'text/html');

  return doc.body;
};

export const ordinalize = (num: number): string => {
  const mod10 = num % 10;
  const mod100 = num % 100;
  let ordinalSuffix: string;

  if (mod10 === 1 && mod100 !== 11) {
    ordinalSuffix = 'st';
  } else if (mod10 === 2 && mod100 !== 12) {
    ordinalSuffix = 'nd';
  } else if (mod10 === 3 && mod100 !== 13) {
    ordinalSuffix = 'rd';
  } else {
    ordinalSuffix = 'th';
  }

  return num + ordinalSuffix;
};

export const getJSONFromString = (data: string): string | null => {
  try {
    // Format string if possible and return valid JSON
    return JSON.parse(data);
  } catch (e) {
    // Invalid JSON, return null
    return null;
  }
};

export const isValidJSONString = (data?: string): boolean => {
  if (data) {
    return Boolean(getJSONFromString(data));
  }

  return false;
};

export const bytesToSize = (bytes: number) => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) {
    return `${bytes} ${sizes[0]}`;
  } else if (bytes < 0) {
    return `N/A`;
  } else {
    const i = parseInt(
      Math.floor(Math.log(bytes) / Math.log(1024)).toString(),
      10
    );
    if (i === 0) {
      return `${bytes} ${sizes[i]}`;
    } else {
      return `${(bytes / 1024 ** i).toFixed(2)} ${sizes[i]}`;
    }
  }
};

/**
 * Checks the value and return error text
 * @param value - The value to check
 * @param fallbackText
 * @returns Returns the error text
 */
export const getErrorText = (
  value: AxiosError | string,
  fallbackText: string
): string => {
  let errorText;
  if (isString(value)) {
    return value;
  } else if (value) {
    errorText = get(value, 'response.data.message', '');
    if (!errorText) {
      // if error text is undefined or null or empty, try responseMessage in data
      errorText = get(value, 'response.data.responseMessage', '');
    }
    if (!errorText) {
      errorText = get(value, 'response.data', '');
      errorText = typeof errorText === 'string' ? errorText : null;
    }
  }

  // if error text is still empty, return the fallback text
  return errorText || fallbackText;
};

/**
 *
 * @param fqn - Value to be encoded
 * @returns - Encoded text string as a valid component of a Uniform Resource Identifier (URI).
 */
export const getEncodedFqn = (fqn: string, spaceAsPlus = false) => {
  let uri = encodeURIComponent(fqn);

  if (spaceAsPlus) {
    uri = uri.replaceAll('%20', '+');
  }

  return uri;
};

/**
 *
 * @param fqn - Value to be encoded
 * @returns - Decode text string as a valid component of a Uniform Resource Identifier (URI).
 */
export const getDecodedFqn = (fqn: string, plusAsSpace = false) => {
  let uri = decodeURIComponent(fqn);

  if (plusAsSpace) {
    uri = uri.replaceAll('+', ' ');
  }

  return uri;
};

/**
 *
 * @param url - Url to be check
 * @returns - True if url is external otherwise false
 */
export const isExternalUrl = (url = '') => {
  return /^https?:\/\//.test(url);
};

/**
 *
 * @param a compare value one
 * @param b compare value two
 * @returns sorted array (A-Z) which will have custom value at last
 */
export const customServiceComparator = (a: string, b: string): number => {
  if (a.includes('Custom') || b.includes('Custom')) {
    return a.includes('Custom') ? 1 : -1;
  } else {
    return a.localeCompare(b);
  }
};

/**
 *
 * @param fqn - Value to be encoded
 * @returns - String text replacing + to valid component of a Uniform Resource Identifier (URI).
 */
export const replacePlus = (fqn: string) => fqn.replaceAll('+', ' ');

export const ES_RESERVED_CHARACTERS: Record<string, string> = {
  '+': '\\+',
  '-': '\\-',
  '=': '\\=',
  '&&': '\\&&',
  '||': '\\||',
  '>': '\\>',
  '<': '\\<',
  '!': '\\!',
  '(': '\\(',
  ')': '\\)',
  '{': '\\{',
  '}': '\\}',
  '[': '\\[',
  ']': '\\]',
  '^': '\\^',
  '"': '\\"',
  '~': '\\~',
  '*': '\\*',
  '?': '\\?',
  ':': '\\:',
  '\\': '\\\\',
  '/': '\\/',
};

export const escapeESReservedCharacters = (text?: string) => {
  const reUnescapedHtml = /[+-=&&||><!(){}^"~*?:/]/g;
  const reHasUnescapedHtml = RegExp(reUnescapedHtml.source);

  const getReplacedChar = (char: string) => {
    return ES_RESERVED_CHARACTERS[char] ?? char;
  };

  return text && reHasUnescapedHtml.test(text)
    ? text.replace(reUnescapedHtml, getReplacedChar)
    : text ?? '';
};

/**
 * @description Format JSON string to pretty print format with 2 spaces indentation.
 * if the JSON string is invalid, return the original JSON string
 * @param jsonString - JSON string to format
 * @returns Formatted JSON string
 * @example formatJsonString('{"a":1,"b":2}') => '{\n  "a": 1,\n  "b": 2\n}'
 */
export const formatJsonString = (jsonString: string) => {
  try {
    let formattedJson = '';
    const jsonObj = JSON.parse(
      // eslint-disable-next-line max-len
      // '{"errorFrom":"sink","lastFailedReason":"[EsWriter][BulkItemResponse] Got Following Error Responses: \\n [ {\\n  \\"lastFailedAt\\" : 1705359843787,\\n  \\"lastFailedReason\\" : \\"Index Type: [stored_procedure_search_index], Reason: [OpenSearchException[OpenSearch exception [type=mapper_parsing_exception, reason=failed to parse field [followers] of type [keyword] in document with id \'86834f87-e166-4b49-9aec-c6f2278cece4\'. Preview of field\'s value: \'{deleted=false, displayName=Shilpa Vernekar, name=shilpa, id=220e8ac0-4809-4664-9a44-583a0a009b6f, type=user, fullyQualifiedName=shilpa}\']]; nested: OpenSearchException[OpenSearch exception [type=illegal_state_exception, reason=Can\'t get text on a START_OBJECT at 1:2175]];] \\\\n Trace : [OpenSearchException[OpenSearch exception [type=mapper_parsing_exception, reason=failed to parse field [followers] of type [keyword] in document with id \'86834f87-e166-4b49-9aec-c6f2278cece4\'. Preview of field\'s value: \'{deleted=false, displayName=Shilpa Vernekar, name=shilpa, id=220e8ac0-4809-4664-9a44-583a0a009b6f, type=user, fullyQualifiedName=shilpa}\']]; nested: OpenSearchException[OpenSearch exception [type=illegal_state_exception, reason=Can\'t get text on a START_OBJECT at 1:2175]];\\\\n\\\\tat os.org.opensearch.OpenSearchException.innerFromXContent(OpenSearchException.java:540)\\\\n\\\\tat os.org.opensearch.OpenSearchException.fromXContent(OpenSearchException.java:451)\\\\n\\\\tat os.org.opensearch.action.bulk.BulkItemResponse.fromXContent(BulkItemResponse.java:154)\\\\n\\\\tat os.org.opensearch.action.bulk.BulkResponse.fromXContent(BulkResponse.java:208)\\\\n\\\\tat os.org.opensearch.client.RestHighLevelClient.parseEntity(RestHighLevelClient.java:2228)\\\\n\\\\tat os.org.opensearch.client.RestHighLevelClient.lambda$performRequestAndParseEntity$12(RestHighLevelClient.java:1845)\\\\n\\\\tat os.org.opensearch.client.RestHighLevelClient.internalPerformRequest(RestHighLevelClient.java:1928)\\\\n\\\\tat os.org.opensearch.client.RestHighLevelClient.performRequest(RestHighLevelClient.java:1877)\\\\n\\\\tat os.org.opensearch.client.RestHighLevelClient.performRequestAndParseEntity(RestHighLevelClient.java:1845)\\\\n\\\\tat os.org.opensearch.client.RestHighLevelClient.bulk(RestHighLevelClient.java:364)\\\\n\\\\tat org.openmetadata.service.search.opensearch.OpenSearchClient.bulk(OpenSearchClient.java:1256)\\\\n\\\\tat org.openmetadata.service.search.opensearch.OpenSearchIndexSink.write(OpenSearchIndexSink.java:31)\\\\n\\\\tat org.openmetadata.service.search.opensearch.OpenSearchIndexSink.write(OpenSearchIndexSink.java:16)\\\\n\\\\tat org.openmetadata.service.apps.bundles.searchIndex.SearchIndexApp.entitiesReIndex(SearchIndexApp.java:196)\\\\n\\\\tat org.openmetadata.service.apps.bundles.searchIndex.SearchIndexApp.startApp(SearchIndexApp.java:131)\\\\n\\\\tat org.openmetadata.service.apps.AbstractNativeApplication.execute(AbstractNativeApplication.java:206)\\\\n\\\\tat org.quartz.core.JobRunShell.run(JobRunShell.java:202)\\\\n\\\\tat org.quartz.simpl.SimpleThreadPool$WorkerThread.run(SimpleThreadPool.java:573)\\\\nCaused by: OpenSearchException[OpenSearch exception [type=illegal_state_exception, reason=Can\'t get text on a START_OBJECT at 1:2175]]\\\\n\\\\tat os.org.opensearch.OpenSearchException.innerFromXContent(OpenSearchException.java:540)\\\\n\\\\tat os.org.opensearch.OpenSearchException.fromXContent(OpenSearchException.java:451)\\\\n\\\\tat os.org.opensearch.OpenSearchException.innerFromXContent(OpenSearchException.java:481)\\\\n\\\\t... 17 more\\\\n]\\",\\n  \\"context\\" : \\"EsWriterContext: Encountered Error While Writing Data \\\\n Entity \\\\n ID : [86834f87-e166-4b49-9aec-c6f2278cece4] \\"\\n} ] ","lastFailedAt":1705359843627}'
      jsonString
    );

    // loop through the keys and values and format append the formatted string to formattedJson like [key]: [value]
    for (const [key, value] of Object.entries(jsonObj)) {
      formattedJson += `[${key}]: ${value}\n`;
    }

    // const formattedJson = JSON.stringify(jsonObj, null, 2);

    // eslint-disable-next-line max-len
    return formattedJson;
  } catch (error) {
    // Return the original JSON string if parsing fails
    return jsonString;
  }
};
