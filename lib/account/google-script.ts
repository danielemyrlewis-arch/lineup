export const GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const SCRIPT_ID = "lineup-google-identity-script";
const LOAD_ERROR = "Google sign-in couldn’t load. Please check browser restrictions and try again. Guest play is still available.";

export interface GoogleIdentityConfiguration {
  client_id: string;
  callback: (response: unknown) => void;
  nonce: string;
  ux_mode: "popup";
  auto_select: false;
  button_auto_select?: false;
  use_fedcm_for_button?: boolean;
}

export interface GoogleButtonConfiguration {
  type: "standard";
  theme: "filled_black" | "outline";
  size: "large";
  text: "continue_with" | "signin_with";
  shape: "rectangular";
  width: number;
  click_listener: () => void;
}

/** Only supported GIS ID-button methods are exposed; One Tap is never requested. */
export interface GoogleIdentityApi {
  initialize: (configuration: GoogleIdentityConfiguration) => void;
  renderButton: (parent: HTMLElement, configuration: GoogleButtonConfiguration) => void;
  disableAutoSelect: () => void;
}

/** The Web client ID is public, inlined by Next into the static browser bundle. */
export function getGoogleClientId(): string | null {
  const value = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  return value && value.length < 1024 && /^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(value)
    ? value : null;
}

const loads = new WeakMap<Document, Promise<GoogleIdentityApi>>();
const browserIdentity = (): GoogleIdentityApi | undefined => {
  if (typeof window === "undefined") return undefined;
  return (window as Window & {google?: {accounts?: {id?: GoogleIdentityApi}}}).google?.accounts?.id;
};
const isReady = (api: GoogleIdentityApi | undefined): api is GoogleIdentityApi =>
  !!api && typeof api.initialize === "function" && typeof api.renderButton === "function" && typeof api.disableAutoSelect === "function";

/** One shared script load per document; failures retry only after another explicit call. */
export function loadGoogleIdentity(
  documentArg?: Document,
  getIdentity: () => GoogleIdentityApi | undefined = browserIdentity,
  timeoutMs = 10_000,
): Promise<GoogleIdentityApi> {
  const doc = documentArg ?? (typeof document !== "undefined" ? document : undefined);
  if (!doc) return Promise.reject(new Error(LOAD_ERROR));
  const cached = loads.get(doc);
  if (cached) return cached;
  try {
    const ready = getIdentity();
    if (isReady(ready)) return Promise.resolve(ready);
  } catch { return Promise.reject(new Error(LOAD_ERROR)); }

  let begin!: () => void;
  const promise = new Promise<GoogleIdentityApi>((resolve, reject) => {
    begin = () => {
      let script: HTMLScriptElement | null = null;
      let created = false;
      let finished = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const clean = () => {
        clearTimeout(timer);
        script?.removeEventListener("load", loaded);
        script?.removeEventListener("error", failed);
      };
      const failed = () => {
        if (finished) return;
        finished = true;
        clean();
        loads.delete(doc);
        if (created) script?.remove();
        reject(new Error(LOAD_ERROR));
      };
      const loaded = () => {
        if (finished) return;
        try {
          const ready = getIdentity();
          if (!isReady(ready)) { failed(); return; }
          finished = true;
          clean();
          resolve(ready);
        } catch { failed(); }
      };
      try {
        script = doc.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
        if (script) {
          const source = new URL(script.src, doc.baseURI);
          if (script.tagName !== "SCRIPT" || source.origin !== "https://accounts.google.com" || source.pathname !== "/gsi/client") {
            failed(); return;
          }
        } else {
          script = doc.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_URL}"]`);
        }
        if (!script) {
          script = doc.createElement("script");
          created = true;
          script.id = SCRIPT_ID;
          script.src = GIS_SCRIPT_URL;
          script.async = true;
          script.defer = true;
        }
        script.addEventListener("load", loaded);
        script.addEventListener("error", failed);
        timer = setTimeout(failed, timeoutMs);
        if (created) (doc.head ?? doc.body).appendChild(script);
      } catch { failed(); }
    };
  });
  // Cache before appendChild: even a synchronous DOM error can safely clear it.
  loads.set(doc, promise);
  begin();
  return promise;
}
