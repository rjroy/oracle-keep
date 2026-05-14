export default function UserMessage({ text }: { text: string }) {
  return (
    <div className="msg">
      <div className="msg-avatar user">Y</div>
      <div className="msg-body">
        <div className="msg-head">
          <span className="msg-name">You</span>
          <span className="msg-role">you</span>
        </div>
        <div className="prose">
          {text.split("\n").map((line, i, arr) => (
            <span key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
