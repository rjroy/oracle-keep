/* global React, Icon */
const { useMemo } = React;

// The Memory Ribbon — a vertical strip showing the full conversation
// at a glance. Archived (compacted) segments are dim+narrow.
// Recent turns are full-width and tinted by speaker.

function Ribbon({ items, liveIdx, onJump }) {
  // Each archive item gets a single short ribbon-bar.
  // Each user/oracle/tool item gets its own bar, sized by content length.
  const segments = useMemo(() => {
    const out = [];
    items.forEach((it, idx) => {
      if (it.kind === 'archive') {
        out.push({
          id: it.id,
          tone: 'archived',
          height: 24,
          tip: `${it.title} · ${it.timeAgo}`,
          time: it.timeAgo,
          targetIdx: idx,
          archivist: true,
        });
        return;
      }
      if (it.kind === 'user') {
        const len = (it.text || '').length;
        out.push({
          id: it.id,
          tone: 'user',
          height: Math.max(14, Math.min(38, 14 + len / 8)),
          tip: it.text.slice(0, 60) + (it.text.length > 60 ? '…' : ''),
          time: it.timeAgo,
          targetIdx: idx,
          label: 'you',
        });
      }
      if (it.kind === 'oracle') {
        const len = (it.text || '').length;
        out.push({
          id: it.id,
          tone: idx === liveIdx ? 'live' : 'oracle',
          height: Math.max(20, Math.min(64, 18 + len / 14)),
          tip: it.text.slice(0, 70) + (it.text.length > 70 ? '…' : ''),
          time: it.timeAgo,
          targetIdx: idx,
          label: it.persona || 'oracle',
        });
        if (it.toolCalls?.length) {
          it.toolCalls.forEach(tc => {
            out.push({
              id: tc.id,
              tone: 'tool',
              height: 10,
              tip: `Tool · ${tc.tool}`,
              time: it.timeAgo,
              targetIdx: idx,
              label: 'tool',
            });
          });
        }
      }
    });
    return out;
  }, [items, liveIdx]);

  return (
    <aside className="ribbon" aria-label="Memory ribbon">
      <div className="ribbon-spine"/>
      <div className="ribbon-label">memory</div>
      <div className="ribbon-segments">
        {segments.map((s, i) => {
          const prev = segments[i - 1];
          const showArchivistDivider = prev && prev.tone === 'archived' && s.tone !== 'archived';
          return (
            <React.Fragment key={s.id + '-' + i}>
              {showArchivistDivider ? <div className="ribbon-divider" title="The archivist condensed everything above"/> : null}
              <div
                className="ribbon-seg"
                data-tone={s.tone}
                style={{ height: s.height }}
                onClick={() => onJump?.(s.targetIdx)}
                role="button"
                tabIndex={0}
                aria-label={s.tip}
              >
                <div className="tip">
                  <span className="tip-time">{s.time}</span>
                  <span>{s.tip}</span>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <div className="ribbon-label">now</div>
    </aside>
  );
}

Object.assign(window, { Ribbon });
