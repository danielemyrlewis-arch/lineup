"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Search, X } from "lucide-react";
import {
  searchQuestions,
  openingQuestionExamples,
  validQuestions,
} from "@/lib/game/questions";
import { activeMovies, hasUsedSuggestion, QUESTION_LIMIT } from "@/lib/game/engine";
import type { GameState, Question } from "@/lib/game/types";
import { QuestionBrowser } from "./question-browser";
import { trackEvent } from "@/lib/analytics";
export function QuestionPanel({
  state,
  busy,
  onAsk,
  showStrategyHint = false,
}: {
  state: GameState;
  busy: boolean;
  onAsk: (q: Question, suggested?: true) => void;
  showStrategyHint?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [pendingSuggestionId, setPendingSuggestionId] = useState<string | null>(null);
  const pendingSuggestion = useRef<string | null>(null);
  const budget = useRef<HTMLParagraphElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const left = QUESTION_LIMIT - state.history.length;
  const questions = useMemo(
    () =>
      validQuestions(
        activeMovies(state),
        state.history.map((h) => h.question.id),
      ),
    [state],
  );
  // Always select from the original board, never the current answer-dependent subset.
  const examples = useMemo(() => openingQuestionExamples(state.puzzle.movies), [state.puzzle.movies]);
  const suggestionUsed = hasUsedSuggestion(state);
  const availableExampleIds = new Set(questions.map(question => question.id));
  const showSuggestions = state.status === "playing" && !suggestionUsed && examples.some(question => availableExampleIds.has(question.id));
  const selectedSuggestion = !suggestionUsed && examples.some(question => question.id === pendingSuggestionId)
    ? questions.find(question => question.id === pendingSuggestionId) : undefined;
  const matches = searchQuestions(questions, query);
  const finalPick = left === 0 || state.activeIds.length === 1;
  const disabled = busy || state.status !== "playing" || finalPick;
  const open = focused && !disabled && !pendingSuggestionId && query.trim().length > 0;
  const latest = state.history.at(-1);
  useEffect(() => {
    if (open)
      document
        .getElementById(`option-${highlighted}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [highlighted, open, query, matches.length]);
  const clearSuggestion = () => { pendingSuggestion.current = null; setPendingSuggestionId(null); };
  const ask = (q: Question, suggested?: true) => {
    if (disabled) return;
    const canonical = questions.find(question => question.id === q.id);
    if (!canonical || (suggested && (suggestionUsed || pendingSuggestion.current !== q.id || !examples.some(question => question.id === q.id)))) return;
    // Clear synchronously before the parent updates, so a double click cannot submit twice.
    clearSuggestion();
    // Dismiss a touch keyboard while retaining desktop keyboard focus.
    if (window.matchMedia("(pointer: coarse)").matches) input.current?.blur();
    setQuery("");
    setFocused(false);
    setHighlighted(0);
    onAsk(canonical, suggested);
    if (suggested) requestAnimationFrame(() => budget.current?.focus());
  };
  return (
    <aside className="question-column">
      <div className="question-panel">
        <div className="question-budget">
          <p ref={budget} tabIndex={-1}>
            <strong>
              {left} question{left !== 1 ? "s" : ""} left
            </strong>
          </p>
          <div className="question-progress" aria-hidden="true">
            {Array.from({ length: QUESTION_LIMIT }, (_, i) => (
              <span key={i} className={i < left ? "available" : "used"} />
            ))}
          </div>
        </div>
        {finalPick ? (
          <div className="final-pick">
            <h3>
              {state.activeIds.length === 1
                ? "One film standing."
                : "Final pick."}
            </h3>
            <p>
              {state.activeIds.length === 1
                ? "There’s one film left. Ready to lock it in?"
                : "You’ve used all five questions. Choose one of the remaining films."}
            </p>
            <a href="#lineup">Choose your film</a>
          </div>
        ) : (
          <>
            <label className="sr-only" htmlFor="question-search">
              Ask a yes-or-no question
            </label>
            <p id="question-guidance" className="strategy-hint">
              {showStrategyHint
                ? "Not sure what to ask? Browse questions below."
                : "Try a genre, year, actor or studio."}
            </p>
            <div
              className="search-root"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget))
                  setFocused(false);
              }}
            >
              <div className={`search-input ${open ? "is-open" : ""}`}>
                <Search size={18} />
                <input
                  id="question-search"
                  ref={input}
                  type="text"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-describedby="question-guidance"
                  aria-controls="question-options"
                  aria-expanded={open}
                  aria-activedescendant={
                    open && matches[highlighted] ? `option-${highlighted}` : undefined
                  }
                  autoComplete="off"
                  placeholder="Ask a question…"
                  value={query}
                  disabled={disabled}
                  onFocus={() => setFocused(true)}
                  onChange={(e) => {
                    clearSuggestion();
                    setQuery(e.target.value);
                    setHighlighted(0);
                    setFocused(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      clearSuggestion();
                      setFocused(false);
                      input.current?.blur();
                    }
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setFocused(true);
                      setHighlighted((v) =>
                        Math.max(0, Math.min(v + 1, matches.length - 1)),
                      );
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setHighlighted((v) => Math.max(v - 1, 0));
                    }
                    if (e.key === "Enter" && selectedSuggestion) {
                      e.preventDefault();
                      ask(selectedSuggestion, true);
                    } else if (e.key === "Enter" && open && matches[highlighted]) {
                      e.preventDefault();
                      ask(matches[highlighted]);
                    }
                  }}
                />
                {query && (
                  <button
                    type="button"
                    className="clear-search"
                    aria-label="Clear search"
                    onClick={() => {
                      clearSuggestion();
                      setQuery("");
                      setHighlighted(0);
                      input.current?.focus();
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <span className="sr-only" role="status" aria-live="polite">
                {open && query ? `${matches.length} matching question${matches.length === 1 ? "" : "s"}.` : ""}
              </span>
              {open && (
                <div className="search-popover">
                  <div className="search-popover-label">
                    {query ? "Matching questions" : "Questions"}
                  </div>
                  <div
                    id="question-options"
                    role="listbox"
                    aria-label="Valid questions"
                  >
                    {matches.length ? (
                      matches.map((q, i) => (
                        <button
                          type="button"
                          role="option"
                          aria-selected={i === highlighted}
                          id={`option-${i}`}
                          key={q.id}
                          className={i === highlighted ? "highlighted" : ""}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setHighlighted(i)}
                          onFocus={() => setHighlighted(i)}
                          onClick={() => ask(q)}
                        >
                          <span>
                            <small>{q.category}</small>
                            {q.label}
                          </span>
                          <ArrowRight size={15} />
                        </button>
                      ))
                    ) : (
                      <div className="no-matches">
                        <Search size={20} />
                        <p>No useful questions match.</p>
                        <span>
                          Try a genre, year, director, actor or studio.
                          <br />
                          Questions need known answers for every remaining
                          film and must narrow the lineup.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="question-discovery">
              <button
                type="button"
                className="browse-questions"
                disabled={disabled || questions.length === 0}
                aria-haspopup="dialog"
                onClick={() => {
                  if (disabled || questions.length === 0 || browseOpen) return;
                  trackEvent("question_browse", {mode: state.puzzle.mode});
                  if (pendingSuggestion.current) setQuery("");
                  clearSuggestion();
                  setFocused(false);
                  input.current?.blur();
                  setBrowseOpen(true);
                }}
              >
                <span>Browse questions</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
            {showSuggestions && (
              <>
              <p className="suggestion-label">Need some inspiration?</p>
              <p className="suggestion-allowance">1 suggested question available</p>
              <div role="group" className="suggestions" aria-label="Suggested questions">
                {examples.map((q) => {
                  const available = availableExampleIds.has(q.id);
                  const asked = state.history.some(answer => answer.question.id === q.id);
                  return <button
                    type="button"
                    key={q.id}
                    disabled={disabled || !available}
                    aria-pressed={selectedSuggestion?.id === q.id}
                    title={!available ? asked ? "Already asked" : "This question no longer narrows the lineup." : undefined}
                    onClick={() => {
                      if (disabled || !available || suggestionUsed) return;
                      pendingSuggestion.current = q.id;
                      setPendingSuggestionId(q.id);
                      setQuery(q.label);
                      setFocused(false);
                      setHighlighted(0);
                      if (!window.matchMedia("(pointer: coarse)").matches) input.current?.focus();
                    }}
                  >
                    <span>{q.shortLabel}</span>
                  </button>;
                })}
              </div>
              {selectedSuggestion && <button type="button" className="browse-questions suggestion-submit"
                disabled={disabled} onClick={() => ask(selectedSuggestion, true)}>
                <span>Ask this question</span><ArrowRight size={16} aria-hidden="true" />
              </button>}
              </>
            )}
          </>
        )}
        {latest && (
          <div
            className={`answer-reveal ${latest.answer ? "answer-yes" : "answer-no"}`}
            key={state.history.length}
            role="status"
          >
            <div>
              <p>{latest.question.label}</p>
            </div>
            <strong>{latest.answer ? "Yes" : "No"}</strong>
            <small>
              {latest.eliminatedIds.length} film
              {latest.eliminatedIds.length !== 1 ? "s" : ""} eliminated
            </small>
          </div>
        )}
      </div>
      {state.history.length > 0 && (
        <div className="history-panel">
          <button
            type="button"
            className="history-toggle"
            onClick={() => setHistoryOpen((v) => !v)}
            aria-expanded={historyOpen}
            aria-controls="question-history"
          >
            <span>Asked</span>
            <ChevronDown size={15} className={historyOpen ? "rotated" : ""} />
          </button>
          {historyOpen && (
            <ol id="question-history">
              {state.history.map((h) => (
                <li key={h.question.id}>
                  <span>{h.question.shortLabel}</span>
                  <strong className={h.answer ? "yes-text" : "no-text"}>
                    {h.answer ? "Yes" : "No"}
                  </strong>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      {browseOpen && !disabled && (
        <QuestionBrowser
          questions={questions}
          onClose={() => setBrowseOpen(false)}
          onAsk={(question) => {
            setBrowseOpen(false);
            ask(question);
            // The Browse trigger becomes disabled during elimination. Restore
            // focus to the stable budget rather than a removed/disabled control.
            requestAnimationFrame(() => budget.current?.focus());
          }}
        />
      )}
    </aside>
  );
}
