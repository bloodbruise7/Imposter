import { useEffect, useState } from 'react';
import type { PoolWord, Settings } from '../game/types';
import { speakingOrder } from '../game/order';
import { standings } from '../game/scoring';
import { Button, Confirm, Screen } from '../components/ui';
import { useCountdown, useDelay, useFitText, vibrate } from '../app/hooks';
import { playTimesUp } from '../app/audio';
import type { RoundRecord } from '../app/model';
import type { Ballot } from '../game/ballots';

export interface RoundState {
  number: number;
  word: PoolWord;
  imposterIndexes: number[];
  troll: boolean;
  first: number;
  reshuffled: boolean;
}

/** Roman numerals for round labels: the ledger look. */
export function roman(n: number): string {
  if (n <= 0 || n >= 4000) return String(n);
  const table: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  for (const [v, s] of table) while (n >= v) { out += s; n -= v; }
  return out;
}

/* ---------- Hand-off ---------- */

interface HandoffProps {
  round: number;
  name: string;
  onShow: () => void;
  /** Button label; defaults to the card hand-off. */
  action?: string;
  eyebrowNote?: string;
}

export function HandoffScreen({ round, name, onShow, action, eyebrowNote }: HandoffProps) {
  return (
    <Screen className="screen--center" eyebrow={`Round ${roman(round)}${eyebrowNote ? ` · ${eyebrowNote}` : ''}`}>
      <p className="lede">Pass the phone to</p>
      <BigText text={name} />
      <div className="screen__actions screen__actions--inline">
        <Button onClick={onShow}>{action ?? `I'm ${name}, show my card`}</Button>
      </div>
    </Screen>
  );
}

/* ---------- Card ---------- */

interface CardProps {
  round: RoundState;
  settings: Settings;
  playerIndex: number;
  onHide: () => void;
}

export function CardScreen({ round, settings, playerIndex, onHide }: CardProps) {
  const canHide = useDelay(600, playerIndex);
  const isImposter = round.imposterIndexes.includes(playerIndex);
  const { word } = round;

  let label: string;
  let big: string;
  const lines: string[] = [];

  if (!isImposter) {
    label = 'Your word';
    big = word.word;
    lines.push(`Category: ${word.categoryName}`);
  } else if (settings.mode === 'undercover') {
    label = 'Your word';
    big = word.decoy;
    lines.push(`Category: ${word.categoryName}`);
  } else {
    label = 'Your role';
    big = "You're the imposter";
    const clue = settings.clue === 'category-hint' && !word.hint ? 'category' : settings.clue;
    if (clue === 'none') lines.push('No clue this round. Blend in.');
    else {
      lines.push(`Category: ${word.categoryName}`);
      if (clue === 'category-hint') lines.push(`Hint: ${word.hint}`);
    }
  }

  return (
    <Screen className="screen--center" eyebrow={`Round ${roman(round.number)}`}>
      <div className="card">
        <p className="lede">{label}</p>
        <BigText text={big} />
        <div className="card__lines">
          {lines.map((l) => (
            <p key={l} className="card__line">
              {l}
            </p>
          ))}
        </div>
      </div>
      <div className="screen__actions screen__actions--inline">
        <Button onClick={onHide} disabled={!canHide}>
          Hide card
        </Button>
      </div>
    </Screen>
  );
}

/* ---------- Clue ---------- */

interface ClueProps {
  players: string[];
  round: RoundState;
  timerMinutes: number;
  onVote: () => void;
  onRedeal: () => void;
}

export function ClueScreen({ players, round, timerMinutes, onVote, onRedeal }: ClueProps) {
  const [confirmRedeal, setConfirmRedeal] = useState(false);
  const total = timerMinutes * 60;
  const timer = useCountdown(total, true);
  const order = speakingOrder(players.length, round.first);
  /** How many clues have been given so far; wraps around for extra laps. */
  const [turn, setTurn] = useState(0);
  const position = turn % players.length;
  const lap = Math.floor(turn / players.length) + 1;
  const current = order[position];
  const next = order[(position + 1) % players.length];

  useEffect(() => {
    if (timer.done) {
      vibrate([200, 100, 200]);
      playTimesUp();
    }
  }, [timer.done]);

  const mm = Math.floor(timer.remaining / 60);
  const ss = String(timer.remaining % 60).padStart(2, '0');
  const timerLive = total > 0 && !timer.done;

  return (
    <Screen
      eyebrow={`Round ${roman(round.number)}${lap > 1 ? ` · Lap ${lap}` : ''}`}
      title={
        turn === 0 ? (
          <>
            <span className="accent">{players[current]}</span> goes first
          </>
        ) : (
          <>
            <span className="accent">{players[current]}</span>'s turn
          </>
        )
      }
      actions={
        <>
          <Button variant={timerLive ? 'primary' : 'secondary'} onClick={() => setTurn((t) => t + 1)}>
            Next: {players[next]}
          </Button>
          <div className="toolbar">
            {timerLive && (
              <Button variant="ghost" onClick={timer.running ? timer.pause : timer.resume}>
                {timer.running ? 'Pause' : 'Resume'}
              </Button>
            )}
            <Button variant={timerLive ? 'secondary' : 'primary'} onClick={onVote}>
              Vote now
            </Button>
          </div>
        </>
      }
    >
      {round.reshuffled && (
        <p className="note" role="status">
          You've played every word in these categories. Shuffling them back in.
        </p>
      )}
      {total > 0 && (
        <div className={`timer ${timer.done ? 'is-done' : ''} ${!timer.running && !timer.done ? 'is-paused' : ''}`}>
          <p className="timer__value" aria-hidden="true">
            {mm}:{ss}
          </p>
          <p className="timer__status" aria-live="assertive">
            {timer.done ? "Time's up" : timer.running ? '' : 'Paused'}
          </p>
        </div>
      )}
      <h2 className="section-title">Speaking order</h2>
      <ol className="order" aria-label="Speaking order">
        {order.map((i, n) => {
          const state = n === position ? 'is-current' : n < position ? 'is-done' : '';
          return (
            <li key={i} className={state} aria-current={n === position ? 'true' : undefined}>
              <span className="order__num" aria-hidden="true">
                {n + 1}
              </span>
              {players[i]}
            </li>
          );
        })}
      </ol>
      <p className="hint">Each player gives one clue. Tap Next after each one, then talk it out.</p>

      <h2 className="section-title">Something go wrong?</h2>
      <Button variant="ghost" onClick={() => setConfirmRedeal(true)}>
        Redeal this round
      </Button>
      {confirmRedeal && (
        <Confirm
          title="Redeal this round?"
          message="Everyone gets a new card with a fresh word and fresh roles. Nothing is scored."
          confirmLabel="Redeal"
          onConfirm={() => {
            setConfirmRedeal(false);
            onRedeal();
          }}
          onCancel={() => setConfirmRedeal(false)}
        />
      )}
    </Screen>
  );
}

/* ---------- Vote ---------- */

interface VoteProps {
  players: string[];
  round: RoundState;
  k: number;
  /** Previous picks, when coming back from the reveal screen. */
  initial?: number[];
  /** Individual voting: the player holding the phone. They can't vote for themselves. */
  voter?: number;
  /** Tiebreak: only these players are on the ballot. */
  candidates?: number[];
  onReveal: (voted: number[]) => void;
}

export function VoteScreen({ players, round, k, initial, voter, candidates, onReveal }: VoteProps) {
  const [picked, setPicked] = useState<number[]>(initial ?? []);
  const toggle = (i: number) =>
    setPicked((p) => {
      if (p.includes(i)) return p.filter((x) => x !== i);
      if (k === 1) return [i];
      return p.length < k ? [...p, i] : p;
    });
  const isBallot = voter !== undefined;
  const isTiebreak = candidates !== undefined;
  const eligible = players
    .map((_, i) => i)
    .filter((i) => i !== voter && (!candidates || candidates.includes(i)));

  const title = isTiebreak
    ? `It's a tie. Pick ${k}.`
    : isBallot
      ? k > 1
        ? `${players[voter]}, pick ${k} suspects`
        : `${players[voter]}, who's the imposter?`
      : k > 1
        ? `Pick ${k} suspects`
        : "Who's the imposter?";

  const hint = isTiebreak
    ? 'The vote is tied between these players. The group decides out loud, then taps.'
    : isBallot
      ? 'Your vote is private. Tap your pick, then lock it in and pass the phone.'
      : 'The group decides out loud. Then tap the accused.';

  return (
    <Screen
      eyebrow={`Round ${roman(round.number)}${isBallot ? ' · Private vote' : ''}`}
      title={title}
      actions={
        <>
          <p className="hint" role="status">
            {picked.length} of {k} selected
          </p>
          <Button onClick={() => onReveal(picked)} disabled={picked.length !== k}>
            {isBallot ? 'Lock in my vote' : 'Reveal'}
          </Button>
        </>
      }
    >
      <p className="hint">{hint}</p>
      <ul className="tiles" role="group" aria-label="Players">
        {eligible.map((i) => {
          const name = players[i];
          const on = picked.includes(i);
          return (
            <li key={i}>
              <button type="button" className={`tile ${on ? 'is-selected' : ''}`} aria-pressed={on} onClick={() => toggle(i)}>
                {name}
              </button>
            </li>
          );
        })}
      </ul>
    </Screen>
  );
}

/* ---------- Reveal ---------- */

interface RevealProps {
  players: string[];
  round: RoundState;
  settings: Settings;
  voted: number[];
  /** Individual voting: every ballot cast, for the tally on screen. */
  ballots?: Ballot[];
  onBack: () => void;
  onDone: (guessed: Record<number, boolean>) => void;
}

export function RevealScreen({ players, round, settings, voted, ballots, onBack, onDone }: RevealProps) {
  const [wordShown, setWordShown] = useState(false);
  const [guessed, setGuessed] = useState<Record<number, boolean>>({});
  const { word } = round;
  const caught = round.imposterIndexes.filter((i) => voted.includes(i));
  const allMarked = caught.every((i) => i in guessed);

  if (round.troll) {
    return (
      <Screen className="screen--center" eyebrow={`Round ${roman(round.number)}`} actions={<Button onClick={() => onDone({})}>See scores</Button>}>
        <p className="lede">Troll round!</p>
        <BigText text="Everyone was the imposter" max={44} />
        <div className="card__lines">
          <p className="card__line">Category: {word.categoryName}</p>
          <p className="card__line">Hint: {word.hint}</p>
        </div>
        <p className="hint">No guessing, no points this round.</p>
      </Screen>
    );
  }

  return (
    <Screen
      eyebrow={`Round ${roman(round.number)}`}
      title="The reveal"
      actions={
        wordShown ? (
          <>
            {!allMarked && (
              <p className="hint" role="status">
                Mark each caught imposter's guess first.
              </p>
            )}
            <Button onClick={() => onDone(guessed)} disabled={!allMarked}>
              See scores
            </Button>
          </>
        ) : (
          <Button onClick={() => setWordShown(true)}>Show the word</Button>
        )
      }
    >
      <ul className="results">
        {round.imposterIndexes.map((i) => {
          const isCaught = voted.includes(i);
          return (
            <li key={i} className={`result ${isCaught ? 'result--caught' : 'result--escaped'}`}>
              <span className="result__name">{players[i]}</span>
              <span className="result__outcome">{isCaught ? 'Caught!' : 'Got away!'}</span>
            </li>
          );
        })}
      </ul>

      {caught.length > 0 && !wordShown && (
        <p className="note">Caught imposters, say your guess for the word out loud now.</p>
      )}

      {ballots && <VoteTally players={players} ballots={ballots} imposters={round.imposterIndexes} />}

      {!wordShown && !ballots && (
        <Button variant="ghost" onClick={onBack}>
          Back to vote
        </Button>
      )}

      {wordShown && (
        <div className="card card--reveal">
          <p className="lede">The word was</p>
          <BigText text={word.word} max={48} />
          <div className="card__lines">
            <p className="card__line">Category: {word.categoryName}</p>
            {settings.mode === 'undercover' &&
              round.imposterIndexes.map((i) => (
                <p key={i} className="card__line">
                  {players[i]}'s decoy: {word.decoy}
                </p>
              ))}
          </div>
        </div>
      )}

      {wordShown && caught.length > 0 && (
        <>
          <h2 className="section-title">Did they guess it?</h2>
          <ul className="guesses">
            {caught.map((i) => (
              <li key={i} className="guess">
                <span className="guess__name">{players[i]}</span>
                <div className="guess__buttons" role="group" aria-label={`${players[i]}'s guess`}>
                  <button
                    type="button"
                    className={`chip ${guessed[i] === true ? 'is-selected' : ''}`}
                    aria-pressed={guessed[i] === true}
                    onClick={() => setGuessed((g) => ({ ...g, [i]: true }))}
                  >
                    Got it
                  </button>
                  <button
                    type="button"
                    className={`chip ${guessed[i] === false ? 'is-selected' : ''}`}
                    aria-pressed={guessed[i] === false}
                    onClick={() => setGuessed((g) => ({ ...g, [i]: false }))}
                  >
                    Missed
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Screen>
  );
}

/* ---------- Scoreboard and final ---------- */

interface ScoreboardProps {
  players: string[];
  scores: number[];
  points: number[] | null;
  round: number;
  history: RoundRecord[];
  onNext: () => void;
  onSettings: () => void;
  onEnd: () => void;
}

export function ScoreboardScreen({ players, scores, points, round, history, onNext, onSettings, onEnd }: ScoreboardProps) {
  const rows = standings(scores);
  const [confirmEnd, setConfirmEnd] = useState(false);
  return (
    <Screen
      eyebrow={`After round ${roman(round)}`}
      title="Scoreboard"
      actions={
        <>
          <Button onClick={onNext}>Next round</Button>
          <div className="toolbar">
            <Button variant="secondary" onClick={onSettings}>
              Change settings
            </Button>
            <Button variant="ghost" onClick={() => setConfirmEnd(true)}>
              End game
            </Button>
          </div>
        </>
      }
    >
      <ScoreTable players={players} rows={rows} points={points} />
      {history.length > 0 && (
        <details className="details">
          <summary className="details__summary">Round history</summary>
          <ol className="history">
            {[...history].reverse().map((h) => (
              <li key={h.round} className="history__row">
                <span className="history__round">R{h.round}</span>
                <span className="history__body">
                  <span className="history__word">
                    {h.word} <span className="history__cat">· {h.category}</span>
                    {h.decoy && <span className="history__cat"> · decoy {h.decoy}</span>}
                  </span>
                  <span className="history__imp">
                    {h.troll
                      ? 'Troll round, everyone was the imposter'
                      : h.imposters
                          .map((i) => `${i.name} ${i.caught ? (i.guessed ? 'caught, guessed it' : 'caught') : 'got away'}`)
                          .join(' · ')}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
      {confirmEnd && (
        <Confirm
          title="End the game?"
          message="Final standings will be shown and the running game closes."
          confirmLabel="Final standings"
          onConfirm={onEnd}
          onCancel={() => setConfirmEnd(false)}
        />
      )}
    </Screen>
  );
}

export function FinalScreen({ players, scores, onNew }: { players: string[]; scores: number[]; onNew: () => void }) {
  const rows = standings(scores);
  const winners = rows.filter((r) => r.rank === 1).map((r) => players[r.index]);
  return (
    <Screen
      className="screen--final"
      eyebrow="Final standings"
      title={winners.length === 1 ? `${winners[0]} wins!` : `${winners.join(' & ')} tie!`}
      actions={<Button onClick={onNew}>New game</Button>}
    >
      <ScoreTable players={players} rows={rows} points={null} />
    </Screen>
  );
}

function ScoreTable({ players, rows, points }: { players: string[]; rows: ReturnType<typeof standings>; points: number[] | null }) {
  return (
    <ol className="scores">
      {rows.map((r) => (
        <li key={r.index} className={`score ${r.rank === 1 ? 'is-leader' : ''}`}>
          <span className="score__rank" aria-label={`Rank ${r.rank}`}>
            {r.rank}
          </span>
          <span className="score__name">{players[r.index]}</span>
          {points && (
            <span className="score__delta" aria-label={`${points[r.index]} points this round`}>
              {points[r.index] > 0 ? `+${points[r.index]}` : '0'}
            </span>
          )}
          <span className="score__total">{r.total}</span>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Individual voting tally ---------- */

function VoteTally({ players, ballots, imposters }: { players: string[]; ballots: Ballot[]; imposters: number[] }) {
  const counts = players.map((_, i) => ballots.reduce((n, b) => n + (b.picks.includes(i) ? 1 : 0), 0));
  const rows = players
    .map((name, i) => ({ i, name, count: counts[i], from: ballots.filter((b) => b.picks.includes(i)).map((b) => players[b.voter]) }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || a.i - b.i);
  return (
    <>
      <h2 className="section-title">The votes</h2>
      <ol className="votes">
        {rows.map((r) => (
          <li key={r.i} className={`vote ${imposters.includes(r.i) ? 'vote--imposter' : ''}`}>
            <span className="vote__count">{r.count}</span>
            <span className="vote__body">
              <span className="vote__name">{r.name}</span>
              <span className="vote__from">from {r.from.join(', ')}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="hint">Correct votes earn +1. Imposters earn nothing for their vote.</p>
    </>
  );
}

/* ---------- Shared ---------- */

function BigText({ text, max = 64 }: { text: string; max?: number }) {
  const { ref } = useFitText(text, max, 40);
  return (
    <div className="big" ref={ref}>
      {text}
    </div>
  );
}
