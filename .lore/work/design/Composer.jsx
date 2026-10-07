/* global React, Icon */
const { useState, useRef, useEffect } = React;

function Composer({ onSend, disabled, persona, tools, onToggleTool, suggestion }) {
  const [text, setText] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (suggestion) setText(suggestion);
  }, [suggestion]);

  useEffect(() => {
    // auto-grow
    if (!ref.current) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = Math.min(200, ref.current.scrollHeight) + 'px';
  }, [text]);

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="composer">
      <div className="composer-inner">
        <div className="composer-box">
          <textarea
            ref={ref}
            className="composer-input"
            placeholder={disabled ? 'The Oracle is speaking…' : 'Ask, or set out on a new line…'}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            disabled={disabled}
          />
          <button
            className="send-btn"
            onClick={submit}
            disabled={!text.trim() || disabled}
            title="Send (↵)"
            aria-label="Send"
          >
            <Icon.Send size={16}/>
          </button>
        </div>
        <div className="composer-foot">
          <div className="composer-tools-bar">
            <button
              className={`composer-tool ${tools.lens ? 'is-on' : ''}`}
              onClick={() => onToggleTool('lens')}
              title="Allow web search"
            >
              <Icon.Eye size={12}/> Lens
            </button>
            <button
              className={`composer-tool ${tools.archive ? 'is-on' : ''}`}
              onClick={() => onToggleTool('archive')}
              title="Allow reading from the keep"
            >
              <Icon.Book size={12}/> Archive
            </button>
            <button
              className={`composer-tool ${tools.loom ? 'is-on' : ''}`}
              onClick={() => onToggleTool('loom')}
              title="Allow running code"
            >
              <Icon.Code size={12}/> Loom
            </button>
          </div>
          <div className="composer-shortcuts">
            Speaking to <em style={{ color: 'var(--fg-2)' }}>{persona}</em>
            {' · '}
            <kbd>↵</kbd> to send, <kbd>⇧↵</kbd> for a new line
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Composer });
