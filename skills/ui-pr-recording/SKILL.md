---
name: ui-pr-recording
description: Use during PR creation for a UI feature or feature task. Run the PR build in Docker with sample data, record the feature, and upload the verified video into the GitHub PR description. Standalone fixes, refactors, styling and localization changes do not require this workflow.
---

# UI PR recording

Produce evidence of the feature running against a real local OpenMetadata stack as part of
[pr-checklist](../pr-checklist/SKILL.md) when creating its PR.
The requirement is recorded in ADR:2026-10-10-ui-prs-require-docker-screen-recordings.

## Scope and completion

Inspect the task/linked issue and the diff against the PR's base. This requirement applies when
creating a PR that implements or extends a UI feature, including a task or subtask of that feature
with UI impact. Standalone bug fixes, refactors, styling, localization, docs, tests and backend-only
work may use `Not applicable — <reason>` in the recording section. Classify by the task and its
behavior, not just changed paths or labels. A styling task that delivers part of a UI feature
still qualifies.

Run this step during PR creation, not automatically during implementation or a standalone review.
A user can still explicitly request a recording for any change. For a qualifying PR, prepare a
description containing a playable GitHub-hosted video, the recorded commit, Docker startup/health
evidence, sample-data setup, and the steps and outcomes shown.
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
set both `viewport` and `recordVideo.size` explicitly to the same dimensions; start with
1920×1080 for a desktop flow. Without an explicit video size,
[Playwright scales the video to fit 800×800](https://playwright.dev/docs/videos).
Retain `page.video()`, then await context closure before reading/saving the video.
If reusing login state, include IndexedDB in
`storageState` when authentication uses it. Keep authentication files and tokens out of artifacts.

Check a short sample before recording the whole flow. Choose a viewport suited to the feature and
keep small labels legible at the size reviewers will watch; extra pixels alone do not fix tiny text.
For a sharper capture or clearer cursor movement, consider a native recorder when available:

| Recorder | Useful when |
| --- | --- |
| [OBS Studio](https://obsproject.com/kb/recording-encoder-presets-guide) | Recording the browser window at its native resolution; its **Indistinguishable** preset favors quality over file size. |
| [Screen Studio](https://screen.studio/) (macOS) | Adding focused zooms and cursor/click emphasis; it supports MP4 exports up to 4K at 60 fps. |

These are optional capture choices, not required dependencies or purchases. Keep actions and
outcomes visible when zooming. Capture at the desired resolution/frame rate instead of upscaling
or interpolating an existing clip; re-encoding cannot recover detail lost during capture.

Show navigation to the feature, the action and its visible result against the Docker server.
For a preference, show both states and switching back. Include persistence, permission or
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

Keep the original capture. If MP4 conversion is needed, encode once from that source. A useful
quality-oriented starting point with [FFmpeg's libx264 encoder](https://ffmpeg.org/ffmpeg-codecs.html#libx264_002c-libx264rgb)
is CRF 18 and the slow preset, preserving the source dimensions and frame rate:

```bash
ffmpeg -n -i recording.webm -c:v libx264 -preset slow -crf 18 \
  -pix_fmt yuv420p -c:a aac -movflags +faststart recording.mp4
```

Inspect the result before choosing a smaller export. Check small text, moving/scrolling regions and
captions in the uploaded version too; a higher bitrate or a larger file is not proof of readability.

## 4. Upload into the PR description

When PR creation is authorized, upload the recording as part of that work. Prepare the
complete description in a temporary Markdown file, preserving its other sections, test results
and attachments. Under **UI screen recording**, include the evidence listed above and a video
reference on its own paragraph, using the same path supplied to `--attach`:

```markdown
![](/absolute/path/to/recording.mp4)
```

Check `gh pr create --help` for `--attach`. With a supporting CLI, replace the example branch,
title and paths per `pr-checklist` and run:

```bash
gh pr create --repo open-metadata/OpenMetadata --base main --head feature-branch \
  --draft --title 'Fixes 12345: UI feature' \
  --body-file /tmp/pr-body.md --attach /absolute/path/to/recording.mp4
gh pr view feature-branch --repo open-metadata/OpenMetadata --json body,url,isDraft
```

For a draft created while recording was blocked, finish the upload with
`gh pr edit <number> --body-file ... --attach ...`. The CLI replaces the local reference with the
uploaded video URL. See [GitHub CLI attachments](https://docs.github.com/en/github-cli/github-cli/attaching-files-with-github-cli).
If the CLI lacks this flag, use the authenticated GitHub browser editor's attachment control.

Inspect the saved description and check that the uploaded video loads from GitHub. Uploads can
partially succeed even when the CLI exits nonzero: read the current PR before retrying so you do
not duplicate attachments or overwrite a newer description. Complete the recording and the other
creation checks before marking the new PR ready. Do not create a release or commit video files to
host them.

If Docker, recording or upload is blocked, complete the independent work and keep the PR draft.
Report the exact failure, local artifact path (if created), and remaining step. If an authenticated
upload requires the user's help, provide the finished video and prepared description for attachment;
do not claim a local file is uploaded. This skill adds no separate gate to a read-only review.
