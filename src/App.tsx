import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Category, Settings } from './game/types';
import { dealRoles, nextDroughts } from './game/deal';
import { pickFirstSpeaker } from './game/order';
import { scoreRound } from './game/scoring';
import { buildPool, pickWord } from './game/words';
import {
  BUILTIN,
  clearActiveGame,
  loadActiveGame,
  loadCustomCategories,
  saveActiveGame,
  saveCustomCategories,
  type ActiveGame,
  type RoundRecord,
} from './app/model';
import { unlockAudio } from './app/audio';
import { useWakeLock } from './app/hooks';
import { Confirm } from './components/ui';
import { SetupScreen } from './screens/SetupScreen';
import {
  CardScreen,
  ClueScreen,
  FinalScreen,
  HandoffScreen,
  RevealScreen,
  ScoreboardScreen,
  VoteScreen,
  type RoundState,
} from './screens/RoundScreens';

type Screen =
  | { kind: 'setup' }
  | { kind: 'handoff'; player: number }
  | { kind: 'card'; player: number }
  | { kind: 'clue' }
  | { kind: 'vote'; picked?: number[] }
  | { kind: 'reveal'; voted: number[] }
  | { kind: 'scoreboard'; points: number[] | null }
  | { kind: 'final' };

const ROUND_SCREENS = new Set(['handoff', 'card', 'clue', 'vote', 'reveal']);

export function App() {
  const [custom, setCustom] = useState<Category[]>(loadCustomCategories);
  const [savedGame, setSavedGame] = useState<ActiveGame | null>(loadActiveGame);
  const [game, setGame] = useState<ActiveGame | null>(null);
  const [round, setRound] = useState<RoundState | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'setup' });
  const [leaveAsk, setLeaveAsk] = useState(false);
  /** The game as it stood before the current round was dealt, so a redeal can start clean. */
  const preRound = useRef<ActiveGame | null>(null);

  const inRound = ROUND_SCREENS.has(screen.kind);
  useWakeLock(inRound);

  // Browsers only allow sound after a gesture; arm the audio context on the first tap.
  useEffect(() => {
    const unlock = () => unlockAudio();
    const opts = { passive: true } as const;
    window.addEventListener('pointerdown', unlock, opts);
    window.addEventListener('keydown', unlock, opts);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Mid-round, the Back button and reload would drop the round. Guard both.
  useEffect(() => {
    if (!inRound) return;
    history.pushState({ imposterRound: true }, '');
    const onPop = () => {
      history.pushState({ imposterRound: true }, '');
      setLeaveAsk(true);
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('beforeunload', onUnload);
      setLeaveAsk(false);
      if ((history.state as { imposterRound?: boolean } | null)?.imposterRound) history.back();
    };
  }, [inRound]);

  const updateCustom = (list: Category[]) => {
    setCustom(list);
    saveCustomCategories(list);
  };

  const startRound = (g: ActiveGame) => {
    preRound.current = g;
    const pool = buildPool([...BUILTIN, ...custom], g.settings.categoryIds, g.settings.mode);
    const pick = pickWord(pool, g.playedIds);
    const droughts = g.droughts ?? g.players.map(() => 0);
    const deal = dealRoles({
      playerCount: g.players.length,
      imposters: g.settings.imposters,
      mode: g.settings.mode,
      trollMode: g.settings.trollMode,
      droughts,
    });
    setGame({ ...g, playedIds: pick.playedIds, droughts: nextDroughts(droughts, deal) });
    setRound({
      number: g.round + 1,
      word: pick.word,
      imposterIndexes: deal.imposterIndexes,
      troll: deal.troll,
      first: pickFirstSpeaker(g.players.length),
      reshuffled: pick.reshuffled,
    });
    setScreen({ kind: 'handoff', player: 0 });
  };

  const onStart = (players: string[], settings: Settings) => {
    setSavedGame(null);
    const g: ActiveGame = game
      ? { ...game, settings }
      : { players, settings, scores: players.map(() => 0), playedIds: [], round: 0, history: [] };
    startRound(g);
  };

  /** Same players and settings, fresh word and roles. The burnt word stays played. */
  const onRedeal = () => {
    if (!game || !preRound.current) return;
    startRound({ ...preRound.current, playedIds: game.playedIds });
  };

  /** Abandon the current round: back to the last scoreboard, or Setup if none. */
  const onLeaveRound = () => {
    setLeaveAsk(false);
    const base = preRound.current;
    setRound(null);
    if (base && base.round > 0) {
      setGame(base);
      setScreen({ kind: 'scoreboard', points: base.lastPoints ?? null });
    } else {
      setGame(null);
      setScreen({ kind: 'setup' });
    }
  };

  const onHide = (player: number) => {
    if (!game) return;
    if (player + 1 < game.players.length) setScreen({ kind: 'handoff', player: player + 1 });
    else setScreen({ kind: 'clue' });
  };

  const onRevealDone = (guessed: Record<number, boolean>, voted: number[]) => {
    if (!game || !round) return;
    const points = scoreRound({
      playerCount: game.players.length,
      imposterIndexes: round.imposterIndexes,
      votedIndexes: voted,
      guessed,
      troll: round.troll,
    });
    const record: RoundRecord = {
      round: round.number,
      word: round.word.word,
      category: round.word.categoryName,
      decoy: game.settings.mode === 'undercover' ? round.word.decoy : undefined,
      troll: round.troll,
      imposters: round.troll
        ? []
        : round.imposterIndexes.map((i) => ({
            name: game.players[i],
            caught: voted.includes(i),
            guessed: voted.includes(i) ? guessed[i] === true : undefined,
          })),
    };
    const next: ActiveGame = {
      ...game,
      scores: game.scores.map((s, i) => s + points[i]),
      round: round.number,
      lastPoints: points,
      history: [...(game.history ?? []), record],
    };
    setGame(next);
    saveActiveGame(next);
    setScreen({ kind: 'scoreboard', points });
  };

  const onResume = () => {
    if (!savedGame) return;
    setGame(savedGame);
    setSavedGame(null);
    setScreen({ kind: 'scoreboard', points: savedGame.lastPoints ?? null });
  };

  const onDiscard = () => {
    clearActiveGame();
    setSavedGame(null);
  };

  const onEnd = () => {
    clearActiveGame();
    setScreen({ kind: 'final' });
  };

  const onNewGame = () => {
    setGame(null);
    setRound(null);
    setScreen({ kind: 'setup' });
  };

  const leaveDialog = leaveAsk && (
    <Confirm
      title="Leave this round?"
      message="This round won't count. Scores from finished rounds are kept."
      confirmLabel="Leave round"
      danger
      onConfirm={onLeaveRound}
      onCancel={() => setLeaveAsk(false)}
    />
  );

  if (screen.kind === 'setup') {
    return (
      <SetupScreen
        builtin={BUILTIN}
        custom={custom}
        onCustomChange={updateCustom}
        savedGame={savedGame}
        onResume={onResume}
        onDiscard={onDiscard}
        activeGame={game}
        onResetGame={() => {
          clearActiveGame();
          setGame(null);
        }}
        onStart={onStart}
      />
    );
  }

  if (!game) return null;

  if (screen.kind === 'scoreboard') {
    return (
      <ScoreboardScreen
        players={game.players}
        scores={game.scores}
        points={screen.points}
        round={game.round}
        history={game.history ?? []}
        onNext={() => startRound(game)}
        onSettings={() => setScreen({ kind: 'setup' })}
        onEnd={onEnd}
      />
    );
  }

  if (screen.kind === 'final') {
    return <FinalScreen players={game.players} scores={game.scores} onNew={onNewGame} />;
  }

  if (!round) return null;

  let body: ReactNode = null;
  switch (screen.kind) {
    case 'handoff':
      body = (
        <HandoffScreen
          key={screen.player}
          round={round.number}
          name={game.players[screen.player]}
          onShow={() => setScreen({ kind: 'card', player: screen.player })}
        />
      );
      break;
    case 'card':
      body = (
        <CardScreen key={screen.player} round={round} settings={game.settings} playerIndex={screen.player} onHide={() => onHide(screen.player)} />
      );
      break;
    case 'clue':
      body = (
        <ClueScreen
          players={game.players}
          round={round}
          timerMinutes={game.settings.timerMinutes}
          onVote={() => setScreen({ kind: 'vote' })}
          onRedeal={onRedeal}
        />
      );
      break;
    case 'vote':
      body = (
        <VoteScreen
          players={game.players}
          round={round}
          k={game.settings.imposters}
          initial={screen.picked}
          onReveal={(voted) => setScreen({ kind: 'reveal', voted })}
        />
      );
      break;
    case 'reveal':
      body = (
        <RevealScreen
          players={game.players}
          round={round}
          settings={game.settings}
          voted={screen.voted}
          onBack={() => setScreen({ kind: 'vote', picked: screen.voted })}
          onDone={(guessed) => onRevealDone(guessed, screen.voted)}
        />
      );
      break;
  }

  return (
    <>
      {body}
      {leaveDialog}
    </>
  );
}
