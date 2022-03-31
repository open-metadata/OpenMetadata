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

/* eslint-disable */
const fs = require('fs');
const path = require('path');

module.exports = function (request, response) {
  let targetFileName = 'GET.json';

  // Check is a type parameter exist
  if (request.query.q) {
    // Generate a new targetfilename with that q parameter
    const q =  request.query.q;
    if (q.toString().includes('owner')) {
      targetFileName = 'GET_owner.json';
    }
  } else {
    targetFileName = 'GET.json';
  }
  const filePath = path.join(__dirname, targetFileName);
  // If file does not exist then respond with 404 header
  try {
    fs.accessSync(filePath);
  }
  catch (err) {
    return response.status(404).end();
  }
  // Respond with filePath
  response.sendFile(filePath);
}