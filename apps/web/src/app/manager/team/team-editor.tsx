"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addTimeOffAction,
  createTechnician,
  createTechnicianLogin,
  setTechnicianActive,
  setTechnicianAvailability,
  setTechnicianSkills,
  setTechnicianZonePreferences,
  updateTechnician,
} from "@/lib/manager/team-actions";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const inputCls =
  "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-navy focus:border-point focus:outline-none";
const labelCls = "block text-sm font-semibold text-navy";
const btn =
  "rounded-lg bg-point px-4 py-2 text-sm font-bold text-white hover:bg-point-deep disabled:opacity-50";

export interface TechnicianEditorData {
  id?: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  title: string;
  color: string;
  startDate: string;
  maxDailyJobs: string;
  emergencyAvailable: boolean;
  notes: string;
  isActive: boolean;
  hasLogin: boolean;
  skills: string[];
  availability: { dayOfWeek: number; startTime: string; endTime: string }[];
  zoneIds: string[];
}

export function TeamEditor({
  initial,
  allSkills,
  allZones,
  timeOff,
}: {
  initial: TechnicianEditorData;
  allSkills: { slug: string; name: string; category: string }[];
  allZones: { id: string; name: string }[];
  timeOff: { id: string; period: string; type: string; note: string | null }[];
}) {
  const router = useRouter();
  const isNew = !initial.id;
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loginInfo, setLoginInfo] = useState<{ email: string; password: string } | null>(null);
  const [timeOffStart, setTimeOffStart] = useState("");
  const [timeOffEnd, setTimeOffEnd] = useState("");
  const [timeOffType, setTimeOffType] = useState("vacation");

  const set = (patch: Partial<TechnicianEditorData>) =>
    setForm((f) => ({ ...f, ...patch }));

  async function saveProfile() {
    setBusy(true);
    setMessage(null);
    const payload = {
      firstName: form.firstName,
      lastName: form.lastName,
      mobile: form.mobile,
      email: form.email,
      title: form.title,
      color: form.color,
      startDate: form.startDate,
      maxDailyJobs: form.maxDailyJobs === "" ? "" : Number(form.maxDailyJobs),
      emergencyAvailable: form.emergencyAvailable,
      notes: form.notes,
    };
    const result = isNew
      ? await createTechnician(payload)
      : await updateTechnician(form.id!, payload);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    if (isNew && "id" in result && result.id) {
      router.push(`/manager/team/${result.id}`);
      return;
    }
    setMessage("Saved.");
    router.refresh();
  }

  async function saveSkills() {
    if (!form.id) return;
    setBusy(true);
    const result = await setTechnicianSkills(form.id, form.skills);
    setBusy(false);
    setMessage(result.ok ? "Skills saved." : result.error);
  }

  async function saveAvailability() {
    if (!form.id) return;
    setBusy(true);
    const result = await setTechnicianAvailability(form.id, form.availability);
    setBusy(false);
    setMessage(result.ok ? "Schedule saved." : result.error);
  }

  async function saveZones() {
    if (!form.id) return;
    setBusy(true);
    const result = await setTechnicianZonePreferences(form.id, form.zoneIds);
    setBusy(false);
    setMessage(result.ok ? "Zone preferences saved." : result.error);
  }

  async function addTimeOff() {
    if (!form.id || !timeOffStart || !timeOffEnd) return;
    setBusy(true);
    const result = await addTimeOffAction(form.id, {
      startIso: new Date(timeOffStart).toISOString(),
      endIso: new Date(timeOffEnd).toISOString(),
      type: timeOffType,
    });
    setBusy(false);
    setMessage(result.ok ? "Time off added." : result.error);
    if (result.ok) router.refresh();
  }

  async function makeLogin() {
    if (!form.id) return;
    setBusy(true);
    const result = await createTechnicianLogin(form.id);
    setBusy(false);
    if (result.ok && result.email && result.temporaryPassword) {
      setLoginInfo({ email: result.email, password: result.temporaryPassword });
      router.refresh();
    } else if (!result.ok) {
      setMessage(result.error);
    }
  }

  async function toggleActive() {
    if (!form.id) return;
    setBusy(true);
    await setTechnicianActive(form.id, !form.isActive);
    set({ isActive: !form.isActive });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {message && (
        <p className="rounded-lg bg-mist px-4 py-2.5 text-sm font-semibold text-navy">
          {message}
        </p>
      )}
      {loginInfo && (
        <div className="rounded-xl border-2 border-point bg-point/5 p-4 text-sm">
          <p className="font-bold text-navy">
            Login created — share these credentials directly (shown once):
          </p>
          <p className="mt-1 font-mono text-navy">
            {loginInfo.email} / {loginInfo.password}
          </p>
        </div>
      )}

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="font-bold text-navy">Profile</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className={labelCls}>
            First name
            <input className={inputCls} value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} />
          </label>
          <label className={labelCls}>
            Last name
            <input className={inputCls} value={form.lastName} onChange={(e) => set({ lastName: e.target.value })} />
          </label>
          <label className={labelCls}>
            Mobile
            <input className={inputCls} value={form.mobile} onChange={(e) => set({ mobile: e.target.value })} />
          </label>
          <label className={labelCls}>
            Email
            <input className={inputCls} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
          </label>
          <label className={labelCls}>
            Title
            <input className={inputCls} value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Lead Technician" />
          </label>
          <label className={labelCls}>
            Calendar color
            <input className={`${inputCls} h-10`} type="color" value={form.color} onChange={(e) => set({ color: e.target.value })} />
          </label>
          <label className={labelCls}>
            Start date
            <input className={inputCls} type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} />
          </label>
          <label className={labelCls}>
            Max daily jobs
            <input className={inputCls} type="number" min={1} max={20} value={form.maxDailyJobs} onChange={(e) => set({ maxDailyJobs: e.target.value })} placeholder="no limit" />
          </label>
          <label className="mt-6 flex items-center gap-2 text-sm font-semibold text-navy">
            <input type="checkbox" className="size-4 accent-point" checked={form.emergencyAvailable} onChange={(e) => set({ emergencyAvailable: e.target.checked })} />
            Available for emergency calls
          </label>
        </div>
        <label className={`${labelCls} mt-3`}>
          Notes
          <textarea className={`${inputCls} min-h-16`} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </label>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={saveProfile} disabled={busy} className={btn}>
            {isNew ? "Create technician" : "Save profile"}
          </button>
          {!isNew && !form.hasLogin && (
            <button
              type="button"
              onClick={makeLogin}
              disabled={busy || !form.email}
              className="rounded-lg border border-navy px-4 py-2 text-sm font-bold text-navy hover:bg-navy hover:text-white disabled:opacity-50"
              title={form.email ? "" : "Add an email first"}
            >
              Create login
            </button>
          )}
          {!isNew && (
            <button
              type="button"
              onClick={toggleActive}
              disabled={busy}
              className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-slate hover:border-point"
            >
              {form.isActive ? "Deactivate" : "Reactivate"}
            </button>
          )}
        </div>
        {!isNew && !form.isActive && (
          <p className="mt-2 text-xs text-slate">
            Inactive technicians keep their full history but never appear in
            new scheduling. Future assignments are flagged for reassignment.
          </p>
        )}
      </section>

      {!isNew && (
        <>
          <section className="rounded-xl border border-line bg-white p-5">
            <h2 className="font-bold text-navy">Skills</h2>
            <p className="mt-1 text-xs text-slate">
              The scheduler only offers this technician for services whose
              required skill is checked.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {allSkills.map((s) => (
                <label key={s.slug} className="flex items-center gap-2 text-sm text-navy">
                  <input
                    type="checkbox"
                    className="size-4 accent-point"
                    checked={form.skills.includes(s.slug)}
                    onChange={(e) =>
                      set({
                        skills: e.target.checked
                          ? [...form.skills, s.slug]
                          : form.skills.filter((x) => x !== s.slug),
                      })
                    }
                  />
                  {s.name}
                </label>
              ))}
            </div>
            <button type="button" onClick={saveSkills} disabled={busy} className={`${btn} mt-4`}>
              Save skills
            </button>
          </section>

          <section className="rounded-xl border border-line bg-white p-5">
            <h2 className="font-bold text-navy">Weekly schedule</h2>
            <div className="mt-3 space-y-2">
              {DAY_NAMES.map((name, day) => {
                const row = form.availability.find((a) => a.dayOfWeek === day);
                return (
                  <div key={day} className="flex items-center gap-3 text-sm">
                    <label className="flex w-20 items-center gap-2 font-semibold text-navy">
                      <input
                        type="checkbox"
                        className="size-4 accent-point"
                        checked={Boolean(row)}
                        onChange={(e) =>
                          set({
                            availability: e.target.checked
                              ? [...form.availability, { dayOfWeek: day, startTime: "07:00", endTime: "19:00" }]
                              : form.availability.filter((a) => a.dayOfWeek !== day),
                          })
                        }
                      />
                      {name}
                    </label>
                    {row && (
                      <>
                        <input
                          type="time"
                          value={row.startTime}
                          onChange={(e) =>
                            set({
                              availability: form.availability.map((a) =>
                                a.dayOfWeek === day ? { ...a, startTime: e.target.value } : a,
                              ),
                            })
                          }
                          className="rounded-lg border border-line px-2 py-1"
                        />
                        <span className="text-slate">to</span>
                        <input
                          type="time"
                          value={row.endTime}
                          onChange={(e) =>
                            set({
                              availability: form.availability.map((a) =>
                                a.dayOfWeek === day ? { ...a, endTime: e.target.value } : a,
                              ),
                            })
                          }
                          className="rounded-lg border border-line px-2 py-1"
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={saveAvailability} disabled={busy} className={`${btn} mt-4`}>
              Save schedule
            </button>
          </section>

          <section className="rounded-xl border border-line bg-white p-5">
            <h2 className="font-bold text-navy">Preferred zones</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {allZones.map((z) => (
                <label key={z.id} className="flex items-center gap-2 text-sm text-navy">
                  <input
                    type="checkbox"
                    className="size-4 accent-point"
                    checked={form.zoneIds.includes(z.id)}
                    onChange={(e) =>
                      set({
                        zoneIds: e.target.checked
                          ? [...form.zoneIds, z.id]
                          : form.zoneIds.filter((x) => x !== z.id),
                      })
                    }
                  />
                  {z.name}
                </label>
              ))}
            </div>
            <button type="button" onClick={saveZones} disabled={busy} className={`${btn} mt-4`}>
              Save zones
            </button>
          </section>

          <section className="rounded-xl border border-line bg-white p-5">
            <h2 className="font-bold text-navy">Time off</h2>
            {timeOff.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-slate">
                {timeOff.map((t) => (
                  <li key={t.id}>
                    {t.type}: {t.period} {t.note ? `— ${t.note}` : ""}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap items-end gap-3 text-sm">
              <label className={labelCls}>
                From
                <input type="datetime-local" className={inputCls} value={timeOffStart} onChange={(e) => setTimeOffStart(e.target.value)} />
              </label>
              <label className={labelCls}>
                To
                <input type="datetime-local" className={inputCls} value={timeOffEnd} onChange={(e) => setTimeOffEnd(e.target.value)} />
              </label>
              <label className={labelCls}>
                Type
                <select className={inputCls} value={timeOffType} onChange={(e) => setTimeOffType(e.target.value)}>
                  {["vacation", "sick", "personal", "training", "break", "vehicle_maintenance", "other"].map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={addTimeOff} disabled={busy} className={btn}>
                Add time off
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
