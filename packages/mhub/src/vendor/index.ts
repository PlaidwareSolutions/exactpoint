/**
 * @plaidware/mhub-sdk — events & attribution SDK for Plaidware-built client
 * apps (DESIGN §4.3). Ships in every client app; marketing becomes an upsell
 * toggle, not an integration project.
 *
 *   const mhub = new MhubClient({ apiKey: process.env.MHUB_EVENTS_KEY!,
 *                                 baseUrl: 'https://marketing.plaidware.com/api/v1' });
 *   mhub.emit('lead', { externalLeadId: booking.id,
 *                       attrs: { service_type: 'ac_repair', ...readAttribution(req, {secret}) } });
 */
export { MhubClient, type MhubClientOptions, type EmitInput, type FlushResult } from './client';
export { filterAttrs, PII_TOKEN } from './pii';
export {
  attributionMiddleware,
  readAttribution,
  deriveAttribution,
  signAttribution,
  verifyAttribution,
  type AttributionOptions,
  type CapturedAttribution,
} from './middleware';
