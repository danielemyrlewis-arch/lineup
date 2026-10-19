/** Shared by the existing Help dialog; examples never read live puzzle state. */
export function HowToPlay() {
  return (
    <>
      <h2>How to play</h2>
      <p className="help-intro"><strong>24 films. One mystery film.</strong></p>
      <p className="modal-intro">
        One film has been secretly chosen. Your job is to work out which one.
      </p>
      <ol className="how-steps">
        <li>
          <h3>Choose your questions.</h3>
          <p>
            You have five yes-or-no questions. Start with broad questions about
            genres or release years that could rule out lots of films.
          </p>
        </li>
        <li>
          <h3>Watch the lineup shrink.</h3>
          <p>After each answer, every film that doesn’t match is eliminated.</p>
          <figure className="help-example" aria-label="Illustrative example, not your current lineup">
            <figcaption>Example</figcaption>
            <p>“Is it animated?” <strong>No</strong></p>
            <p>All animated films are eliminated.</p>
            <p className="help-flow">
              <span>24 films</span><span aria-hidden="true">→</span><span>15 films remaining</span>
            </p>
          </figure>
        </li>
        <li>
          <h3>Find the film.</h3>
          <p>
            Tap a remaining poster, then choose “Lock it in”. You can guess at
            any point, even before using all five questions. You get one final
            guess, so choose carefully.
          </p>
        </li>
        <li>
          <h3>Fewer questions means a better result.</h3>
          <p>After all five questions, you must make your final selection.</p>
        </li>
      </ol>
      <aside className="help-tip" aria-label="Strategy tip">
        <h3>Start broad.</h3>
        <p>
          “Was it released before 2000?” could split a lineup roughly in half.
          “Does it feature Tom Cruise?” might match only one film. The number
          eliminated depends on the lineup and the answer.
        </p>
      </aside>
    </>
  );
}
