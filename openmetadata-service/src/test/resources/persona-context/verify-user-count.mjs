/*
 *  Copyright 2026 Collate
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
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const source = readFileSync(`${root}/openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/AccessControlDAOs.java`, 'utf8');
const sql = [...source.matchAll(/@SqlQuery\(\s*"""\n([\s\S]*?)"""\)/g)]
  .map(match => match[1]).find(query => query.includes('COUNT(DISTINCT assigned.userId)'));
assert.ok(sql, 'Find the production count query');
const relationship = readFileSync(`${root}/openmetadata-spec/target/generated-sources/jsonschema2pojo/org/openmetadata/schema/type/Relationship.java`, 'utf8');
const names = [...relationship.matchAll(/^\s+([A-Z_]+)\("/gm)].map(match => match[1]);
const applied = names.indexOf('APPLIED_TO');
const defaults = names.indexOf('DEFAULTS_TO');
const has = names.indexOf('HAS');
assert.ok(Math.min(applied, defaults, has) >= 0);
const query = sql.replaceAll('<personaIds>', "'pa','pb','pc'")
  .replaceAll(':systemDefaultId', "'pc'").replaceAll(':appliedTo', `${applied}`)
  .replaceAll(':defaultsTo', `${defaults}`).replaceAll(':has', `${has}`);
const database = process.env.PERSONA_TEST_DATABASE ?? 'postgres';
const aggregate = database === 'mysql' ? 'JSON_OBJECTAGG' : 'jsonb_object_agg';
let script = `
BEGIN;
CREATE TEMPORARY TABLE user_entity (id VARCHAR(36), deleted BOOLEAN, isBot BOOLEAN);
CREATE TEMPORARY TABLE team_entity (id VARCHAR(36), deleted BOOLEAN);
CREATE TEMPORARY TABLE entity_relationship (fromId VARCHAR(36), toId VARCHAR(36), fromEntity VARCHAR(256), toEntity VARCHAR(256), relation INTEGER);
INSERT INTO user_entity VALUES ('a',false,false),('b',false,false),('c',false,false),('d',true,false),('bot',false,true);
INSERT INTO team_entity VALUES ('t1',false),('t2',false),('removed',true);
INSERT INTO entity_relationship VALUES
 ('pa','a','persona','user',${applied}),('pa','a','persona','user',${defaults}),
 ('pa','d','persona','user',${applied}),('pb','c','persona','user',${defaults}),
 ('t1','pa','team','persona',${has}),('t2','pa','team','persona',${has}),('removed','pa','team','persona',${has}),
 ('t1','a','team','user',${has}),('t1','b','team','user',${has}),('t1','bot','team','user',${has}),
 ('t2','b','team','user',${has}),('removed','c','team','user',${has});
SELECT ${aggregate}(personaId,userCount) FROM (${query}) counted;
UPDATE user_entity SET deleted=true WHERE id='b';
SELECT ${aggregate}(personaId,userCount) FROM (${query}) counted;
ROLLBACK;
`;
const container = process.env.PERSONA_TEST_DATABASE_CONTAINER;
assert.ok(container, 'Set PERSONA_TEST_DATABASE_CONTAINER to the disposable database container');
assert.ok(['mysql', 'postgres'].includes(database), 'PERSONA_TEST_DATABASE must be mysql or postgres');
const command = database === 'mysql'
  ? 'MYSQL_PWD="${MYSQL_PASSWORD:-$MYSQL_ROOT_PASSWORD}" exec mysql -u "${MYSQL_USER:-root}" -D "${MYSQL_DATABASE:-openmetadata_db}" --batch --skip-column-names'
  : 'exec psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" --no-psqlrc -qAt -v ON_ERROR_STOP=1';
const prefix = `pc_${randomUUID().replaceAll('-', '')}_`;
const tables = ['user_entity', 'team_entity', 'entity_relationship'];
if (database === 'mysql') {
  script = script.replaceAll('CREATE TEMPORARY TABLE', 'CREATE TABLE')
    .replace(/\b(user_entity|team_entity|entity_relationship)\b/g, name => prefix + name);
}
let result;
try {
  result = execFileSync('docker', ['exec', '-i', container, 'sh', '-c', command], { input: script, encoding: 'utf8' });
} finally {
  if (database === 'mysql') {
    execFileSync('docker', ['exec', '-i', container, 'sh', '-c', command], {
      input: `DROP TABLE IF EXISTS ${tables.map(name => prefix + name).join(',')};`,
      encoding: 'utf8',
    });
  }
}
const rows = result.trim().split('\n').map(row => JSON.parse(row));
assert.deepEqual(rows, [{ pa: 2, pb: 1, pc: 1 }, { pa: 1, pb: 1 }]);
console.log('PASS: production SQL counts direct, inherited and default users once; excludes bots from inherited and system-default counts, deleted users and deleted teams.');
