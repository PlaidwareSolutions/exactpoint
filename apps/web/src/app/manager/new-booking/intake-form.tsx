"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  checkIntakeAddress,
  createPhoneBooking,
  findCustomerByPhone,
  type CustomerMatch,
} from "@/lib/manager/intake-actions";
import type { AddressCheck } from "@/lib/address-check";

const inputCls =
  "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-navy focus:border-point focus:outline-none";
const labelCls = "block text-sm font-semibold text-navy";

export function IntakeForm({
  services,
}: {
  services: { slug: string; name: string; category: string }[];
}) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [matches, setMatches] = useState<CustomerMatch[] | null>(null);
  const [existingCustomerId, setExistingCustomerId] = useState<string | null>(null);
  const [existingAddressId, setExistingAddressId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [service, setService] = useState("");
  const [serviceOther, setServiceOther] = useState("");
  const [problem, setProblem] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [street, setStreet] = useState("");
  const [unit, setUnit] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [addressNote, setAddressNote] = useState<AddressCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup() {
    if (phone.trim().length < 7) return;
    setBusy(true);
    const found = await findCustomerByPhone(phone);
    setMatches(found);
    setBusy(false);
  }

  function useCustomer(match: CustomerMatch) {
    setExistingCustomerId(match.id);
    const [first, ...rest] = match.name.split(" ");
    setFirstName(first ?? "");
    setLastName(rest.join(" "));
    setEmail(match.email ?? "");
    if (match.addresses.length === 1) setExistingAddressId(match.addresses[0]!.id);
  }

  async function submit() {
    setBusy(true);
    setError(null);

    let addressPayload: AddressCheck | null = addressNote;
    if (!existingAddressId && !addressPayload?.ok) {
      addressPayload = await checkIntakeAddress({ street, unit, city, state: "TX", zip });
      setAddressNote(addressPayload);
      if (!addressPayload.ok) {
        setBusy(false);
        setError(addressPayload.message ?? "Address could not be confirmed.");
        return;
      }
    }

    const result = await createPhoneBooking({
      existingCustomerId: existingCustomerId ?? undefined,
      existingAddressId: existingAddressId ?? undefined,
      firstName,
      lastName,
      phone,
      email,
      serviceTypeSlug: service,
      serviceOther,
      problemDescription: problem,
      urgency: urgent ? "emergency" : "normal",
      address: existingAddressId ? undefined : { street, unit, city, state: "TX", zip },
    });
    setBusy(false);
    if (result.ok) {
      router.push(`/manager/requests/${result.requestId}`);
    } else {
      setError(result.error);
    }
  }

  const selectedMatch = matches?.find((m) => m.id === existingCustomerId);

  return (
    <div className="space-y-4 rounded-xl border border-line bg-white p-5">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>
      )}

      <div className="flex items-end gap-2">
        <label className={`${labelCls} flex-1`}>
          Customer phone
          <input
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setMatches(null);
              setExistingCustomerId(null);
              setExistingAddressId(null);
            }}
            onBlur={lookup}
            placeholder="713-555-0100"
            className={inputCls}
          />
        </label>
        <button
          type="button"
          onClick={lookup}
          disabled={busy}
          className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-navy hover:border-point"
        >
          Look up
        </button>
      </div>

      {matches && matches.length > 0 && !existingCustomerId && (
        <div className="rounded-lg bg-point/5 p-3 text-sm">
          <p className="font-bold text-navy">Existing customer found:</p>
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => useCustomer(m)}
              className="mt-1 block font-semibold text-point hover:underline"
            >
              {m.name} {m.email ? `· ${m.email}` : ""} → use this customer
            </button>
          ))}
        </div>
      )}
      {selectedMatch && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Using existing customer {selectedMatch.name} — service history will link up.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelCls}>
          First name
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
        </label>
        <label className={labelCls}>
          Last name
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
        </label>
        <label className={`${labelCls} sm:col-span-2`}>
          Email <span className="font-normal text-slate">(optional for phone bookings)</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelCls}>
          Service
          <select value={service} onChange={(e) => setService(e.target.value)} className={inputCls}>
            <option value="">Choose…</option>
            {services.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {service === "other" && (
          <label className={labelCls}>
            What kind of equipment?
            <input value={serviceOther} onChange={(e) => setServiceOther(e.target.value)} className={inputCls} />
          </label>
        )}
      </div>
      <label className={labelCls}>
        Problem
        <textarea
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          className={`${inputCls} min-h-20`}
          placeholder="What the customer described on the call"
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-navy">
        <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="size-4 accent-point" />
        Urgent / emergency
      </label>

      {selectedMatch && selectedMatch.addresses.length > 0 && (
        <label className={labelCls}>
          Service address
          <select
            value={existingAddressId ?? "new"}
            onChange={(e) =>
              setExistingAddressId(e.target.value === "new" ? null : e.target.value)
            }
            className={inputCls}
          >
            {selectedMatch.addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
            <option value="new">New address…</option>
          </select>
        </label>
      )}

      {!existingAddressId && (
        <div className="grid gap-3 sm:grid-cols-4">
          <label className={`${labelCls} sm:col-span-2`}>
            Street
            <input value={street} onChange={(e) => setStreet(e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>
            Unit
            <input value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>
            ZIP
            <input value={zip} onChange={(e) => setZip(e.target.value)} className={inputCls} />
          </label>
          <label className={`${labelCls} sm:col-span-2`}>
            City
            <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
          </label>
        </div>
      )}
      {addressNote?.ok && (
        <p className="text-sm text-slate">
          Zone: <strong className="text-navy">{addressNote.zoneName ?? "outside configured zones"}</strong>
          {addressNote.message ? ` — ${addressNote.message}` : ""}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={
          busy ||
          !firstName.trim() ||
          phone.trim().length < 7 ||
          !service ||
          problem.trim().length < 5 ||
          (!existingAddressId && (street.trim().length < 4 || !city.trim() || zip.trim().length !== 5))
        }
        className="w-full rounded-xl bg-point py-3 font-bold text-white hover:bg-point-deep disabled:opacity-50"
      >
        {busy ? "Saving…" : "Create booking → pick a time"}
      </button>
      <p className="text-xs text-slate">
        Mention the $80 diagnostic fee on the call — it's recorded as
        acknowledged. Next screen: scheduling recommendations.
      </p>
    </div>
  );
}
