"use client";

import { useRef, useState } from "react";
import { BUSINESS } from "@exactpoint/domain";
import {
  getBookingWindows,
  holdSelectedSlot,
  submitBooking,
  validateBookingAddress,
  type AddressCheckResult,
} from "@/lib/booking/actions";
import type { BookableWindow, OfferedWindow } from "@/lib/booking/windows";

export interface ServiceOption {
  slug: string;
  name: string;
  category: string;
}

interface UploadedPhoto {
  id: string;
  name: string;
}

const STEPS = ["Service", "Problem", "Photos", "Contact", "Address", "Time", "Review"] as const;

const inputCls =
  "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-navy placeholder:text-slate/60 focus:border-point focus:outline-none";
const labelCls = "block text-sm font-semibold text-navy";
const primaryBtn =
  "rounded-xl bg-point px-6 py-3 font-bold text-white transition hover:bg-point-deep disabled:opacity-50";
const secondaryBtn =
  "rounded-xl border border-line bg-white px-6 py-3 font-bold text-navy transition hover:border-point";

export function BookingForm({
  services,
  windows,
  preselectedService,
}: {
  services: ServiceOption[];
  windows: OfferedWindow[];
  preselectedService?: string;
}) {
  const validPreselect = services.some((s) => s.slug === preselectedService)
    ? preselectedService!
    : "";
  const [step, setStep] = useState(validPreselect ? 1 : 0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState(false);

  const [service, setService] = useState(validPreselect);
  const [serviceOther, setServiceOther] = useState("");
  const [problem, setProblem] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [street, setStreet] = useState("");
  const [unit, setUnit] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [addressCheck, setAddressCheck] = useState<AddressCheckResult | null>(null);
  const [picked, setPicked] = useState<BookableWindow[]>([]);
  const [liveWindows, setLiveWindows] = useState<BookableWindow[] | null>(null);
  const [engineBacked, setEngineBacked] = useState(false);
  const [hold, setHold] = useState<{ holdId: string; expiresAt: string } | null>(null);
  const [feeAck, setFeeAck] = useState(false);
  const honeypotRef = useRef<HTMLInputElement>(null);

  const shownWindows: BookableWindow[] = liveWindows ?? windows;

  function next() {
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    for (const file of Array.from(files).slice(0, 6 - photos.length)) {
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/booking/photos", { method: "POST", body: form });
        const body = (await res.json()) as { id?: string; error?: string };
        if (res.ok && body.id) {
          setPhotos((p) => [...p, { id: body.id!, name: file.name }]);
        } else {
          setError(body.error ?? "Upload failed.");
        }
      } catch {
        setError("Upload failed. You can continue without photos.");
      }
    }
    setUploading(false);
  }

  async function checkAddress() {
    setBusy(true);
    setError(null);
    const result = await validateBookingAddress({ street, unit, city, state: "TX", zip });
    setAddressCheck(result);
    if (!result.ok) {
      setBusy(false);
      setError(result.message ?? "We could not confirm this address. Please review it.");
      return;
    }
    const offered = await getBookingWindows({
      serviceTypeSlug: service,
      zoneId: result.zoneId,
      latitude: result.latitude,
      longitude: result.longitude,
      urgency: urgent ? "emergency" : "normal",
    });
    if (offered.windows.length > 0) {
      setLiveWindows(offered.windows);
      setEngineBacked(offered.engineBacked);
    }
    setPicked([]);
    setHold(null);
    setBusy(false);
    next();
  }

  function toggleWindow(w: BookableWindow) {
    setHold(null);
    if (engineBacked) {
      // Engine-backed slots are exclusive: pick exactly one.
      setPicked((p) =>
        p.some((x) => x.date === w.date && x.start === w.start) ? [] : [w],
      );
      return;
    }
    setPicked((p) => {
      const exists = p.some((x) => x.date === w.date && x.start === w.start);
      if (exists) return p.filter((x) => !(x.date === w.date && x.start === w.start));
      if (p.length >= 3) return p;
      return [...p, w];
    });
  }

  async function continueToReview() {
    const selected = picked[0];
    if (engineBacked && selected?.slotToken) {
      setBusy(true);
      setError(null);
      const placed = await holdSelectedSlot(selected.slotToken);
      setBusy(false);
      if (!placed) {
        setError("That window was just taken. Please pick another.");
        const offered = await getBookingWindows({
          serviceTypeSlug: service,
          zoneId: addressCheck?.zoneId,
          latitude: addressCheck?.latitude,
          longitude: addressCheck?.longitude,
          urgency: urgent ? "emergency" : "normal",
        });
        setLiveWindows(offered.windows);
        setEngineBacked(offered.engineBacked);
        setPicked([]);
        return;
      }
      setHold(placed);
    }
    next();
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await submitBooking({
      serviceTypeSlug: service,
      serviceOther,
      problemDescription: problem,
      equipmentBrand: brand,
      equipmentModel: model,
      equipmentSerial: serial,
      errorCode,
      urgency: urgent ? "emergency" : "normal",
      firstName,
      lastName,
      phone,
      email,
      address: { street, unit, city, state: "TX", zip },
      addressConfirmedDespiteWarning: Boolean(addressCheck?.message),
      preferredWindows: picked.map(({ date, start, end, label }) => ({ date, start, end, label })),
      feeAcknowledged: feeAck as true,
      slotToken: engineBacked ? picked[0]?.slotToken : undefined,
      holdId: hold?.holdId,
      photoAssetIds: photos.map((p) => p.id),
      company: honeypotRef.current?.value ?? "",
    });
    setBusy(false);
    if (result.ok) {
      setScheduled(result.scheduled);
      setReference(result.reference);
    } else {
      setError(result.error);
    }
  }

  if (reference) {
    return (
      <div className="rounded-2xl border border-line bg-white p-8">
        <p className="text-sm font-bold uppercase tracking-widest text-point">
          Service request received
        </p>
        <h2 className="mt-2 text-2xl font-extrabold text-navy">
          Reference: {reference}
        </h2>
        <p className="mt-4 text-slate">
          {scheduled ? (
            <>
              Thanks, {firstName}! Your window{" "}
              <strong className="text-navy">{picked[0]?.label}</strong> is
              reserved. We&apos;ll confirm with you at{" "}
              <strong className="text-navy">{phone}</strong>.
            </>
          ) : (
            <>
              Thanks, {firstName}! We&apos;ve received your request and will
              contact you at <strong className="text-navy">{phone}</strong> to
              confirm your appointment window.
            </>
          )}
        </p>
        <ul className="mt-4 space-y-2 text-sm text-slate">
          <li>• We&apos;ll confirm the exact arrival window with you directly.</li>
          <li>
            • The $80 diagnostic/service-call fee is waived if you approve the
            quoted repair.
          </li>
          <li>
            • Need faster help? Call{" "}
            <a href={BUSINESS.phoneHref} className="font-semibold text-point">
              {BUSINESS.phone}
            </a>
            .
          </li>
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-6 sm:p-8">
      {/* Step indicator */}
      <ol className="flex flex-wrap gap-2 text-xs font-semibold">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`rounded-full px-3 py-1 ${
              i === step
                ? "bg-navy text-white"
                : i < step
                  ? "bg-point/10 text-point"
                  : "bg-mist text-slate"
            }`}
          >
            {label}
          </li>
        ))}
      </ol>

      {/* Honeypot — hidden from humans */}
      <input
        ref={honeypotRef}
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-6">
        {step === 0 && (
          <fieldset>
            <legend className="text-lg font-bold text-navy">
              What needs service?
            </legend>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {services.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => {
                    setService(s.slug);
                    next();
                  }}
                  className={`rounded-lg border px-3 py-3 text-sm font-semibold transition ${
                    service === s.slug
                      ? "border-point bg-point/10 text-point"
                      : "border-line text-navy hover:border-point"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-navy">What&apos;s the problem?</h2>
            {service === "other" && (
              <label className={labelCls}>
                What kind of equipment is it?
                <input
                  className={inputCls}
                  value={serviceOther}
                  onChange={(e) => setServiceOther(e.target.value)}
                  placeholder="e.g. wine cooler"
                />
              </label>
            )}
            <label className={labelCls}>
              Describe what&apos;s happening
              <textarea
                className={`${inputCls} min-h-28`}
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="e.g. The fridge stopped cooling yesterday; the freezer still works."
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelCls}>
                Brand <span className="font-normal text-slate">(optional)</span>
                <input className={inputCls} value={brand} onChange={(e) => setBrand(e.target.value)} />
              </label>
              <label className={labelCls}>
                Model <span className="font-normal text-slate">(optional)</span>
                <input className={inputCls} value={model} onChange={(e) => setModel(e.target.value)} />
              </label>
              <label className={labelCls}>
                Serial <span className="font-normal text-slate">(optional)</span>
                <input className={inputCls} value={serial} onChange={(e) => setSerial(e.target.value)} />
              </label>
              <label className={labelCls}>
                Error code <span className="font-normal text-slate">(optional)</span>
                <input className={inputCls} value={errorCode} onChange={(e) => setErrorCode(e.target.value)} />
              </label>
            </div>
            <label className="flex items-start gap-2.5 text-sm text-navy">
              <input
                type="checkbox"
                checked={urgent}
                onChange={(e) => setUrgent(e.target.checked)}
                className="mt-0.5 size-4 accent-point"
              />
              <span>
                I need urgent / emergency service.{" "}
                <span className="text-slate">
                  Emergency and same-day service may be available — calling{" "}
                  {BUSINESS.phone} is fastest.
                </span>
              </span>
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-navy">
              Photos <span className="font-normal text-slate">(optional, up to 6)</span>
            </h2>
            <p className="text-sm text-slate">
              Photos of the appliance, its model/serial label, or the error
              display help our technician arrive prepared.
            </p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              multiple
              disabled={uploading || photos.length >= 6}
              onChange={(e) => uploadPhotos(e.target.files)}
              className="block w-full text-sm text-slate file:mr-3 file:rounded-lg file:border-0 file:bg-navy file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
            {uploading && <p className="text-sm text-slate">Uploading…</p>}
            {photos.length > 0 && (
              <ul className="space-y-1 text-sm text-navy">
                {photos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-lg bg-mist px-3 py-2">
                    <span className="truncate">{p.name}</span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-red-600"
                      onClick={() => setPhotos((cur) => cur.filter((x) => x.id !== p.id))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-navy">How do we reach you?</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelCls}>
                First name
                <input className={inputCls} autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </label>
              <label className={labelCls}>
                Last name
                <input className={inputCls} autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </label>
              <label className={labelCls}>
                Mobile phone
                <input className={inputCls} type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="713-555-0100" />
              </label>
              <label className={labelCls}>
                Email
                <input className={inputCls} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-navy">Where is the service address?</h2>
            <label className={labelCls}>
              Street address
              <input className={inputCls} autoComplete="street-address" value={street} onChange={(e) => setStreet(e.target.value)} />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className={labelCls}>
                Unit / Apt <span className="font-normal text-slate">(optional)</span>
                <input className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)} />
              </label>
              <label className={labelCls}>
                City
                <input className={inputCls} autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} />
              </label>
              <label className={labelCls}>
                ZIP
                <input className={inputCls} inputMode="numeric" autoComplete="postal-code" value={zip} onChange={(e) => setZip(e.target.value)} />
              </label>
            </div>
            <p className="text-xs text-slate">State: Texas</p>
            {addressCheck?.ok && addressCheck.message && (
              <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {addressCheck.message}
              </p>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-navy">When works for you?</h2>
            <p className="text-sm text-slate">
              {engineBacked
                ? "These windows have real availability — pick one and we'll reserve it."
                : "Pick up to three windows that work — we'll confirm one with you."}
              {addressCheck?.zoneName && (
                <> Your area: <strong className="text-navy">{addressCheck.zoneName}</strong>.</>
              )}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {shownWindows.map((w) => {
                const selected = picked.some((x) => x.date === w.date && x.start === w.start);
                return (
                  <button
                    key={`${w.date}-${w.start}`}
                    type="button"
                    onClick={() => toggleWindow(w)}
                    className={`rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition ${
                      selected
                        ? "border-point bg-point/10 text-point"
                        : "border-line text-navy hover:border-point"
                    }`}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-navy">Review &amp; confirm</h2>
            <dl className="space-y-2 rounded-xl bg-mist p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate">Service</dt>
                <dd className="font-semibold text-navy">
                  {services.find((s) => s.slug === service)?.name}
                  {service === "other" && serviceOther ? ` — ${serviceOther}` : ""}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate">Contact</dt>
                <dd className="text-right font-semibold text-navy">
                  {firstName} {lastName} · {phone}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate">Address</dt>
                <dd className="text-right font-semibold text-navy">
                  {street}
                  {unit ? `, ${unit}` : ""}, {city}, TX {zip}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate">Preferred windows</dt>
                <dd className="text-right font-semibold text-navy">
                  {picked.map((w) => w.label).join(" · ")}
                </dd>
              </div>
              {urgent && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate">Priority</dt>
                  <dd className="font-semibold text-point">Urgent / emergency</dd>
                </div>
              )}
            </dl>
            {hold && (
              <p className="rounded-lg bg-point/10 px-4 py-2.5 text-sm font-semibold text-point">
                We&apos;re holding this window for you for a few minutes while
                you finish.
              </p>
            )}
            <div className="rounded-xl border border-line p-4">
              <h3 className="text-sm font-bold text-navy">Diagnostic &amp; service-call fee</h3>
              <p className="mt-1 text-sm text-slate">
                An $80 diagnostic/service-call fee applies if we diagnose the
                problem and you choose not to proceed with the recommended
                repair. If you approve the quoted repair, the fee is waived.
              </p>
              <label className="mt-3 flex items-start gap-2.5 text-sm font-semibold text-navy">
                <input
                  type="checkbox"
                  checked={feeAck}
                  onChange={(e) => setFeeAck(e.target.checked)}
                  className="mt-0.5 size-4 accent-point"
                />
                I understand the diagnostic-fee policy.
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      {step > 0 && (
        <div className="mt-8 flex items-center justify-between">
          <button type="button" onClick={back} className={secondaryBtn}>
            Back
          </button>
          {step === 1 && (
            <button
              type="button"
              onClick={next}
              disabled={problem.trim().length < 10}
              className={primaryBtn}
            >
              Continue
            </button>
          )}
          {step === 2 && (
            <button type="button" onClick={next} disabled={uploading} className={primaryBtn}>
              Continue
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              onClick={next}
              disabled={!firstName.trim() || !lastName.trim() || phone.trim().length < 10 || !email.includes("@")}
              className={primaryBtn}
            >
              Continue
            </button>
          )}
          {step === 4 && (
            <button
              type="button"
              onClick={checkAddress}
              disabled={busy || street.trim().length < 4 || !city.trim() || zip.trim().length !== 5}
              className={primaryBtn}
            >
              {busy ? "Checking…" : "Continue"}
            </button>
          )}
          {step === 5 && (
            <button
              type="button"
              onClick={continueToReview}
              disabled={picked.length === 0 || busy}
              className={primaryBtn}
            >
              {busy ? "Reserving…" : "Continue"}
            </button>
          )}
          {step === 6 && (
            <button type="button" onClick={submit} disabled={!feeAck || busy} className={primaryBtn}>
              {busy ? "Submitting…" : "Submit Request"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
