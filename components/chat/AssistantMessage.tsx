import { renderMarkdown } from "./helpers";

export default function AssistantMessage({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  return (
    <div className="msg">
      <div className="msg-avatar oracle">O</div>
      <div className="msg-body">
        <div className="msg-head">
          <span className="msg-name">The Oracle</span>
          <span className="msg-role">pi agent</span>
        </div>
        <div
          className="prose"
          dangerouslySetInnerHTML={{
            __html: renderMarkdown(text, streaming),
          }}
        />
        {!streaming && text && (
          <div className="msg-actions">
            <button
              className="msg-action"
              onClick={() => navigator.clipboard.writeText(text)}
            >
              Copy
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
