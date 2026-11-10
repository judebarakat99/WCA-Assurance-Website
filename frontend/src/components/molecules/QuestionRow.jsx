/** One line in a question card: an identifier, a description and a trailing element. */
export default function QuestionRow({ id, children, aside }) {
  return (
    <div className="qrow">
      <span className="qr-id">{id}</span>
      <span className="qr-t">{children}</span>
      {aside}
    </div>
  );
}
