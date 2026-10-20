"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Question, RankedQuestion } from "@/lib/game/types";
import { groupQuestions, QUESTION_PAGE_SIZE } from "@/lib/game/question-groups";
import { Dialog } from "./dialog";

/** A second way to discover the exact same currently valid question objects. */
export function QuestionBrowser({
  questions,
  onAsk,
  onClose,
}: {
  questions: RankedQuestion[];
  onAsk: (question: Question) => void;
  onClose: () => void;
}) {
  const groups = useMemo(() => groupQuestions(questions), [questions]);
  const [category, setCategory] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const group = groups.find((entry) => entry.id === category);
  const first = page * QUESTION_PAGE_SIZE;
  const visible = group?.questions.slice(first, first + QUESTION_PAGE_SIZE) ?? [];
  useEffect(() => {
    // Drill-down replaces the focused row; keep keyboard users in the new view.
    heading.current?.focus();
  }, [category, page]);
  return (
    <Dialog title="Browse questions" onClose={onClose} className="question-browser-dialog">
      <h2 ref={heading} tabIndex={-1}>Browse questions</h2>
      {group ? (
        <>
          <div className="question-browser-heading">
            <button type="button" onClick={() => { setCategory(null); setPage(0); }}>
              <ArrowLeft size={16} aria-hidden="true" /> All categories
            </button>
            <h3>{group.label}</h3>
          </div>
          <p className="question-browser-intro">Choose a question to ask it.</p>
          <ul className="question-browser-list" aria-label={`${group.label} questions`}>
            {visible.map((question) => (
              <li key={question.id}>
                <button type="button" onClick={() => onAsk(question)}>
                  <span>{question.label}</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {group.questions.length > QUESTION_PAGE_SIZE && (
            <nav className="question-browser-pagination" aria-label="Question pages">
              <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <button type="button" disabled={first + QUESTION_PAGE_SIZE >= group.questions.length} onClick={() => setPage(page + 1)}>
                More questions <ArrowRight size={15} aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      ) : (
        <>
          <p className="question-browser-intro">Explore questions that can narrow your current lineup.</p>
          <ul className="question-categories">
            {groups.map((entry) => (
              <li key={entry.id}>
                <button type="button" onClick={() => { setCategory(entry.id); setPage(0); }}>
                  <span><strong>{entry.label}</strong><small>{entry.description}</small></span>
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {!groups.length && <p className="question-browser-intro">No questions can narrow this lineup further. Time to choose your film.</p>}
        </>
      )}
    </Dialog>
  );
}
