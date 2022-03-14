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

const {resolve, extend} = require('json-schema-faker');
const fs = require('fs');
extend('faker', () => require('@faker-js/faker'));

// Make sure we got a filename on the command line.
if (process.argv.length < 3) {
  console.log('Usage: node ' + process.argv[1] + ' <FILENAME>');
  process.exit(1);
}

const filename = process.argv[2];
fs.readFile(filename, 'utf8', (err, schema) => {
  if (err) {
    console.error(err);

    return;
  }
  const schemaAsObject = JSON.parse(schema);
  resolve(schemaAsObject).then(sample => {
    console.log(sample);
  })
});
