# Forward NEWS reports to Investigator (CGN-009)

## IDs
- Investigator bot / agent id: **3949519**
- Queue folder: `/workspace/news-moderation/queue/pending/`
- Browser store: `localStorage["cognation.moderation.queue.v1"]`

## API
```js
window.CognationModeration.enqueue({
  postId, reason: "harmful"|"untruthful", edition, post: { authorName, body, ... }
})
```
Returns `{ ok, report, newsModerationFile, newsModerationPath, investigatorAgentId, sendToAgentHint }`.

## How HH / Engineer forwards
1. Reproduce report on NEWS tab (or call `enqueue` in console).
2. `CognationModeration.downloadLastPendingFile()` → save into `news-moderation/queue/pending/`.
3. **SendToAgent** Investigator (**3949519**) with that JSON + short note.
4. No user bans — Investigator only recommends keep-removed / restore.

## Events
- `cognation:news-post-reported`
- `cognation:moderation-queue-updated`
