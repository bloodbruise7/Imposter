import { useState } from 'react';
import type { Category, Settings } from './game/types';
import { dealRoles } from './game/deal';
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
} from './app/model';
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
  | { kind: 'vote' }
  | { kind: 'reveal'; voted: number[] }
  | { kind: 'scoreboard'; points: number[] | null }
  | { kind: 'final' };

export function App() {
  const [custom, setCustom] = useState<Category[]>(loadCustomCategories);
  const [savedGame, setSavedGame] = useState<ActiveGame | null>(loadActiveGame);
  const [game, setGame] = useState<ActiveGame | null>(null);
  const [round, setRound] = useState<RoundState | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'setup' });

  const updateCustom = (list: Category[]) => {
    setCustom(list);
    saveCustomCategories(list);
  };

  const startRound = (g: ActiveGame) => {
    const pool = buildPool([...BUILTIN, ...custom], g.settings.categoryIds, g.settings.mode);
    const pick = pickWord(pool, g.playedIds);
    const deal = dealRoles({
      playerCount: g.players.length,
      imposters: g.settings.imposters,
      mode: g.settings.mode,
      trollMode: g.settings.trollMode,
    });
    setGame({ ...g, playedIds: pick.playedIds });
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
      : { players, settings, scores: players.map(() => 0), playedIds: [], round: 0 };
    startRound(g);
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
    const next: ActiveGame = {
      ...game,
      scores: game.scores.map((s, i) => s + points[i]),
      round: round.number,
      lastPoints: points,
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

  switch (screen.kind) {
    case 'handoff':
      return (
        <HandoffScreen
          key={screen.player}
          round={round.number}
          name={game.players[screen.player]}
          onShow={() => setScreen({ kind: 'card', player: screen.player })}
        />
      );
    case 'card':
      return (
        <CardScreen key={screen.player} round={round} settings={game.settings} playerIndex={screen.player} onHide={() => onHide(screen.player)} />
      );
    case 'clue':
      return (
        <ClueScreen players={game.players} round={round} timerMinutes={game.settings.timerMinutes} onVote={() => setScreen({ kind: 'vote' })} />
      );
    case 'vote':
      return (
        <VoteScreen players={game.players} round={round} k={game.settings.imposters} onReveal={(voted) => setScreen({ kind: 'reveal', voted })} />
      );
    case 'reveal':
      return (
        <RevealScreen
          players={game.players}
          round={round}
          settings={game.settings}
          voted={screen.voted}
          onDone={(guessed) => onRevealDone(guessed, screen.voted)}
        />
      );
  }
}
