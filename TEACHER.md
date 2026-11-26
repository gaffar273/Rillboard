# Teacher board

Open **Rillboard** from the Desktop or Start menu, or run **Rillboard.exe**. Ask your connected assistant to **“use my whiteboard”**. The assistant writes and draws on the Windows whiteboard through its connected tools.

Each chat creates a separate board in the Lessons folder; new topics in that chat continue on the same scrolling board. Previous boards remain in My boards. Drawings, editable ids, lesson steps and playback position save on this computer and survive closing the app. **Keep drawing** lets you add your own notes; the next assistant step preserves them. **Pause live drawing** stops incoming changes until you allow them again. **Ask in ChatGPT** brings the running ChatGPT window forward. The connection indicator shows the last actual tool command, not a simulated online status.

The lesson is a **continuous scrolling board**. New sections go below the previous writing. Scroll with the mouse wheel, drag the canvas, use Page Up / Page Down, or use **Earlier / Later / Latest writing**. The vertical scrollbar lets you return to any section. Writing stays at a readable scale instead of shrinking the whole lesson onto one screen. Back, Next, Play and Restart review steps without removing already revealed work. Old slide-style bulk clears are converted into new sections; individual corrections can still remove an element. Existing unchanged lesson timelines are upgraded automatically with a local recovery copy.

**Lesson files → Save lesson** exports a replayable JSON backup; **Open lesson** loads one. A drawing-only `.excalidraw` export preserves editable elements but does not carry the lesson timeline. Read aloud is optional Windows speech synthesis, not ChatGPT's voice.

## Connect the assistant

Open the three-dot menu → **Settings**, then choose **Add plugin** under **Live teaching**. **Set up** shows the installed connector path and setup for Codex, Gemini CLI, and Claude Desktop. Removing the plugin stops the local bridge. Saved lessons stay in My boards.

This local MCP server lets the assistant in a supported desktop chat control your actual whiteboard. No separate model or OpenAI API key is needed. Node.js 18 or newer is required for the connector; the standalone drawing app does not need Node.

Run **Connect Teacher.cmd** or register from PowerShell using the connector path shown in Settings.

```powershell
codex mcp add elixdraw-teacher -- node "$env:LOCALAPPDATA\Programs\CraftSketchDesktop\teacher-bridge\server.cjs"
```

Restart the MCP connection or start a new chat if the current chat already loaded its tools. Ask: **“Use elixdraw-teacher to teach me fractions on the board, one step at a time.”**

Tools: `teacher_read`, `teacher_start`, `teacher_step`, `teacher_control`, `teacher_snapshot`. A tool call opens the Windows app if needed. Snapshot returns an actual PNG of the whiteboard and captions.

## Direct access from the command line

From the app directory, pass a JSON file to each command. Start with a new conversation key in `lesson.json` and use the same key in each subsequent request. The other files can add fields for the step or playback command.

```powershell
node .\teacher-bridge\client.cjs teacher_start lesson.json
node .\teacher-bridge\client.cjs teacher_read conversation.json
node .\teacher-bridge\client.cjs teacher_step step.json
node .\teacher-bridge\client.cjs teacher_control control.json
node .\teacher-bridge\client.cjs teacher_snapshot conversation.json board.png
```

Example lesson:

```json
{
  "conversationId": "65760716-6357-4501-ab5b-e8bb82a20508",
  "title": "Understanding force",
  "steps": [{
    "caption": "A force can push an object. The arrow shows its direction.",
    "durationMs": 6000,
    "actions": [
      {"op":"add","element":{"id":"block","type":"rectangle","x":150,"y":200,"w":180,"h":120,"fill":"#a5d8ff","fillStyle":"solid"}},
      {"op":"add","element":{"id":"force","type":"arrow","x":350,"y":260,"w":180,"h":0,"stroke":"#e03131","strokeWidth":3}},
      {"op":"add","element":{"id":"label","type":"text","x":390,"y":210,"text":"Force","fontSize":28,"stroke":"#e03131"}}
    ],
    "focus": ["force"]
  }]
}
```

For live teaching start `{"title":"Understanding force","steps":[]}`, retain the returned `conversationId`, and include it in every subsequent tool call. Continue with `teacher_step`. Actions add, update (`{"op":"update","id":"label","changes":{"text":"F = ma"}}`) or remove individual errors. IDs use letters, digits, underscores and hyphens. A step can specify `pointer: {x,y}`. Use the returned writingWidth for horizontal coordinates and extend y downward. For text, send teacher_step with conversationId and notes (an array of short text blocks). The app wraps and lays them out across the available width. Settings offers quick reveal or instant writing. To inspect precise styles, pen points or images, request teacher_read with detail set to full. **Read `teacher_read.nextY` before adding a new section, or set `pageBreak:true` and draw the new section using local y coordinates. Never clear old pages or start another board just to make room.** Inspect screenshots for readability. Continue the same topic with `teacher_step`.

`teacher_control` takes `{"command":"next"}` or `play`, `pause`, `back`, `restart`, `detach`. Full lessons start paused; live steps appear immediately. Paths draw progressively and text writes character by character. Unicode equations, shapes, freehand paths and embedded images are supported. Text uses a handwriting-style font; arbitrary LaTeX and natural pen stroke synthesis are not implemented. This connection supplies drawing tools to the current chat model, so model choice remains in ChatGPT.

## Implementation and tests

The native host polls `%LOCALAPPDATA%\CraftSketchDesktop\TeacherBridge`. Requests and replies are atomic, size bounded, tied to one process session, and expire. No network port, public tunnel or API credential is used. Only documented teacher commands run; there is no general-purpose script-execution tool. The bridge trusts processes running as your Windows user. After a timeout, read the board before retrying a mutation because it might already have been applied.

`TEACHER_BRIDGE_DIR` overrides the IPC folder for tests. Use `Rillboard.exe --data-dir <absolute-directory>` for an isolated profile.

Verification: `npm.cmd test`, `npm.cmd run build`, `node qa/teacher-review.cjs`, `npm.cmd run verify:desktop`. Teacher review tests actual MCP stdio calls, native playback, invalid updates, persistence and screenshot capture. Reports are under `qa/teacher-check/`.

## Chat ownership and interactive practice

Rillboard is an independent drawing app. **Teaching** is an optional overlay, closed by default. **Style** opens the drawing properties only when you want them. Neither panel reserves canvas space. Lesson notes appear in a collapsible bottom card; **Notes** hides or restores it. The window title and shortcut describe a whiteboard, not a built-in chatbot.

One conversation owns one locally saved board. This connector does not assume an MCP process or the foreground board identifies a conversation. It uses an explicit stable `conversationId` on every call:

1. In a new chat, call `teacher_start` with a title and `steps:[]`. Retain the returned `conversationId` in that chat's tool history. You may instead supply a stable chat identifier or a newly generated UUID on this first call, which also makes retries idempotent.
2. Include that key on every `teacher_read`, `teacher_step`, `teacher_control` and `teacher_snapshot`. A different chat must use a different key.
3. When resuming, recover the key from this chat history and call `teacher_read`. It opens the linked board, even if another board is currently visible. `teacher_start` with an existing key resumes without overwriting its lesson.
4. A new topic in the same chat is a new section (`pageBreak:true`), not another project. Never erase older pages to make room.
5. Older lessons are preserved. To link one for the first time, use `teacher_start` with its `boardId` from the old chat's tool history and a stable `conversationId`. If that identity is unavailable, ask which old lesson to use; never guess from the current board.

MCP calls without a key cannot modify an arbitrary open board. An unscoped `teacher_read` returns setup guidance only. The direct local CLI retains unscoped access for inspecting the app, but assistants must pass chat keys there too. New chats do not receive existing chat keys from unscoped MCP reads. If a chat has loaded the older tool schemas, refresh elixdraw-teacher in ChatGPT's MCP settings once; the CLI already accepts the new parameters.

A step can include `question:{"prompt":"What do you predict?","hint":"Look at the direction of the arrow."}`. The student can type an answer, reveal a hint, or choose **Draw it**. Drafts, submitted answers, hint usage, and drawings save locally. Replay pauses at unanswered questions. `teacher_read.responses` exposes responses by one-based step number, with `answer`, `submittedAt`, and `hintUsed`. Answers are not automatically sent as chat messages; the assistant reads them on its next tool call and gives feedback. A drawing answer remains in the board elements. Replay refuses to overwrite newer annotations; the next assistant step incorporates them into the saved timeline.

Native verification for these changes: `npm.cmd test`, `npm.cmd run build`, `npm.cmd run verify:teacher`, `npm.cmd run verify:bridge`, and `npm.cmd run verify:desktop`. The conversation checks use isolated profiles and preserve real user boards.
