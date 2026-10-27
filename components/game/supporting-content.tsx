/** Useful, spoiler-free copy is rendered even before the film catalogue loads. */
export function SupportingContent() {
  return <section className="lineup-guide" aria-labelledby="lineup-guide-heading">
    <div className="lineup-guide-intro">
      <h2 id="lineup-guide-heading">A daily film guessing game.</h2>
      <p>LINEUP is free to play. Start with 24 films, ask up to five yes-or-no questions and identify one mystery film. There’s a new Daily challenge each day, plus unlimited Practice whenever you want another go.</p>
    </div>
    <div className="lineup-guide-columns">
      <section id="how-lineup-works" aria-labelledby="how-lineup-works-heading">
        <h3 id="how-lineup-works-heading">How LINEUP works</h3>
        <p>Look over the posters. Ask about a year, genre, cast member, director or another film detail. Each answer removes films that don’t fit.</p>
        <p>Use up to five questions, then choose a film and select <strong>Lock it in</strong>. You can make your final guess sooner if you’re ready.</p>
      </section>
      <section id="daily-or-practice" aria-labelledby="daily-or-practice-heading">
        <h3 id="daily-or-practice-heading">Daily LINEUP or Practice?</h3>
        <p>Daily gives everyone the same lineup and mystery film, with one completed attempt per day in this browser. It changes at midnight UK time, following GMT and BST.</p>
        <p>Practice makes a fresh lineup whenever you want.
          {/* Native navigation lets the static game read its mode query on a fresh load. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          {" "}<a href="/?mode=practice#lineup">Play Practice</a> between Daily puzzles; it doesn’t count towards account Daily statistics or streaks.</p>
      </section>
      <section aria-labelledby="question-choice-heading">
        <h3 id="question-choice-heading">Why question choice matters</h3>
        <p>Five questions go quickly. Compare the films still in play before choosing what to ask. A detail shared by several films can be more useful than a fact about just one.</p>
        <p>Need some inspiration? You can submit one of the three suggested questions at any point. It counts towards your five. Search and <strong>Browse questions</strong> stay available throughout the game.</p>
      </section>
    </div>
    <section className="lineup-faq" id="lineup-faq" aria-labelledby="lineup-faq-heading">
      <h3 id="lineup-faq-heading">A few questions, answered.</h3>
      <details><summary>Is LINEUP free?</summary><p>Yes. Daily LINEUP and unlimited Practice are free to play.</p></details>
      <details><summary>How many questions do you get?</summary><p>Up to five yes-or-no questions, followed by one final guess. You can lock in your answer before using all five.</p></details>
      <details><summary>Can you play more than once a day?</summary><p>There’s one Daily puzzle each day. Switch to Practice for as many fresh lineups as you like.</p></details>
      <details><summary>When does the Daily puzzle change?</summary><p>At midnight in the UK, using Europe/London time so the reset follows both GMT and BST.</p></details>
      <details><summary>Do you need an account?</summary><p>No. Your Daily progress stays in this browser. Optional Google sign-in lets you save completed Daily results and see private statistics, history and winning streaks.</p></details>
    </section>
    <a className="lineup-guide-back" href="#lineup">Back to the lineup ↑</a>
  </section>;
}
