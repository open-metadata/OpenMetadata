# Conversation V2 test traceability

This matrix records where each observable legacy feed behavior is exercised
after the endpoint cutover. Removed scenarios are called out explicitly so a
test cannot disappear behind a renamed suite.

| Legacy behavior or test | Conversation V2 replacement |
|---|---|
| Selected root, bounded replies, and reply count | `ActivityThreadPanelBody.test.tsx`: `renders the selected conversation with its hydrated replies`; `ConversationResourceIT`: `testCompleteConversationCrudAndBoundedHydration` |
| Empty/create/select conversation states | `ActivityThreadPanelBody.test.tsx`: `lists and selects conversations using Conversation V2` and `creates a conversation and updates the bounded list` |
| Conversation keyset pagination | `Features/ContextCenterArticles.spec.ts` waits for the cursor-bearing second request and all 11 seeded roots; `ActivityThreadPanelBody.test.tsx` and `ConversationResourceIT` cover cursor forwarding and root/reply cursor correctness |
| Landing-page widget rendering, navigation, filters, footer, and card structure | `Features/ActivityFeed.spec.ts`: the `Activity Feed Widget` scenarios; `Features/ActivityAPI.spec.ts`: the `Homepage Widget` scenarios |
| User-conversation root reaction and tooltip identity | `Features/ContextCenterArticles.spec.ts`: `Related assets, activity feed, user mentions, and article mentions work` |
| User-conversation resolve, edit, and delete | The same Context Center scenario performs and verifies each mutation through `/conversations/{id}` |
| User-conversation drawer reply creation | `Features/ActivityFeed.spec.ts`: `thread drawer opens from reply count and allows posting a reply` |
| Mention notification identity and navigation | `Features/ActivityFeed.spec.ts`: `Mention notification shows correct user details in Notification box` |
| Chinese mention encoding | `Features/ActivityFeed.spec.ts`: `Should encode the chinese character while mentioning api endpoint` |
| Homepage and entity All/My Data/Following filters | `Features/Tasks/ActivityFeed.spec.ts`, using activity-specific routes |
| Task filters, badge, drawer, and navigation | `Features/Tasks/ActivityFeed.spec.ts`, using `/tasks` routes |
| Context Center conversation entry point and permissions | `Features/ContextCenterArticles.spec.ts` and `Features/ContextCenterPermission.spec.ts`, using `/conversations` routes |
| Announcement scenarios | Existing announcement suites continue through `/announcements` |
| First and subsequent activity replies; no synthetic root or duplicate POST | `Features/ActivityAPI.spec.ts`: `creates exactly one reply and isolates activities with the same about` |
| Activity reply edit, reaction tooltip identity, and delete | The same deterministic Activity API scenario exercises PATCH, PUT reaction, and DELETE routes |
| Two activities with the same `about` | The same Activity API scenario verifies independent containers keyed by ActivityEvent ID |
| Removed Glossary `AF-05` reply smoke | Replaced by the deterministic user-conversation drawer reply and activity first/subsequent reply scenarios above |
| Removed Glossary `AF-06`/`AF-07` vacuous edit/delete checks | Replaced by the deterministic Context Center root mutations and Activity API reply mutations above |

Runtime REST-client route coverage is additionally maintained in
`src/rest/conversationsAPI.test.ts` and `src/rest/activityAPI.test.ts`.
Author/non-author/admin action visibility, resolution dispatch, activity-reply
state replacement, and drawer root-action composition are covered by the
corresponding component/provider unit tests.
