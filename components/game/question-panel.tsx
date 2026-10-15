"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Search, X } from "lucide-react";
import {
  searchQuestions,
  suggestedQuestions,
  validQuestions,
} from "@/lib/game/questions";
import { activeMovies, QUESTION_LIMIT } from "@/lib/game/engine";
import type { GameState, Question } from "@/lib/game/types";
export function QuestionPanel({
  state,
  busy,
  onAsk,
}: {
  state: GameState;
  busy: boolean;
  onAsk: (q: Question) => void;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(true);
  const root = useRef<HTMLDivElement>(null);
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
  const suggestions = useMemo(() => suggestedQuestions(questions), [questions]);
  const matches = searchQuestions(questions, query);
  const finalPick = left === 0 || state.activeIds.length === 1;
  const disabled = busy || state.status !== "playing" || finalPick;
  const open = focused && !disabled;
  const latest = state.history.at(-1);
  useEffect(() => {
    if (open)
      document
        .getElementById(`option-${highlighted}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [highlighted, open]);
  const ask = (q: Question) => {
    setQuery("");
    setFocused(false);
    setHighlighted(0);
    onAsk(q);
  };
  return (
    <aside className="question-column">
      <div className={`question-panel ${finalPick ? "final-pick-panel" : ""}`}>
        <div className="question-budget">
          <p>
            <strong>
              {left} question{left !== 1 ? "s" : ""} left
            </strong>
          </p>
          <div className="question-pips" aria-hidden="true">
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
            <label className="ask-label" htmlFor="question-search">
              Ask anything that helps narrow it down
            </label>
            <div
              className="search-root"
              ref={root}
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
                  aria-controls="question-options"
                  aria-expanded={open}
                  aria-activedescendant={
                    open && matches.length ? `option-${highlighted}` : undefined
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
                          Try a genre, year, director or actor.
                          <br />
                          Questions must narrow the lineup.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <p className="suggestion-label">Suggested</p>
            <div className="suggestions">
              {suggestions.map((q) => (
                <button
                  type="button"
                  key={q.id}
                  disabled={disabled}
                  onClick={() => ask(q)}
                >
                  <span>{q.shortLabel}</span>
                  <ArrowRight size={15} />
                </button>
              ))}
            </div>
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
      <div className="history-panel">
        <button
          type="button"
          className="history-toggle"
          onClick={() => setHistoryOpen((v) => !v)}
          aria-expanded={historyOpen}
          aria-controls="question-history"
        >
          <span>
            Asked <span className="history-count">{state.history.length}</span>
          </span>
          <ChevronDown size={15} className={historyOpen ? "rotated" : ""} />
        </button>
        {historyOpen && (
          <div id="question-history">
            {state.history.length ? (
              <ol>
                {state.history.map((h) => (
                  <li key={h.question.id}>
                    <span>{h.question.shortLabel}</span>
                    <strong className={h.answer ? "yes-text" : "no-text"}>
                      {h.answer ? "Yes" : "No"}
                    </strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="empty-history">Your questions will appear here.</p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
