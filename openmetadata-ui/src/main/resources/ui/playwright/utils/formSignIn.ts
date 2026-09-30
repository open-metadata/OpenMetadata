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
import { Page } from '@playwright/test';
import { UserClass } from '../support/user/UserClass';

/**
 * Sign in by driving the sign-in form, on purpose.
 *
 * Almost no test wants this — `UserClass.signIn()` establishes the same session
 * with one POST instead of nine UI interactions, and `prefer-role-page-fixture`
 * enforces that at `error`. Two kinds of test legitimately need the form, and
 * calling this instead of `login()` is how they say so:
 *
 * 1. **The form is the subject.** `Auth/Login.spec.ts` asserts what the form
 *    itself does — that it accepts a non-ASCII credential, that a session
 *    refreshes. Signing in around the form would leave it asserting nothing.
 *
 * 2. **The route the app lands on after sign-in is the assertion.**
 *    `signInViaApi` finishes with `page.goto('/my-data')`, so for a spec that
 *    asserts where the app lands it does not merely differ from the real path —
 *    it *manufactures the answer*. `Features/AppMode/**` is the case:
 *    `AppModeAiPersonaLandsAtRoot` records every `framenavigated` pathname and
 *    asserts `visitedUrls` never contains `/my-data`, which `signIn()` would
 *    fail by construction.
 *
 * Anything else — "this test needs a real session", "the fixture user lacks a
 * permission" — is not a reason. `signIn()` posts to the same
 * `/api/v1/auth/login`, so every server-side effect of signing in is identical.
 *
 * This module is on the rule's implementation-path exemption list, which is why
 * the call below does not need a disable. That exemption is the reason to keep
 * the file to this one function: it is the single audited place where the suite
 * drives the form.
 */
export const signInThroughForm = async (
  page: Page,
  user: UserClass
): Promise<void> => {
  await user.login(page);
};
