import "./Skeleton.css";

// Loading placeholders that mirror the shape of the real content, so a page keeps its
// layout while data is on the way instead of flashing an empty screen.

export function SkeletonLine({ width = "100%", height = 14, radius = 6, style }) {
  return <span className="skeleton-line" style={{ width, height, borderRadius: radius, ...style }} />;
}

export function SkeletonCards({ count = 4, className = "" }) {
  return (
    <div className={`skeleton-cards ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className="skeleton-card" key={index}>
          <SkeletonLine width="45%" height={11} />
          <SkeletonLine width="70%" height={24} />
          <SkeletonLine width="35%" height={11} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, columns = 5, className = "" }) {
  return (
    <div className={`skeleton-table ${className}`} aria-hidden="true">
      <div className="skeleton-table-row skeleton-table-head" style={{ "--cols": columns }}>
        {Array.from({ length: columns }).map((_, index) => (
          <SkeletonLine key={index} width={index === 0 ? "60%" : "45%"} height={11} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div className="skeleton-table-row" key={row} style={{ "--cols": columns }}>
          {Array.from({ length: columns }).map((_, col) => (
            <SkeletonLine key={col} width={col === 0 ? "80%" : "55%"} height={13} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonTiles({ count = 8, media = true, className = "" }) {
  return (
    <div className={`skeleton-tiles ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className="skeleton-tile" key={index}>
          {media && <span className="skeleton-tile-media" />}
          <SkeletonLine width="75%" height={14} />
          <SkeletonLine width="45%" height={11} />
          <SkeletonLine width="60%" height={11} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ rows = 5, className = "" }) {
  return (
    <div className={`skeleton-list ${className}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="skeleton-list-row" key={index}>
          <span className="skeleton-dot" />
          <div className="skeleton-list-text">
            <SkeletonLine width="55%" height={13} />
            <SkeletonLine width="30%" height={10} />
          </div>
          <SkeletonLine width={70} height={16} />
        </div>
      ))}
    </div>
  );
}

// Wraps a section: shows the placeholder until `loading` turns false.
export default function Skeleton({ loading, children, fallback }) {
  return loading ? fallback : children;
}
