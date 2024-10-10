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

import APIClient from "./index";

export const fetchMarkdownFile = async (filePath: string) => {
  let baseURL;

  try {
    const url = new URL(filePath);
    baseURL = `${url.origin}/`;
  } catch (error) {
    baseURL = "/";
  }

  const response = await APIClient.get<string>(filePath, {
    baseURL,
    headers: {
      "Content-Type": "text/markdown",
      Accept: "text/markdown",
    },
  });

  return response.data;
};
