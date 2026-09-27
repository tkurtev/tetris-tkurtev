/** Atmospheric backdrop: radial glows, a slow perspective grid and faint scanlines. */
export function Background() {
  return (
    <div className="bg" aria-hidden="true">
      <div className="bg-orbit" />
      <div className="bg-grid" />
      <div className="bg-lines" />
    </div>
  );
}
