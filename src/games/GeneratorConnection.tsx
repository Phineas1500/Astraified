import { useState } from "react";
import { Check, KeyRound, LoaderCircle, Radio, RefreshCw } from "lucide-react";
import type { useGeneratorConnection } from "./useGeneratorConnection";

type Connection = ReturnType<typeof useGeneratorConnection>;
const copy = {
  checking: [
    "Connecting to the workshop…",
    "Checking whether the generator is ready.",
  ],
  online: [
    "Ready to create",
    "Bring an idea. The workshop is ready for your next adventure.",
  ],
  locked: [
    "Private creation access",
    "Enter the shared access code to create an adventure. Your library is ready to play.",
  ],
  offline: [
    "The workshop is offline",
    "New adventures need the host’s laptop online. You can still play the adventures in your library.",
  ],
  unconfigured: [
    "The workshop needs a little setup",
    "The host needs to configure the generator before new adventures can be made. Your library is ready to play.",
  ],
} as const;

export function GeneratorConnection({
  connection,
}: {
  connection: Connection;
}) {
  const [accessCode, setAccessCode] = useState("");
  const {
    status,
    authenticationRequired,
    changingAccess,
    accessError,
    check,
    unlock,
    lock,
  } = connection;
  const [title, description] = copy[status];
  const Icon =
    status === "checking"
      ? LoaderCircle
      : status === "online"
        ? Check
        : status === "locked"
          ? KeyRound
          : Radio;
  async function submitCode() {
    if (!accessCode.trim() || changingAccess) return;
    const submitted = accessCode;
    setAccessCode("");
    await unlock(submitted);
  }
  return (
    <section
      className={`ep-generator-connection ep-generator-${status}`}
      aria-label="Adventure generator"
    >
      <div className="ep-generator-heading" role="status" aria-live="polite">
        <Icon
          size={17}
          className={status === "checking" ? "ep-spin" : ""}
          aria-hidden="true"
        />
        <strong>{title}</strong>
      </div>
      <p>{description}</p>
      {status === "locked" && (
        <div className="ep-generator-unlock">
          <label htmlFor="ep-access-code">Creation access code</label>
          <div className="ep-generator-code-row">
            <input
              id="ep-access-code"
              type="password"
              autoComplete="off"
              maxLength={512}
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submitCode();
                }
              }}
              disabled={changingAccess}
              placeholder="Enter your code"
              aria-describedby={accessError ? "ep-access-error" : undefined}
            />
            <button
              type="button"
              className="ep-secondary"
              onClick={() => void submitCode()}
              disabled={changingAccess || !accessCode.trim()}
            >
              {changingAccess ? "Unlocking…" : "Unlock creation"}
            </button>
          </div>
        </div>
      )}
      {accessError && (
        <p
          id="ep-access-error"
          className="ep-generator-access-error"
          role="alert"
        >
          {accessError}
        </p>
      )}
      {(status === "offline" ||
        status === "unconfigured" ||
        status === "locked") && (
        <button
          type="button"
          className="ep-generator-link"
          onClick={() => void check()}
          disabled={changingAccess}
        >
          <RefreshCw size={13} /> Check again
        </button>
      )}
      {status === "online" && authenticationRequired && (
        <button
          type="button"
          className="ep-generator-link"
          onClick={() => void lock()}
          disabled={changingAccess}
        >
          {changingAccess ? "Locking…" : "Lock creation on this browser"}
        </button>
      )}
    </section>
  );
}
