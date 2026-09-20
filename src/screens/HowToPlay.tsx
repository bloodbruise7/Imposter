import { Button, Modal } from '../components/ui';
import { CATCH_POINTS, ESCAPE_POINTS, GUESS_POINTS } from '../game/scoring';

export function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How to play" onClose={onClose} actions={<Button onClick={onClose}>Got it</Button>}>
      <ol className="rules">
        <li>Pass the phone around. Everyone sees a secret word, except the imposter.</li>
        <li>
          In <strong>Classic</strong>, the imposter knows they are the imposter and gets a clue. In{' '}
          <strong>Undercover</strong>, the imposter gets a similar decoy word and does not know.
        </li>
        <li>Starting with the player the app picks, everyone says one word or short clue about the secret word. Vague enough to fool the imposter, clear enough to prove you know it.</li>
        <li>Talk it out, then tap the player the group accuses.</li>
        <li>Catching the imposter scores for the whole crew. A caught imposter then gets one shot to guess the word out loud for points of their own.</li>
      </ol>
      <h3 className="modal__subtitle">Scoring, per imposter</h3>
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Outcome</th>
            <th scope="col">Points</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Got away</td>
            <td>Imposter +{ESCAPE_POINTS}</td>
          </tr>
          <tr>
            <td>Caught</td>
            <td>Every crew member +{CATCH_POINTS}</td>
          </tr>
          <tr>
            <td>Caught, then guessed the word</td>
            <td>Imposter also +{GUESS_POINTS}</td>
          </tr>
          <tr>
            <td>Caught, then missed</td>
            <td>Imposter nothing</td>
          </tr>
        </tbody>
      </table>
      <p className="hint">
        Troll rounds (everyone is the imposter) score nothing. The game runs until you end it. The imposter draw is random
        but leans toward players who haven't been it in a while, so nobody waits forever.
      </p>
    </Modal>
  );
}
