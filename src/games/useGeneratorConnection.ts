import { useCallback, useEffect, useRef, useState } from "react";
import {
  GeneratorApiError,
  generatorRetryDelay,
  parseGeneratorHealth,
  parseGeneratorSession,
  requestGeneratorJson,
  type GeneratorStatus,
} from "./generator-connection";

export function useGeneratorConnection() {
  const [status, setStatus] = useState<GeneratorStatus>("checking");
  const [authenticationRequired, setAuthenticationRequired] = useState(false);
  const [failures, setFailures] = useState(0);
  const [checks, setChecks] = useState(0);
  const [changingAccess, setChangingAccess] = useState(false);
  const [accessError, setAccessError] = useState("");
  const checkController = useRef<AbortController | null>(null);

  const check = useCallback(async (showChecking = true) => {
    checkController.current?.abort();
    const controller = new AbortController();
    checkController.current = controller;
    if (showChecking) setStatus("checking");
    try {
      const session = parseGeneratorSession(
        await requestGeneratorJson(
          "/api/session",
          { signal: controller.signal },
          8_000,
        ),
      );
      if (controller.signal.aborted) return;
      setAuthenticationRequired(session.authenticationRequired);
      if (session.authenticationRequired && !session.authenticated) {
        setStatus("locked");
        setFailures(0);
        return;
      }
      const health = parseGeneratorHealth(
        await requestGeneratorJson(
          "/api/health",
          { signal: controller.signal },
          8_000,
        ),
      );
      if (controller.signal.aborted) return;
      setStatus(health.configured ? "online" : "unconfigured");
      setAccessError("");
      setFailures(0);
    } catch (error) {
      if (controller.signal.aborted) return;
      setStatus(
        error instanceof GeneratorApiError && error.kind === "locked"
          ? "locked"
          : "offline",
      );
      setFailures((n) => n + 1);
    } finally {
      if (!controller.signal.aborted) setChecks((n) => n + 1);
    }
  }, []);

  useEffect(() => {
    void check();
    return () => checkController.current?.abort();
  }, [check]);

  useEffect(() => {
    if (
      status !== "offline" &&
      status !== "online" &&
      status !== "unconfigured"
    )
      return;
    const timer = setTimeout(
      () => void check(false),
      status === "offline" ? generatorRetryDelay(failures) : 30_000,
    );
    return () => clearTimeout(timer);
  }, [status, failures, checks, check]);

  const request = useCallback(
    async (url: string, init: RequestInit = {}, timeoutMs?: number) => {
      try {
        return await requestGeneratorJson(url, init, timeoutMs);
      } catch (error) {
        if (
          !init.signal?.aborted &&
          error instanceof GeneratorApiError &&
          error.kind !== "request"
        ) {
          checkController.current?.abort();
          setStatus(error.kind === "locked" ? "locked" : "offline");
          setFailures((n) => n + 1);
        }
        throw error;
      }
    },
    [],
  );

  const unlock = useCallback(
    async (accessCode: string) => {
      setChangingAccess(true);
      setAccessError("");
      try {
        await request("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessCode }),
        });
        await check();
      } catch (error) {
        setAccessError(
          error instanceof GeneratorApiError && error.kind === "locked"
            ? "That code did not unlock the generator. Please try again."
            : error instanceof Error
              ? error.message
              : "Could not unlock the generator.",
        );
      } finally {
        setChangingAccess(false);
      }
    },
    [check, request],
  );

  const lock = useCallback(async () => {
    setChangingAccess(true);
    setAccessError("");
    try {
      await request("/api/session", { method: "DELETE" });
      await check();
    } catch (error) {
      setAccessError(
        error instanceof Error
          ? error.message
          : "Could not lock the generator.",
      );
    } finally {
      setChangingAccess(false);
    }
  }, [check, request]);

  return {
    status,
    authenticationRequired,
    changingAccess,
    accessError,
    check,
    request,
    unlock,
    lock,
  };
}
