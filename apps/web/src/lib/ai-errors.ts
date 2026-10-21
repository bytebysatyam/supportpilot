const messages: Record<string, string> = {
  AI_PROVIDER_RATE_LIMITED:
    "The AI provider is rate-limited. Wait a little before trying again.",
  AI_PROVIDER_UNAVAILABLE:
    "The AI provider is temporarily unavailable. Please try again later.",
  AI_PROVIDER_TIMEOUT:
    "The AI provider took too long to respond. Please try again.",
  AI_PROVIDER_AUTH_ERROR:
    "AI authentication failed. Ask an administrator to check the provider configuration.",
  AI_PROVIDER_MODEL_UNAVAILABLE:
    "The configured AI model is unavailable. Ask an administrator to check the model.",
  AI_PROVIDER_CONFIGURATION_CHANGED:
    "The AI configuration changed while this job was queued. Request a new analysis.",
  AI_PROVIDER_CONFIGURATION_ERROR:
    "AI configuration is incomplete. Ask an administrator to check it.",
  AI_PROVIDER_INVALID_REQUEST:
    "The AI provider rejected the request. Ask an administrator to check the configuration.",
  AI_PROVIDER_BLOCKED:
    "The AI provider could not process this content. Review the ticket before trying again.",
  AI_PROVIDER_TRUNCATED: "The AI response was incomplete. Please try again.",
  AI_PROVIDER_DISABLED: "AI is not configured for this workspace.",
  QUEUE_ENQUEUE_FAILED:
    "AI could not be queued. Check worker and Redis availability, then try again.",
};
export function aiFailureMessage(code: string | null) {
  return (
    (code && messages[code]) ||
    "The analysis could not finish. Check provider and worker availability, then request it again."
  );
}
