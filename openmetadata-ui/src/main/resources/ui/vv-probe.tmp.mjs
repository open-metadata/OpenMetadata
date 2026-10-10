/*
 *  Copyright 2026 Collate.
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
import { chromium } from '@playwright/test';
const base=process.argv[2];
const b = await chromium.launch({ channel: 'chrome' }); const p = await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto(base+'/signin'); await p.fill('input[name="email"]','admin@open-metadata.org'); await p.fill('input[name="password"]','admin'); await p.click('[data-testid="login"]');
await p.waitForTimeout(5000);
await p.goto(base+'/searchIndex/elasticsearch_sample.customer_profiles_index'); await p.waitForTimeout(8000);
console.log('si', await p.evaluate(()=>{const td=document.querySelector('tbody tr td:nth-child(2)');return td?td.innerHTML.slice(0,400):'none'}));
await p.screenshot({path:'/Users/harshitshah/conductor/workspaces/OpenMetadata/spokane/.context/vv/probe-si.png'});
await p.goto(base+'/service/databaseServices/sample_data/connection'); await p.waitForTimeout(8000);
const e=p.locator('[data-testid="edit-connection-button"]'); console.log('ec count',await e.count(), await e.first().evaluate(x=>{const r=x.getBoundingClientRect();return x.outerHTML.slice(0,150)+' '+JSON.stringify(r)}).catch(e=>e.message));
await p.screenshot({path:'/Users/harshitshah/conductor/workspaces/OpenMetadata/spokane/.context/vv/probe-ec.png'});
await b.close();
