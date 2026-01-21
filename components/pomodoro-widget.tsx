"use client";

import { useEffect, useMemo, useState } from "react";

type Mode = "work" | "break" | "long_break";

type Preset = {
  id: string;
  label: string;
  work: number;
  shortBreak: number;
  longBreak: number;
  perSet: number;
};

const PRESETS: Preset[] = [
  { id: "classic", label: "Classic 25/5", work: 25, shortBreak: 5, longBreak: 15, perSet: 4 },
  { id: "deep", label: "Deep 50/10", work: 50, shortBreak: 10, longBreak: 20, perSet: 3 },
  { id: "quick", label: "Quick 15/3", work: 15, shortBreak: 3, longBreak: 10, perSet: 4 },
];

const STORAGE_KEY = "pmapp_pomodoro_settings";

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function PomodoroWidget() {
  const initialSettings = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        workMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        perSet: 4,
        presetId: "classic",
      };
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return {
        workMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        perSet: 4,
        presetId: "classic",
      };
    }
    try {
      const parsed = JSON.parse(saved) as {
        workMinutes: number;
        shortBreakMinutes: number;
        longBreakMinutes: number;
        perSet: number;
        presetId: string;
      };
      return {
        workMinutes: parsed.workMinutes ?? 25,
        shortBreakMinutes: parsed.shortBreakMinutes ?? 5,
        longBreakMinutes: parsed.longBreakMinutes ?? 15,
        perSet: parsed.perSet ?? 4,
        presetId: parsed.presetId ?? "classic",
      };
    } catch {
      return {
        workMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        perSet: 4,
        presetId: "classic",
      };
    }
  }, []);

  const [workMinutes, setWorkMinutes] = useState(initialSettings.workMinutes);
  const [shortBreakMinutes, setShortBreakMinutes] = useState(initialSettings.shortBreakMinutes);
  const [longBreakMinutes, setLongBreakMinutes] = useState(initialSettings.longBreakMinutes);
  const [perSet, setPerSet] = useState(initialSettings.perSet);
  const [mode, setMode] = useState<Mode>("work");
  const [isRunning, setIsRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(initialSettings.workMinutes * 60);
  const [presetId, setPresetId] = useState(initialSettings.presetId);
  const [collapsed, setCollapsed] = useState(false);

  const modeLabel = useMemo(() => {
    if (mode === "work") return "Focus";
    if (mode === "break") return "Break";
    return "Long break";
  }, [mode]);

  const modeSeconds = useMemo(() => {
    if (mode === "work") return workMinutes * 60;
    if (mode === "break") return shortBreakMinutes * 60;
    return longBreakMinutes * 60;
  }, [mode, workMinutes, shortBreakMinutes, longBreakMinutes]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        workMinutes,
        shortBreakMinutes,
        longBreakMinutes,
        perSet,
        presetId,
      })
    );
  }, [workMinutes, shortBreakMinutes, longBreakMinutes, perSet, presetId]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 1) return prev - 1;
        if (mode === "work") {
          const nextCompleted = completed + 1;
          setCompleted(nextCompleted);
          if (nextCompleted % perSet === 0) {
            setMode("long_break");
            return longBreakMinutes * 60;
          }
          setMode("break");
          return shortBreakMinutes * 60;
        }
        setMode("work");
        return workMinutes * 60;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, mode, completed, perSet, longBreakMinutes, shortBreakMinutes, workMinutes]);

  const applyPreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) {
      setPresetId("custom");
      return;
    }
    setPresetId(id);
    setWorkMinutes(preset.work);
    setShortBreakMinutes(preset.shortBreak);
    setLongBreakMinutes(preset.longBreak);
    setPerSet(preset.perSet);
    setMode("work");
    setCompleted(0);
    setIsRunning(false);
    setSecondsLeft(preset.work * 60);
  };

  const applyCustom = () => {
    setPresetId("custom");
    setMode("work");
    setCompleted(0);
    setIsRunning(false);
    setSecondsLeft(workMinutes * 60);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 rounded-2xl border border-zinc-200 bg-white shadow-lg">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <div>
          <div className="text-sm font-semibold">Pomodoro</div>
          <div className="text-xs text-zinc-500">{modeLabel}</div>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50"
            onClick={() => setCollapsed((prev) => !prev)}
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
        </div>
      </div>

      {collapsed ? (
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-2xl font-semibold tabular-nums">{formatTime(secondsLeft)}</div>
          <button
            className="rounded-md bg-black px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800"
            onClick={() => setIsRunning((prev) => !prev)}
          >
            {isRunning ? "Pause" : "Start"}
          </button>
        </div>
      ) : (
        <div className="space-y-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-3xl font-semibold tabular-nums">{formatTime(secondsLeft)}</div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-md bg-black px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800"
                onClick={() => setIsRunning((prev) => !prev)}
              >
                {isRunning ? "Pause" : "Start"}
              </button>
              <button
                className="rounded-md border border-zinc-200 px-3 py-2 text-xs hover:bg-zinc-50"
                onClick={() => {
                  setIsRunning(false);
                  setSecondsLeft(modeSeconds);
                }}
              >
                Reset
              </button>
              <button
                className="rounded-md border border-zinc-200 px-3 py-2 text-xs hover:bg-zinc-50"
                onClick={() => {
                  setIsRunning(false);
                  setMode("work");
                  setCompleted(0);
                  setSecondsLeft(workMinutes * 60);
                }}
              >
                New set
              </button>
            </div>
          </div>

          <div className="text-xs text-zinc-500">
            Completed: <span className="font-semibold text-zinc-700">{completed}</span>
          </div>

          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase text-zinc-500">Preset</label>
            <select
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              value={presetId}
              onChange={(e) => applyPreset(e.target.value)}
            >
              {PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <label className="text-xs font-semibold uppercase text-zinc-500">Pomodoros per set</label>
            <input
              type="number"
              min={1}
              max={8}
              value={perSet}
              onChange={(e) => setPerSet(Number(e.target.value))}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <div>
              <label className="text-xs font-semibold uppercase text-zinc-500">Focus</label>
              <input
                type="number"
                min={5}
                max={90}
                value={workMinutes}
                onChange={(e) => setWorkMinutes(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-zinc-500">Short break</label>
              <input
                type="number"
                min={1}
                max={30}
                value={shortBreakMinutes}
                onChange={(e) => setShortBreakMinutes(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-zinc-500">Long break</label>
              <input
                type="number"
                min={5}
                max={45}
                value={longBreakMinutes}
                onChange={(e) => setLongBreakMinutes(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <button
            className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
            onClick={applyCustom}
          >
            Apply & reset
          </button>
        </div>
      )}
    </div>
  );
}
