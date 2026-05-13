import http from "http";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parseArgs } from "util";
import { createAgentSession, SessionManager } from "@mariozechner/pi-coding-agent";

// ── CLI args ──────────────────────────────────────────────────────────────────
const { values } = parseArgs({
  options: {
    cwd:  { type: "string", default: dirname(fileURLToPath(import.meta.url)) + "/.." },
    port: { type: "string", default: "3141" },
  },
});

const CWD  = resolve(values.cwd);
const PORT = parseInt(values.port, 10);

// ── Agent session ─────────────────────────────────────────────────────────────
console.log(`\n  Oracle Keep`);
console.log(`  Working directory : ${CWD}`);
console.log(`  Starting agent session…\n`);

const { session, modelFallbackMessage } = await createAgentSession({
  sessionManager: SessionManager.continueRecent(CWD),
  cwd: CWD,
});

if (modelFallbackMessage) console.log(`  Note: ${modelFallbackMessage}`);
console.log(`  Session          : ${session.sessionFile ?? "(in-memory)"}`);
console.log(`  Agent ready.\n`);

// ── SSE helpers ───────────────────────────────────────────────────────────────
function send(res, type, data = {}) {
  if (!res.writableEnded) {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  }
}

// ── Inline HTML page ──────────────────────────────────────────────────────────
const HTML = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Oracle Keep — ${CWD}</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:        #0f1117;
      --surface:   #1a1d27;
      --surface2:  #22263a;
      --border:    #2e3250;
      --accent:    #7c6af7;
      --accent2:   #5b8dee;
      --text:      #e2e4f0;
      --text-dim:  #7a7f9a;
      --green:     #4ade80;
      --red:       #f87171;
      --tool-bg:   #161b2e;
      --user-bg:   #1e2a4a;
      --radius:    12px;
      --font-mono: "Fira Code", "Cascadia Code", "JetBrains Mono", monospace;
    }

    html, body { height: 100%; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 15px;
      line-height: 1.6;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    /* ── Header ── */
    header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    header .logo { font-size: 20px; }
    header h1 { font-size: 16px; font-weight: 600; color: var(--accent); }
    header .cwd {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-dim);
      margin-left: auto;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 55%;
    }
    #status-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--green);
      flex-shrink: 0;
      transition: background 0.3s;
    }
    #status-dot.busy { background: var(--accent); animation: pulse 1s infinite; }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }

    /* ── Messages ── */
    #messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      scroll-behavior: smooth;
    }
    #messages::-webkit-scrollbar { width: 6px; }
    #messages::-webkit-scrollbar-track { background: transparent; }
    #messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

    .msg {
      display: flex;
      gap: 10px;
      max-width: 820px;
      animation: fadein 0.15s ease;
    }
    @keyframes fadein { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }

    .msg.user  { align-self: flex-end; flex-direction: row-reverse; }
    .msg.assistant { align-self: flex-start; }

    .avatar {
      width: 30px; height: 30px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .msg.user .avatar      { background: var(--accent);  }
    .msg.assistant .avatar { background: var(--surface2); }

    .bubble {
      padding: 10px 14px;
      border-radius: var(--radius);
      max-width: 100%;
      overflow-wrap: break-word;
    }
    .msg.user .bubble {
      background: var(--user-bg);
      border: 1px solid #2d4080;
      border-bottom-right-radius: 4px;
    }
    .msg.assistant .bubble {
      background: var(--surface);
      border: 1px solid var(--border);
      border-bottom-left-radius: 4px;
    }

    /* Markdown rendering */
    .bubble p { margin-bottom: 0.5em; }
    .bubble p:last-child { margin-bottom: 0; }
    .bubble h1,.bubble h2,.bubble h3 { margin: 0.8em 0 0.3em; font-size: 1em; }
    .bubble ul, .bubble ol { margin: 0.3em 0 0.3em 1.4em; }
    .bubble li { margin-bottom: 0.1em; }
    .bubble code {
      font-family: var(--font-mono);
      font-size: 0.85em;
      background: rgba(255,255,255,0.07);
      padding: 1px 5px;
      border-radius: 4px;
    }
    .bubble pre {
      background: #0a0c14;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      margin: 8px 0;
      overflow-x: auto;
    }
    .bubble pre code { background: none; padding: 0; font-size: 0.83em; }
    .bubble strong { color: #c9d0f5; }
    .bubble a { color: var(--accent2); text-decoration: none; }
    .bubble a:hover { text-decoration: underline; }
    .bubble blockquote {
      border-left: 3px solid var(--accent);
      padding-left: 10px;
      color: var(--text-dim);
      margin: 6px 0;
    }
    .bubble table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 0.88em; }
    .bubble th, .bubble td { border: 1px solid var(--border); padding: 5px 10px; text-align: left; }
    .bubble th { background: var(--surface2); }

    /* ── Tool calls ── */
    .tool-group {
      align-self: flex-start;
      max-width: 820px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-left: 40px;
    }
    .tool-call {
      background: var(--tool-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      font-family: var(--font-mono);
      font-size: 12px;
    }
    .tool-header {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 12px;
      cursor: pointer;
      user-select: none;
    }
    .tool-header:hover { background: rgba(255,255,255,0.03); }
    .tool-icon { font-size: 13px; flex-shrink: 0; }
    .tool-name { color: var(--accent2); font-weight: 600; }
    .tool-label { color: var(--text-dim); font-weight: 400; }
    .tool-status { margin-left: auto; font-size: 11px; }
    .tool-status.running { color: var(--accent); }
    .tool-status.ok      { color: var(--green); }
    .tool-status.err     { color: var(--red); }
    .tool-toggle { color: var(--text-dim); margin-left: 4px; transition: transform 0.2s; }
    .tool-toggle.open { transform: rotate(90deg); }
    .tool-output {
      display: none;
      padding: 0 12px 10px;
      white-space: pre-wrap;
      color: var(--text-dim);
      max-height: 300px;
      overflow-y: auto;
      border-top: 1px solid var(--border);
      padding-top: 8px;
    }
    .tool-output.visible { display: block; }

    /* ── Thinking block ── */
    .thinking {
      align-self: flex-start;
      padding-left: 40px;
    }
    .thinking-text {
      font-size: 12px;
      color: var(--text-dim);
      font-style: italic;
      display: flex; align-items: center; gap: 6px;
    }
    .thinking-text::before { content: "💭"; font-style: normal; }

    /* ── Typing cursor ── */
    .cursor {
      display: inline-block;
      width: 2px; height: 1em;
      background: var(--accent);
      vertical-align: text-bottom;
      animation: blink 0.8s steps(1) infinite;
      margin-left: 1px;
    }
    @keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0;} }

    /* ── Input area ── */
    #input-area {
      display: flex;
      gap: 10px;
      padding: 14px 20px;
      background: var(--surface);
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }
    #input {
      flex: 1;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      color: var(--text);
      font-family: inherit;
      font-size: 14px;
      padding: 10px 14px;
      resize: none;
      min-height: 44px;
      max-height: 200px;
      overflow-y: auto;
      outline: none;
      transition: border-color 0.2s;
      line-height: 1.5;
    }
    #input:focus { border-color: var(--accent); }
    #input::placeholder { color: var(--text-dim); }
    #send {
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: var(--radius);
      padding: 0 18px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s;
      align-self: flex-end;
      height: 44px;
      flex-shrink: 0;
    }
    #send:hover:not(:disabled) { opacity: 0.9; }
    #send:active:not(:disabled) { transform: scale(0.97); }
    #send:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── Compaction banner ── */
    .compaction-banner {
      align-self: center;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--text-dim);
      padding: 6px 14px;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 20px;
      animation: fadein 0.2s ease;
      transition: opacity 0.4s ease;
    }
    .compaction-banner.resolved {
      color: var(--green);
      opacity: 0.6;
    }
    .compaction-spinner {
      width: 10px; height: 10px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Hint ── */
    .hint {
      text-align: center;
      color: var(--text-dim);
      font-size: 12px;
      padding-top: 4px;
      flex-shrink: 0;
      padding-bottom: 4px;
    }

    /* ── Welcome ── */
    .welcome {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: var(--text-dim);
      pointer-events: none;
    }
    .welcome .icon { font-size: 48px; }
    .welcome h2 { color: var(--text); font-size: 20px; }
    .welcome p  { font-size: 13px; }
    .welcome code {
      font-family: var(--font-mono);
      background: var(--surface2);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">⬡</div>
    <h1>Oracle Keep</h1>
    <div id="status-dot"></div>
    <span class="cwd">${CWD}</span>
  </header>

  <div id="messages">
    <div class="welcome" id="welcome">
      <div class="icon">🤖</div>
      <h2>Oracle is ready</h2>
      <p>Ask anything. The agent can read, write, and run commands in <code>${CWD}</code>.</p>
      <p style="margin-top:4px; font-size:12px;">Shift+Enter for new line · Enter to send</p>
    </div>
  </div>

  <div id="input-area">
    <textarea id="input" rows="1" placeholder="Ask the oracle anything…" autofocus></textarea>
    <button id="send">Send</button>
  </div>

  <script>
    // ── Marked config ─────────────────────────────────────────────────────────
    marked.setOptions({ breaks: true, gfm: true });

    const messagesEl = document.getElementById("messages");
    const inputEl    = document.getElementById("input");
    const sendBtn    = document.getElementById("send");
    const statusDot  = document.getElementById("status-dot");
    const welcomeEl  = document.getElementById("welcome");

    let busy = false;
    let compactionBanner = null;

    // ── Auto-resize textarea ──────────────────────────────────────────────────
    function resizeInput() {
      inputEl.style.height = "auto";
      inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + "px";
    }
    inputEl.addEventListener("input", resizeInput);

    // ── Send on Enter (Shift+Enter = newline) ─────────────────────────────────
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    sendBtn.addEventListener("click", sendMessage);

    // ── DOM helpers ───────────────────────────────────────────────────────────
    function removeWelcome() {
      if (welcomeEl) welcomeEl.remove();
    }

    function scrollToBottom() {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function appendUserMessage(text) {
      removeWelcome();
      const div = document.createElement("div");
      div.className = "msg user";
      div.innerHTML = \`
        <div class="avatar">👤</div>
        <div class="bubble">\${escapeHtml(text).replace(/\\n/g, "<br>")}</div>
      \`;
      messagesEl.appendChild(div);
      scrollToBottom();
    }

    function createAssistantBubble() {
      removeWelcome();
      const wrapper = document.createElement("div");
      wrapper.className = "msg assistant";
      const bubble = document.createElement("div");
      bubble.className = "bubble";
      wrapper.innerHTML = \`<div class="avatar">⬡</div>\`;
      wrapper.appendChild(bubble);
      messagesEl.appendChild(wrapper);
      scrollToBottom();
      return bubble;
    }

    function createToolGroup() {
      const group = document.createElement("div");
      group.className = "tool-group";
      messagesEl.appendChild(group);
      return group;
    }

    function createToolCall(group, name, label) {
      const div = document.createElement("div");
      div.className = "tool-call";
      div.innerHTML = \`
        <div class="tool-header">
          <span class="tool-icon">🔧</span>
          <span class="tool-name">\${escapeHtml(label || name)}</span>
          <span class="tool-status running" data-status>running…</span>
          <span class="tool-toggle">▶</span>
        </div>
        <div class="tool-output"></div>
      \`;
      const header  = div.querySelector(".tool-header");
      const output  = div.querySelector(".tool-output");
      const toggle  = div.querySelector(".tool-toggle");
      header.addEventListener("click", () => {
        output.classList.toggle("visible");
        toggle.classList.toggle("open");
      });
      group.appendChild(div);
      return div;
    }

    function escapeHtml(s) {
      return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
               .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
    }

    // ── Main send ─────────────────────────────────────────────────────────────
    async function sendMessage() {
      const text = inputEl.value.trim();
      if (!text || busy) return;

      busy = true;
      sendBtn.disabled = true;
      statusDot.classList.add("busy");
      inputEl.value = "";
      resizeInput();

      appendUserMessage(text);

      // State for current response
      let assistantBubble = null;
      let rawText = "";           // accumulate full markdown
      let toolGroup  = null;
      let activeTool = null;
      const toolMap  = {};        // name → element

      function getOrCreateBubble() {
        if (!assistantBubble) assistantBubble = createAssistantBubble();
        return assistantBubble;
      }

      function getOrCreateToolGroup() {
        if (!toolGroup) { toolGroup = createToolGroup(); }
        return toolGroup;
      }

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          appendError(err.error || "Request failed");
          return;
        }

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let   buffer  = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\\n");
          buffer = lines.pop();          // keep incomplete line

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            let event;
            try { event = JSON.parse(line.slice(6)); } catch { continue; }

            switch (event.type) {
              case "text": {
                const bubble = getOrCreateBubble();
                toolGroup = null; // reset tool group so next tool gets fresh one
                rawText += event.delta;
                bubble.innerHTML = marked.parse(rawText);
                // append blinking cursor
                const cursor = document.createElement("span");
                cursor.className = "cursor";
                bubble.appendChild(cursor);
                scrollToBottom();
                break;
              }
              case "tool_start": {
                // Close off any open text bubble for grouping
                assistantBubble = null;
                rawText = "";
                const group = getOrCreateToolGroup();
                const el = createToolCall(group, event.name, event.label);
                toolMap[event.name] = el;
                activeTool = el;
                scrollToBottom();
                break;
              }
              case "tool_update": {
                if (activeTool) {
                  const out = activeTool.querySelector(".tool-output");
                  out.textContent += event.delta;
                  scrollToBottom();
                }
                break;
              }
              case "tool_end": {
                const el = toolMap[event.name] || activeTool;
                if (el) {
                  const status = el.querySelector("[data-status]");
                  if (event.isError) {
                    status.textContent = "✗ error";
                    status.className = "tool-status err";
                  } else {
                    status.textContent = "✓ done";
                    status.className = "tool-status ok";
                  }
                  el.querySelector(".tool-icon").textContent = event.isError ? "❌" : "✅";
                }
                activeTool = null;
                break;
              }
              case "done": {
                // Remove cursor from last bubble
                if (assistantBubble) {
                  const c = assistantBubble.querySelector(".cursor");
                  if (c) c.remove();
                  // Re-render clean markdown
                  assistantBubble.innerHTML = marked.parse(rawText);
                }
                break;
              }
              case "error": {
                appendError(event.message);
                break;
              }
              case "compaction_start": {
                compactionBanner = appendCompactionBanner();
                break;
              }
              case "compaction_end": {
                resolveCompactionBanner(compactionBanner);
                compactionBanner = null;
                break;
              }
            }
          }
        }
      } catch (err) {
        appendError(err.message);
      } finally {
        // Clean up any stray cursor
        document.querySelectorAll(".cursor").forEach(c => c.remove());
        busy = false;
        sendBtn.disabled = false;
        statusDot.classList.remove("busy");
        inputEl.focus();
        scrollToBottom();
      }
    }

    function appendError(msg) {
      const div = document.createElement("div");
      div.style.cssText = "align-self:center; color:#f87171; font-size:13px; padding:8px 14px; background:#2a1a1a; border:1px solid #5c2020; border-radius:8px;";
      div.textContent = "⚠ " + msg;
      messagesEl.appendChild(div);
      scrollToBottom();
    }

    function appendCompactionBanner() {
      const div = document.createElement("div");
      div.className = "compaction-banner";
      div.innerHTML = \`<div class="compaction-spinner"></div> Compacting context…\`;
      messagesEl.appendChild(div);
      scrollToBottom();
      return div;
    }

    function resolveCompactionBanner(banner) {
      if (!banner) return;
      banner.classList.add("resolved");
      banner.innerHTML = "✓ Context compacted";
      setTimeout(() => banner.remove(), 3000);
    }

    // ── History restore on page load ──────────────────────────────────────────
    async function loadHistory() {
      try {
        const res = await fetch("/api/history");
        if (!res.ok) return;
        const { items } = await res.json();
        if (!items || items.length === 0) return;

        removeWelcome();
        let currentToolGroup = null;

        for (const item of items) {
          if (item.type === "user") {
            currentToolGroup = null;
            const div = document.createElement("div");
            div.className = "msg user";
            div.innerHTML = \`
              <div class="avatar">👤</div>
              <div class="bubble">\${escapeHtml(item.text).replace(/\\n/g, "<br>")}</div>
            \`;
            messagesEl.appendChild(div);
          } else if (item.type === "assistant_text") {
            currentToolGroup = null;
            const wrapper = document.createElement("div");
            wrapper.className = "msg assistant";
            const bubble = document.createElement("div");
            bubble.className = "bubble";
            bubble.innerHTML = marked.parse(item.text);
            wrapper.innerHTML = \`<div class="avatar">⬡</div>\`;
            wrapper.appendChild(bubble);
            messagesEl.appendChild(wrapper);
          } else if (item.type === "tool") {
            if (!currentToolGroup) currentToolGroup = createToolGroup();
            const el = createToolCall(currentToolGroup, item.name, item.name);
            const statusEl = el.querySelector("[data-status]");
            const outputEl = el.querySelector(".tool-output");
            outputEl.textContent = item.output;
            if (item.isError) {
              statusEl.textContent = "✗ error";
              statusEl.className = "tool-status err";
              el.querySelector(".tool-icon").textContent = "❌";
            } else {
              statusEl.textContent = "✓ done";
              statusEl.className = "tool-status ok";
              el.querySelector(".tool-icon").textContent = "✅";
            }
          }
        }
        scrollToBottom();
      } catch {
        // History load is non-fatal; welcome screen remains
      }
    }

    loadHistory();
  </script>
</body>
</html>`;

// ── History serializer ───────────────────────────────────────────────────────
function buildHistory(messages) {
  // Index tool results by toolCallId for O(1) lookup when pairing with tool calls
  const toolResults = {};
  for (const msg of messages) {
    if (msg.role === "toolResult") {
      toolResults[msg.toolCallId] = msg;
    }
  }

  const items = [];
  for (const msg of messages) {
    if (msg.role === "user") {
      const text = typeof msg.content === "string"
        ? msg.content
        : msg.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      if (text.trim()) items.push({ type: "user", text });

    } else if (msg.role === "assistant") {
      for (const block of msg.content) {
        if (block.type === "text" && block.text.trim()) {
          items.push({ type: "assistant_text", text: block.text });
        } else if (block.type === "toolCall") {
          const result = toolResults[block.id];
          const output = result
            ? result.content.filter((b) => b.type === "text").map((b) => b.text).join("")
            : "";
          items.push({ type: "tool", name: block.name, output, isError: result?.isError ?? false });
        }
      }
    }
    // skip: toolResult, thinking, bashExecution, custom, branchSummary, compactionSummary
  }
  return items;
}

// ── HTTP server ────────────────────────────────────────────────────────────────
let isProcessing = false;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  // Serve the chat page
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(HTML);
    return;
  }

  // History endpoint — returns serialized conversation for page-load restore
  if (req.method === "GET" && url.pathname === "/api/history") {
    res.writeHead(200, { "Content-Type": "application/json", ...corsHeaders() });
    res.end(JSON.stringify({ items: buildHistory(session.messages) }));
    return;
  }

  // Chat endpoint — streams SSE on the POST response
  if (req.method === "POST" && url.pathname === "/api/chat") {
    if (isProcessing) {
      res.writeHead(409, { "Content-Type": "application/json", ...corsHeaders() });
      res.end(JSON.stringify({ error: "Agent is busy — please wait for the current response to finish." }));
      return;
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      let message;
      try {
        message = JSON.parse(body).message;
        if (!message || typeof message !== "string") throw new Error("missing message");
      } catch {
        res.writeHead(400, { "Content-Type": "application/json", ...corsHeaders() });
        res.end(JSON.stringify({ error: "Body must be JSON { message: string }" }));
        return;
      }

      res.writeHead(200, {
        "Content-Type":  "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection":    "keep-alive",
        ...corsHeaders(),
      });

      isProcessing = true;

      const unsubscribe = session.subscribe((event) => {
        switch (event.type) {
          case "message_update": {
            const ae = event.assistantMessageEvent;
            if (ae.type === "text_delta")     send(res, "text",        { delta: ae.delta });
            if (ae.type === "thinking_delta") send(res, "thinking",    { delta: ae.delta });
            break;
          }
          case "tool_execution_start":
            send(res, "tool_start", { name: event.toolName, label: event.toolLabel ?? event.toolName });
            break;
          case "tool_execution_update":
            if (event.delta) send(res, "tool_update", { delta: event.delta });
            break;
          case "tool_execution_end":
            send(res, "tool_end", { name: event.toolName, isError: event.isError ?? false });
            break;
          case "compaction_start":
            send(res, "compaction_start", {});
            break;
          case "compaction_end":
            send(res, "compaction_end", {});
            break;
        }
      });

      try {
        await session.prompt(message);
        send(res, "done", {});
      } catch (err) {
        send(res, "error", { message: err.message ?? String(err) });
      } finally {
        unsubscribe();
        isProcessing = false;
        res.end();
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

server.listen(PORT, () => {
  console.log(`  ✓ Oracle Keep ready → http://localhost:${PORT}\n`);
});
