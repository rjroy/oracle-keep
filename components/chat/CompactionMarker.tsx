import { ScrollIcon } from "@/components/icons";

export default function CompactionMarker({ done }: { done: boolean }) {
  if (!done) {
    return (
      <div className="compaction-banner">
        <div className="compaction-spinner" />
        The archivist is condensing…
      </div>
    );
  }

  return (
    <div>
      <div className="archive-mark">
        <ScrollIcon size={14} className="scroll-icon" />
        <span>The archivist condensed</span>
      </div>
      <div className="archive-card">
        <div className="archive-card-head">
          <ScrollIcon size={12} />
          Context archive
        </div>
        <p className="archive-card-summary">
          Older messages were condensed to free up the context window. The
          conversation continues from here.
        </p>
      </div>
    </div>
  );
}
