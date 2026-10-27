"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Search, X } from "lucide-react";
import {
  searchQuestions,
  openingQuestionExamples,
  validQuestions,
} from "@/lib/game/questions";
import { activeMovies, QUESTION_LIMIT } from "@/lib/game/engine";
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
  onAsk: (q: Question) => void;
  showStrategyHint?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [browseOpen, setBrowseOpen] = useState(false);
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
  const examples = useMemo(() => state.status === "playing"
    ? openingQuestionExamples(state.puzzle.movies, state.history.map(h => h.question.id))
    : [], [state.puzzle.movies, state.history, state.status]);
  const matches = searchQuestions(questions, query);
  const finalPick = left === 0 || state.activeIds.length === 1;
  const disabled = busy || state.status !== "playing" || finalPick;
  const open = focused && !disabled && query.trim().length > 0;
  const latest = state.history.at(-1);
  useEffect(() => {
    if (open)
      document
        .getElementById(`option-${highlighted}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [highlighted, open, query, matches.length]);
  const ask = (q: Question) => {
    if (disabled) return;
    // Dismiss a touch keyboard while retaining desktop keyboard focus.
    if (window.matchMedia("(pointer: coarse)").matches) input.current?.blur();
    setQuery("");
    setFocused(false);
    setHighlighted(0);
    onAsk(q);
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
                    setQuery(e.target.value);
                    setHighlighted(0);
                    setFocused(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
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
                    if (e.key === "Enter" && open && matches[highlighted]) {
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
                  setFocused(false);
                  input.current?.blur();
                  setBrowseOpen(true);
                }}
              >
                <span>Browse questions</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
            {examples.length > 0 && (
              <>
              <p className="suggestion-label">Example questions</p>
              <div className="suggestions">
                {examples.map((q) => (
                  <button
                    type="button"
                    key={q.id}
                    disabled={disabled}
                    onClick={() => {
                      ask(q);
                      requestAnimationFrame(() => budget.current?.focus());
                    }}
                  >
                    <span>{q.shortLabel}</span>
                  </button>
                ))}
              </div>
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
