"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ChevronDown,
  Clock3,
  Command,
  Crosshair,
  Search,
  Sparkles,
  X,
} from "lucide-react";
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
        <div className="panel-eyebrow">
          <span className="mini-crosshair">
            <Crosshair size={15} />
          </span>{" "}
          YOUR INVESTIGATION <span className="panel-number">01—05</span>
        </div>
        <div className="question-budget">
          <div className="question-pips" aria-hidden="true">
            {Array.from({ length: QUESTION_LIMIT }, (_, i) => (
              <span key={i} className={i < left ? "available" : "used"} />
            ))}
          </div>
          <p>
            <strong>{left}</strong> question{left !== 1 ? "s" : ""} left
          </p>
        </div>
        <div className="panel-rule" />
        {finalPick ? (
          <div className="final-pick">
            <Crosshair size={30} />
            <h3>
              {state.activeIds.length === 1
                ? "One film standing."
                : "Final pick."}
            </h3>
            <p>
              {state.activeIds.length === 1
                ? "The clues have done their work. Lock it in."
                : "The questions are in. Trust your instinct and choose a film."}
            </p>
            <a href="#lineup">
              Choose your film <ArrowDown size={16} />
            </a>
          </div>
        ) : (
          <>
            <label className="ask-label" htmlFor="question-search">
              Follow a hunch.
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
                {query ? (
                  <button
                    className="clear-search"
                    aria-label="Clear search"
                    onClick={() => {
                      setQuery("");
                      setHighlighted(0);
                      input.current?.focus();
                    }}
                  >
                    <X size={14} />
                  </button>
                ) : (
                  <span className="search-shortcut">
                    <Command size={10} />
                    <span>K</span>
                  </span>
                )}
              </div>
              {open && (
                <div className="search-popover">
                  <div className="search-popover-label">
                    {query ? "MATCHING QUESTIONS" : "USEFUL QUESTIONS"}
                    <span>{matches.length}</span>
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
                  <div className="search-popover-footer">
                    ↑ ↓ to explore <span>↵ to ask</span>
                  </div>
                </div>
              )}
            </div>
            <p className="search-help">Try a genre, a year, or an actor.</p>
            <div className="suggestion-label">
              <Sparkles size={12} />
              <span>A GOOD PLACE TO START</span>
            </div>
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
              <span className="answer-label">LATEST CLUE</span>
              <p>{latest.question.label}</p>
            </div>
            <strong>{latest.answer ? "YES" : "NO"}</strong>
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
            <Clock3 size={15} /> Your clues{" "}
            <small>{String(state.history.length).padStart(2, "0")}</small>
          </span>
          <ChevronDown size={15} className={historyOpen ? "rotated" : ""} />
        </button>
        {historyOpen && (
          <div id="question-history">
            {state.history.length ? (
              <ol>
                {state.history.map((h, i) => (
                  <li key={h.question.id}>
                    <span className="history-number">0{i + 1}</span>
                    <span>{h.question.shortLabel}</span>
                    <strong className={h.answer ? "yes-text" : "no-text"}>
                      {h.answer ? "YES" : "NO"}
                    </strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="empty-history">
                Every answer leaves a clue.
                <br />
                Yours will appear here.
              </p>
            )}
          </div>
        )}
      </div>
      <p className="instinct-note">
        <Crosshair size={16} />
        <span>
          Have a feeling? Select a poster
          <br />
          to lock in your film at any time.
        </span>
      </p>
    </aside>
  );
}
