/** Thin horizontal progress track. value: 0–100. tone: good | warn | bad (optional). */
export default function Meter({ value, tone, color }) {
  const width = `${Math.max(0, Math.min(100, value))}%`;
  return (
    <div className="mb-tr">
      <i className={tone ? `p-${tone}` : undefined} style={color ? { width, background: color } : { width }} />
    </div>
  );
}
