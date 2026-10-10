---
name: ui-pr-recording
description: Build and run the PR's OpenMetadata UI in Docker with sample data, record the changed flow, and upload the video into the GitHub PR description. Required before requesting review for any production UI change, including shared UI components, styles, localization, and refactors.
---

# UI PR recording

Produce reviewable evidence of the changed UI running against a real local OpenMetadata stack.
Use with [pr-checklist](../pr-checklist/SKILL.md) before opening or marking a UI PR ready.
The requirement is recorded in ADR:2026-10-10-ui-prs-require-docker-screen-recordings.

## Scope and completion

Inspect the diff against the PR's base, including `openmetadata-ui/` and
`openmetadata-ui-core-components/`, and any other files that change the UI's behavior. Styling,
localization and behavior-preserving production UI refactors still require a recording of an
affected flow. Only changes with no production UI impact (for example, docs or test-only changes)
may use `Not applicable — <reason>` in the PR's recording section.

A UI PR is ready only when its description contains a playable GitHub-hosted video, the recorded
commit, Docker startup/health evidence, sample-data setup, and the steps and outcomes shown.
Screenshots supplement the video; a local path, test trace, terminal recording, mock-only UI or
TODO does not satisfy the requirement. Required automated tests remain separate checks.

## 1. Run the PR build in Docker

Use [test-locally](../test-locally/SKILL.md) for prerequisites and the existing build workflow.
Build the committed PR code, including the UI, and record `git rev-parse HEAD`. Do not use a
released image or skip the build unless the existing artifact is verified to contain that code.

Inspect `docker ps` and the Compose configuration first. The local runner stops both default dev
stacks even with `-r false`; its default `-r true` deletes database files. If another task owns
those services, use an isolated Compose stack with distinct container names, host ports, network
and volumes. A different project name alone is insufficient: the base Compose file pins names,
ports, a subnet and a database bind mount. Do not stop another task's stack or delete its data.

For an available default dev stack, from the repo root:

```bash
source env/bin/activate
make generate
./docker/run_local_docker.sh -m ui -d mysql -s false -i true -r false
docker compose -f docker/development/docker-compose.yml ps
curl --fail --silent --show-error http://localhost:8585/api/v1/system/version
```

Verify the server revision matches the recorded build and the server, database and search services
are healthy. Use the configured URLs/Compose files for an isolated stack. Keep Docker running
through recording and verification, and report its final state; do not tear it down implicitly.

The runner loads the repository's sample data through ingestion. Wait for the data the demo needs
and verify it in the UI/API; a successful startup alone does not prove ingestion succeeded.
Alternatively, ingest the repository sample data into the isolated stack and create a small
synthetic fixture through the API for the changed flow. Record setup commands/fixture names and
any sample-loader failures. Failures affecting the demo must be fixed before recording.

## 2. Capture the changed flow

Use the available browser recording tool or the UI project's installed Playwright. Confirm the
tool produces an actual video; screenshot-only tools cannot satisfy this task. For Playwright,
create a browser context with `recordVideo` and a readable viewport, retain `page.video()`, then
close the context before reading/saving the video. If reusing login state, include IndexedDB in
`storageState` when authentication uses it. Keep authentication files and tokens out of artifacts.

Show navigation to the feature, the action and its visible result against the Docker server.
For a preference, show both states and switching back; for a bug fix, show the corrected scenario;
for a refactor, show the affected existing flow still works. Include persistence, permission or
error behavior when the change affects it. Use UI/API assertions to verify the outcomes instead
of treating a completed click sequence as success. Use real server responses, not route mocks.

Keep the clip focused and text readable; captions are useful when the state change is not obvious.
Record with synthetic sample data and omit credentials, tokens and unrelated browser content.
Save artifacts outside tracked source files. After further UI/runtime changes, rebuild and record
again. Documentation or test-only commits can reuse evidence if the demonstrated runtime code is
unchanged; retain the actual recorded SHA and explain that in the description.

## 3. Verify the video

Open the finished clip and check that it plays, covers every claimed state, and shows readable
results without clipped dialogs. Check duration/file size and inspect frames from the beginning,
changed state and end. Prefer H.264 MP4 for browser compatibility; MOV and WebM are also supported
by [GitHub attachments](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files).
Compress or split a rejected oversized upload without hiding relevant behavior.

## 4. Upload into the PR description

When creating/updating the PR is authorized, upload the recording as part of that work. Prepare the
complete description in a temporary Markdown file, preserving its other sections, test results
and attachments. Under **UI screen recording**, include the evidence listed above and a video
reference on its own paragraph, using the same path supplied to `--attach`:

```markdown
![](/absolute/path/to/recording.mp4)
```

Check `gh pr edit --help` for `--attach`. With a supporting CLI, replace the example PR number and
paths and run:

```bash
gh pr edit 12345 --repo open-metadata/OpenMetadata \
  --body-file /tmp/pr-body.md --attach /absolute/path/to/recording.mp4
gh pr view 12345 --repo open-metadata/OpenMetadata --json body,url,isDraft
```

For a new PR, `gh pr create --draft --body-file ... --attach ...` also works; supply its title,
base and head per `pr-checklist`. The CLI replaces the local reference with the uploaded video
URL. See [GitHub CLI attachments](https://docs.github.com/en/github-cli/github-cli/attaching-files-with-github-cli).
If the CLI lacks this flag, use the authenticated GitHub browser editor's attachment control.

Inspect the saved description and check that the uploaded video loads from GitHub. Uploads can
partially succeed even when the CLI exits nonzero: read the current PR before retrying so you do
not duplicate attachments or overwrite a newer description. Only mark ready after the recording
and the other PR checks are complete. Do not create a release or commit video files to host them.

If Docker, recording or upload is blocked, complete the independent work and keep the PR draft.
Report the exact failure, local artifact path (if created), and remaining step. If an authenticated
upload requires the user's help, provide the finished video and prepared description for attachment;
do not claim a local file is uploaded. A read-only review checks this evidence without starting a
stack, uploading files or changing PR state.
