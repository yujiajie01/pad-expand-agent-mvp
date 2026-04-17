import { CallbackHandler } from "langfuse-langchain";
import { appEnv } from "../config/env";

export function makeLangfuseCallback(
  traceId?: string,
): CallbackHandler | undefined {
  if (!appEnv.langfusePublicKey || !appEnv.langfuseSecretKey) {
    return undefined;
  }
  return new CallbackHandler({
    publicKey: appEnv.langfusePublicKey,
    secretKey: appEnv.langfuseSecretKey,
    baseUrl: appEnv.langfuseHost,
    ...(traceId ? { traceId } : {}),
  });
}
