/**
 * Holds the recovery phrase while the user walks through create → back up →
 * verify → set passcode.
 *
 * Deliberately a module-level variable rather than a router param: params end
 * up in deep-link URLs, navigation state, and crash reports, and a recovery
 * phrase must not appear in any of them. Cleared the moment onboarding
 * finishes or is abandoned.
 */

let draftPhrase: string | null = null;

export function setDraftPhrase(phrase: string): void {
  draftPhrase = phrase;
}

/** Returns the pending phrase, or null when onboarding is not in progress. */
export function getDraftPhrase(): string | null {
  return draftPhrase;
}

export function clearDraftPhrase(): void {
  draftPhrase = null;
}
