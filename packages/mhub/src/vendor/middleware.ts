import crypto from 'node:crypto';

/**
 * First-touch attribution capture (DESIGN §4.3): Express-compatible middleware
 * that, on a visitor's FIRST landing, derives source/campaign from UTM params
 * (or gclid/fbclid/referrer) and stores it in a signed, httpOnly cookie so the
 * booking flow can attach it to `lead.created`. Structurally typed — no
 * dependency on express itself.
 */

export interface CapturedAttribution {
  source?: string;
  campaign?: string;
  channel?: string;
  utm?: Record<string, string>;
  landed_at: string;
}

interface ReqLike {
  query?: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
}
interface ResLike {
  cookie(name: string, value: string, opts: Record<string, unknown>): unknown;
}

export interface AttributionOptions {
  /** HMAC secret for cookie integrity (any stable app secret). */
  secret: string;
  cookieName?: string; // default 'mhub_attr'
  maxAgeDays?: number; // default 90
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

export function deriveAttribution(query: Record<string, unknown>, referrer?: string): CapturedAttribution | null {
  const utm: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const value = query[key];
    if (typeof value === 'string' && value) utm[key] = value;
  }
  const gclid = typeof query.gclid === 'string';
  const fbclid = typeof query.fbclid === 'string';

  let source: string | undefined;
  let channel: string | undefined;
  if (utm.utm_source) {
    source = utm.utm_source;
    channel = utm.utm_medium === 'cpc' && /google/i.test(utm.utm_source) ? 'google_ads' : utm.utm_medium;
  } else if (gclid) {
    source = 'google';
    channel = 'google_ads';
  } else if (fbclid) {
    source = 'facebook';
    channel = 'meta';
  } else if (referrer) {
    try {
      const host = new URL(referrer).hostname;
      if (/google\./i.test(host)) [source, channel] = ['google', 'google_organic'];
      else if (/facebook\.|instagram\./i.test(host)) [source, channel] = ['facebook', 'meta_organic'];
      else if (/bing\./i.test(host)) [source, channel] = ['bing', 'bing_organic'];
      else [source, channel] = [host, 'referral'];
    } catch {
      return null;
    }
  } else {
    return null; // direct visit with no signal — leave untouched
  }
  return {
    source,
    channel,
    campaign: utm.utm_campaign,
    utm: Object.keys(utm).length > 0 ? utm : undefined,
    landed_at: new Date().toISOString(),
  };
}

export function signAttribution(data: CapturedAttribution, secret: string): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `v1.${payload}.${sig}`;
}

export function verifyAttribution(cookieValue: string | undefined, secret: string): CapturedAttribution | null {
  if (!cookieValue) return null;
  const [version, payload, sig] = cookieValue.split('.');
  if (version !== 'v1' || !payload || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as CapturedAttribution;
  } catch {
    return null;
  }
}

/** Express-style middleware. First touch wins — never overwrites an existing cookie. */
export function attributionMiddleware(options: AttributionOptions) {
  const cookieName = options.cookieName ?? 'mhub_attr';
  const maxAgeMs = (options.maxAgeDays ?? 90) * 24 * 3600 * 1000;
  return (req: ReqLike, res: ResLike, next: () => void): void => {
    try {
      const existing = req.cookies?.[cookieName];
      if (!existing || !verifyAttribution(existing, options.secret)) {
        const referrer = (req.headers.referer ?? req.headers.referrer) as string | undefined;
        const captured = deriveAttribution(req.query ?? {}, referrer);
        if (captured) {
          res.cookie(cookieName, signAttribution(captured, options.secret), {
            httpOnly: true,
            sameSite: 'lax',
            maxAge: maxAgeMs,
          });
          // make it available to this request too
          (req as ReqLike & { mhubAttribution?: CapturedAttribution }).mhubAttribution = captured;
        }
      }
    } catch {
      // attribution must never break the host app
    }
    next();
  };
}

/** Read the visitor's captured attribution (for attaching to lead.created). */
export function readAttribution(req: ReqLike, options: AttributionOptions): CapturedAttribution | null {
  const inline = (req as ReqLike & { mhubAttribution?: CapturedAttribution }).mhubAttribution;
  if (inline) return inline;
  return verifyAttribution(req.cookies?.[options.cookieName ?? 'mhub_attr'], options.secret);
}
