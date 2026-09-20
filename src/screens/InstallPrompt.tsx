import { useId, useState } from 'react';
import { Button, Modal } from '../components/ui';
import { isIOS, type BeforeInstallPromptEvent } from '../app/install';

interface Props {
  /** The captured beforeinstallprompt event, when the browser offers one. */
  deferred: BeforeInstallPromptEvent | null;
  /** Called when the prompt closes, with whether "Don't ask me again" was ticked. */
  onClose: (never: boolean) => void;
}

export function InstallPrompt({ deferred, onClose }: Props) {
  const [never, setNever] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const checkId = useId();
  const ios = isIOS();

  const yes = async () => {
    if (deferred) {
      try {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        // Accepted: the app opens installed next time, so there is nothing more to ask.
        onClose(choice.outcome === 'accepted' ? true : never);
        return;
      } catch {
        /* fall through to instructions */
      }
    }
    setShowHow(true);
  };

  if (showHow) {
    return (
      <Modal center title="Add to your home screen" onClose={() => onClose(never)} actions={<Button onClick={() => onClose(never)}>Got it</Button>}>
        {ios ? (
          <ol className="rules">
            <li>
              Tap the <strong>Share</strong> button at the bottom of Safari (the square with an arrow).
            </li>
            <li>
              Scroll down and tap <strong>Add to Home Screen</strong>.
            </li>
            <li>
              Tap <strong>Add</strong>. Imposter will open full screen from your home screen.
            </li>
          </ol>
        ) : (
          <ol className="rules">
            <li>
              Open your browser's menu (the three dots or lines).
            </li>
            <li>
              Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
            </li>
            <li>Confirm. Imposter will open full screen from your home screen.</li>
          </ol>
        )}
      </Modal>
    );
  }

  return (
    <Modal
      center
      title="Keep Imposter on your phone?"
      onClose={() => onClose(never)}
      actions={
        <>
          <Button variant="secondary" onClick={() => onClose(never)}>
            No
          </Button>
          <Button onClick={yes}>Yes</Button>
        </>
      }
    >
      <p>Add it to your home screen for a full-screen game with no browser bar. It works offline too, and takes no space to speak of.</p>
      <label className="check">
        <input id={checkId} type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} />
        <span>Don't ask me again</span>
      </label>
    </Modal>
  );
}
