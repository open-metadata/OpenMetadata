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
const b = await chromium.launch({ channel: 'chrome' }); const p = await (await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:3})).newPage();
await p.goto('http://localhost:3191/signin'); await p.fill('input[name="email"]','admin@open-metadata.org'); await p.fill('input[name="password"]','admin'); await p.click('[data-testid="login"]');
await p.waitForTimeout(5000);
await p.goto('http://localhost:3191/settings/members/teams/Organization');
const e=p.locator('[data-testid="edit-team-name"]').first(); await e.waitFor(); await p.waitForTimeout(2500);
const c=await e.boundingBox(); await p.mouse.move(0,0); await p.mouse.move(c.x+c.width/2,c.y+c.height/2,{steps:6}); await p.waitForTimeout(1500);
console.log(await p.evaluate(()=>{const t=document.querySelector('[role=tooltip]');const a=t?.querySelector('svg');return a?JSON.stringify(a.getBoundingClientRect())+' '+t.getAttribute('data-placement')+' '+getComputedStyle(a).transform:'no svg'}));
await p.screenshot({path:'/Users/harshitshah/conductor/workspaces/OpenMetadata/spokane/.context/vv/probe-arrow.png',clip:{x:c.x-10,y:c.y-10,width:160,height:50}});
await b.close();
