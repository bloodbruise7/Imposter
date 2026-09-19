import { useEffect, useState } from 'react';
import type { PoolWord, Settings } from '../game/types';
import { speakingOrder } from '../game/order';
import { standings } from '../game/scoring';
import { Button, Confirm, Screen } from '../components/ui';
import { useCountdown, useDelay, useFitText, useWakeLock, vibrate } from '../app/hooks';

export interface RoundState {
  number: number;
  word: PoolWord;
  imposterIndexes: number[];
  troll: boolean;
  first: number;
  reshuffled: boolean;
}

/* ---------- Hand-off ---------- */

export function HandoffScreen({ round, name, onShow }: { round: number; name: string; onShow: () => void }) {
  return (
    <Screen className="screen--center" eyebrow={`Round ${round}`}>
      <p className="lede">Pass the phone to</p>
      <BigText text={name} />
      <div className="screen__actions screen__actions--inline">
        <Button onClick={onShow}>I'm {name}, show my card</Button>
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
    <Screen className="screen--center" eyebrow={`Round ${round.number}`}>
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
}

export function ClueScreen({ players, round, timerMinutes, onVote }: ClueProps) {
  useWakeLock();
  const total = timerMinutes * 60;
  const timer = useCountdown(total, true);
  const order = speakingOrder(players.length, round.first);

  useEffect(() => {
    if (timer.done) vibrate([200, 100, 200]);
  }, [timer.done]);

  const mm = Math.floor(timer.remaining / 60);
  const ss = String(timer.remaining % 60).padStart(2, '0');

  return (
    <Screen
      eyebrow={`Round ${round.number}`}
      title={
        <>
          <span className="accent">{players[round.first]}</span> goes first
        </>
      }
      actions={
        <div className="toolbar">
          {total > 0 && !timer.done && (
            <Button variant="ghost" onClick={timer.running ? timer.pause : timer.resume}>
              {timer.running ? 'Pause' : 'Resume'}
            </Button>
          )}
          <Button variant={total > 0 && !timer.done ? 'secondary' : 'primary'} onClick={onVote}>
            Vote now
          </Button>
        </div>
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
      <ol className="order">
        {order.map((i, n) => (
          <li key={i} className={n === 0 ? 'is-first' : ''}>
            <span className="order__num" aria-hidden="true">
              {n + 1}
            </span>
            {players[i]}
          </li>
        ))}
      </ol>
      <p className="hint">Each player gives one clue in this order. Then talk it out.</p>
    </Screen>
  );
}

/* ---------- Vote ---------- */

interface VoteProps {
  players: string[];
  round: RoundState;
  k: number;
  onReveal: (voted: number[]) => void;
}

export function VoteScreen({ players, round, k, onReveal }: VoteProps) {
  const [picked, setPicked] = useState<number[]>([]);
  const toggle = (i: number) =>
    setPicked((p) => {
      if (p.includes(i)) return p.filter((x) => x !== i);
      if (k === 1) return [i];
      return p.length < k ? [...p, i] : p;
    });

  return (
    <Screen
      eyebrow={`Round ${round.number}`}
      title={k > 1 ? `Pick ${k} suspects` : "Who's the imposter?"}
      actions={
        <>
          <p className="hint" role="status">
            {picked.length} of {k} selected
          </p>
          <Button onClick={() => onReveal(picked)} disabled={picked.length !== k}>
            Reveal
          </Button>
        </>
      }
    >
      <p className="hint">The group decides out loud. Then tap the accused.</p>
      <ul className="tiles" role="group" aria-label="Players">
        {players.map((name, i) => {
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
  onDone: (guessed: Record<number, boolean>) => void;
}

export function RevealScreen({ players, round, settings, voted, onDone }: RevealProps) {
  const [wordShown, setWordShown] = useState(false);
  const [guessed, setGuessed] = useState<Record<number, boolean>>({});
  const { word } = round;
  const caught = round.imposterIndexes.filter((i) => voted.includes(i));
  const allMarked = caught.every((i) => i in guessed);

  if (round.troll) {
    return (
      <Screen className="screen--center" eyebrow={`Round ${round.number}`} actions={<Button onClick={() => onDone({})}>See scores</Button>}>
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
      eyebrow={`Round ${round.number}`}
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
  onNext: () => void;
  onSettings: () => void;
  onEnd: () => void;
}

export function ScoreboardScreen({ players, scores, points, round, onNext, onSettings, onEnd }: ScoreboardProps) {
  const rows = standings(scores);
  const [confirmEnd, setConfirmEnd] = useState(false);
  return (
    <Screen
      eyebrow={`After round ${round}`}
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
      {confirmEnd && (
        <Confirm
          title="End the game?"
          message="Final standings will be shown and the running game closes."
          confirmLabel="Show final standings"
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

/* ---------- Shared ---------- */

function BigText({ text, max = 64 }: { text: string; max?: number }) {
  const { ref } = useFitText(text, max, 40);
  return (
    <div className="big" ref={ref}>
      {text}
    </div>
  );
}
