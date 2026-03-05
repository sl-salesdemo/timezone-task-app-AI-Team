"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { defaultTimeSlots, regionList, staffList, type TaskItem, type TimeSlot } from "@/lib/task-data";
import { Users, Clock, Plus, X, ChevronDown, ChevronUp, LogOut, Calendar, Cloud, CloudOff } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  type CompletedTask,
  type DailyReport,
  type ReportItem,
  type RegionAssignment,
  type CustomTask,
  type DaySaveData,
  getDateKey,
  loadDayData,
  saveDayData,
  cleanupOldLocalData,
  getEmptyDayData,
} from "@/lib/storage";

// --- Main Component ---

interface TaskCheckerProps {
  userId: string;
  isAdmin: boolean;
}

export function TaskChecker({ userId, isAdmin }: TaskCheckerProps) {
  const supabase = createClient();
  const [loggingOut, setLoggingOut] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error">("synced");
  const todayKey = getDateKey();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    // Page will handle redirect after auth state change
  };
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
  const [report, setReport] = useState<DailyReport>({ newItems: [], sharedItems: [] });
  const [regionAssignments, setRegionAssignments] = useState<RegionAssignment[]>([]);
  const [customTasks, setCustomTasks] = useState<CustomTask[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTime, setNewTaskTime] = useState("");
  const [newTaskLabel, setNewTaskLabel] = useState("");

  // 初回ロード
  useEffect(() => {
    const loadData = async () => {
      cleanupOldLocalData();
      const data = await loadDayData(userId, todayKey);
      setCompletedTasks(data.completedTasks);
      setReport(data.report);
      setRegionAssignments(data.regionAssignments);
      setCustomTasks(data.customTasks);
      setIsLoaded(true);
    };
    loadData();
  }, [userId, todayKey]);

  // 自動保存（デバウンス付き）
  useEffect(() => {
    if (!isLoaded) return;

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSyncStatus("syncing");

    // Debounce save by 1 second
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveDayData(userId, todayKey, {
          completedTasks,
          report,
          regionAssignments,
          customTasks,
          savedAt: "",
        });
        setSyncStatus("synced");
      } catch {
        setSyncStatus("error");
      }
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [completedTasks, report, regionAssignments, customTasks, isLoaded, userId, todayKey]);

  // タスクリストをカスタムタスク含めてマージ
  const getMergedTimeSlots = useCallback((): TimeSlot[] => {
    const slots = defaultTimeSlots.map((s) => ({ ...s, tasks: [...s.tasks] }));

    for (const ct of customTasks) {
      const existing = slots.find((s) => s.time === ct.time);
      if (existing) {
        existing.tasks.push(ct.task);
      } else {
        slots.push({ id: ct.slotId, time: ct.time, tasks: [ct.task] });
      }
    }

    // 時刻順にソート
    slots.sort((a, b) => {
      const toMin = (t: string) => {
        const clean = t.replace("~", "");
        const [h, m] = clean.split(":").map(Number);
        return h * 60 + (m || 0);
      };
      return toMin(a.time) - toMin(b.time);
    });

    return slots;
  }, [customTasks]);

  const isTaskCompleted = useCallback(
    (taskId: string, regionId: string): boolean => {
      return completedTasks.some((t) => t.taskId === taskId && t.regionId === regionId);
    },
    [completedTasks]
  );

  const toggleTask = (taskId: string, regionId: string) => {
    setCompletedTasks((prev) => {
      const existing = prev.find((t) => t.taskId === taskId && t.regionId === regionId);
      if (existing) {
        return prev.filter((t) => !(t.taskId === taskId && t.regionId === regionId));
      }
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      return [...prev, { taskId, regionId, completedAt: timeStr }];
    });
  };

  const isLate = useCallback(
    (taskId: string, regionId: string): boolean => {
      const completed = completedTasks.find((t) => t.taskId === taskId && t.regionId === regionId);
      if (!completed) return false;

      for (const slot of getMergedTimeSlots()) {
        const task = slot.tasks.find((t) => t.id === taskId);
        if (task) {
          const cleanTime = slot.time.replace("~", "");
          const [idealHour, idealMin] = cleanTime.split(":").map(Number);
          const [completedHour, completedMin] = completed.completedAt.split(":").map(Number);
          const idealMinutes = idealHour * 60 + (idealMin || 0);
          const completedMinutes = completedHour * 60 + completedMin;
          return completedMinutes > idealMinutes + 30;
        }
      }
      return false;
    },
    [completedTasks, getMergedTimeSlots]
  );

  const getCompletedTime = useCallback(
    (taskId: string, regionId: string): string | null => {
      const completed = completedTasks.find((t) => t.taskId === taskId && t.regionId === regionId);
      return completed?.completedAt || null;
    },
    [completedTasks]
  );

  const getRegionProgress = (regionId: string) => {
    const slots = getMergedTimeSlots();
    let total = 0;
    let completed = 0;
    for (const slot of slots) {
      for (const task of slot.tasks) {
        total++;
        if (isTaskCompleted(task.id, regionId)) {
          completed++;
        }
      }
    }
    return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  };

  const getStaffForRegion = (regionId: string): string => {
    return regionAssignments.find((a) => a.regionId === regionId)?.staffName || "";
  };

  const setStaffForRegion = (regionId: string, staffName: string) => {
    setRegionAssignments((prev) => {
      const filtered = prev.filter((a) => a.regionId !== regionId);
      if (staffName) {
        return [...filtered, { regionId, staffName }];
      }
      return filtered;
    });
  };

  const addCustomTask = () => {
    if (!newTaskTime || !newTaskLabel) return;
    const id = `custom-${Date.now()}`;
    const slotId = `custom-slot-${Date.now()}`;
    setCustomTasks((prev) => [
      ...prev,
      {
        slotId,
        time: newTaskTime,
        task: { id, label: newTaskLabel },
      },
    ]);
    setNewTaskTime("");
    setNewTaskLabel("");
    setShowAddTask(false);
  };

  const removeCustomTask = (taskId: string) => {
    setCustomTasks((prev) => prev.filter((ct) => ct.task.id !== taskId));
    // 完了データも削除
    setCompletedTasks((prev) => prev.filter((ct) => ct.taskId !== taskId));
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <h1 className="flex-1 text-lg font-medium text-foreground">BPO 業務進捗チェック</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>{todayKey}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground" title={syncStatus === "synced" ? "クラウド同期済み" : syncStatus === "syncing" ? "同期中..." : "同期エラー"}>
          {syncStatus === "synced" && <Cloud className="w-4 h-4 text-green-500" />}
          {syncStatus === "syncing" && <Cloud className="w-4 h-4 text-yellow-500 animate-pulse" />}
          {syncStatus === "error" && <CloudOff className="w-4 h-4 text-destructive" />}
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors disabled:opacity-50"
          aria-label="ログアウト"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">ログアウト</span>
        </button>
      </header>

      {/* Legend */}
      <div className="px-4 py-2 bg-card border-b border-border flex items-center gap-2 text-sm">
        <span className="inline-block w-4 h-4 bg-yellow-300 border border-yellow-400" />
        <span className="text-muted-foreground">黄色マーカー：理想時間より30分以上遅く完了</span>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4">
        {selectedRegion === null ? (
          <RegionSelector
            getRegionProgress={getRegionProgress}
            getStaffForRegion={getStaffForRegion}
            setStaffForRegion={setStaffForRegion}
            onSelectRegion={setSelectedRegion}
          />
        ) : (
          <div>
            {/* 戻るボタン */}
            <button
              onClick={() => setSelectedRegion(null)}
              className="mb-4 px-3 py-2 text-sm bg-card border border-border rounded-lg hover:bg-accent/50 transition-colors"
            >
              ← 地域選択に戻る
            </button>

            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-medium text-foreground">
                  {regionList.find((r) => r.id === selectedRegion)?.name}のタスク
                </h2>
                {getStaffForRegion(selectedRegion) && (
                  <p className="text-sm text-muted-foreground">
                    担当者: {getStaffForRegion(selectedRegion)}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowAddTask(!showAddTask)}
                className="flex items-center gap-1 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                タスク追加
              </button>
            </div>

            {/* タスク追加フォーム */}
            {showAddTask && (
              <div className="mb-4 p-4 bg-card border border-border rounded-lg">
                <h3 className="text-sm font-medium text-foreground mb-3">新規タスク追加</h3>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="時間帯 (例: 14:00)"
                      value={newTaskTime}
                      onChange={(e) => setNewTaskTime(e.target.value)}
                      className="flex-1 px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground"
                    />
                    <input
                      type="text"
                      placeholder="タスク名"
                      value={newTaskLabel}
                      onChange={(e) => setNewTaskLabel(e.target.value)}
                      className="flex-[2] px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowAddTask(false)}
                      className="px-3 py-2 text-sm bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={addCustomTask}
                      disabled={!newTaskTime || !newTaskLabel}
                      className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      追加
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* タスクテーブル */}
            <div className="overflow-auto">
              <table className="w-full border-collapse text-sm bg-card border border-border rounded-lg overflow-hidden">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="p-3 text-left font-medium text-foreground">理想時間</th>
                    <th className="p-3 text-left font-medium text-foreground">タスク</th>
                    <th className="p-3 text-center font-medium text-foreground w-16">完了</th>
                    <th className="p-3 text-center font-medium text-foreground w-20">完了時刻</th>
                    <th className="p-3 text-left font-medium text-foreground">備考</th>
                  </tr>
                </thead>
                <tbody>
                  {getMergedTimeSlots().map((slot) => (
                    <TimeSlotRows
                      key={slot.id}
                      slot={slot}
                      selectedRegion={selectedRegion}
                      isTaskCompleted={isTaskCompleted}
                      isLate={isLate}
                      getCompletedTime={getCompletedTime}
                      onToggle={toggleTask}
                      customTasks={customTasks}
                      onRemoveCustomTask={removeCustomTask}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* 業務日報セクション */}
            <ReportSection report={report} setReport={setReport} />
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <footer className="border-t border-border px-4 py-3 bg-card">
        <div className="flex justify-center gap-8">
          <div className="flex flex-col items-center gap-1 text-primary">
            <Clock className="w-5 h-5" />
            <span className="text-xs">作業入力</span>
          </div>
          <Link href="/admin" className="flex flex-col items-center gap-1 text-muted-foreground">
            <Users className="w-5 h-5" />
            <span className="text-xs">管理画面</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}

// --- Region Selector ---

interface RegionSelectorProps {
  getRegionProgress: (regionId: string) => { total: number; completed: number; percentage: number };
  getStaffForRegion: (regionId: string) => string;
  setStaffForRegion: (regionId: string, staffName: string) => void;
  onSelectRegion: (regionId: string) => void;
}

function RegionSelector({
  getRegionProgress,
  getStaffForRegion,
  setStaffForRegion,
  onSelectRegion,
}: RegionSelectorProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-muted-foreground mb-3">
        地域を選択してください（担当者を選択後、地域をタップ）
      </h2>
      <div className="grid grid-cols-1 gap-3">
        {regionList.map((region) => {
          const progress = getRegionProgress(region.id);
          const staff = getStaffForRegion(region.id);
          return (
            <div key={region.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <select
                  value={staff}
                  onChange={(e) => {
                    e.stopPropagation();
                    setStaffForRegion(region.id, e.target.value);
                  }}
                  className="px-2 py-1.5 bg-input border border-border rounded text-sm text-foreground"
                  aria-label={`${region.name}の担当���選���`}
                >
                  <option value="">担当者選択</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => onSelectRegion(region.id)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-foreground">{region.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {progress.completed}/{progress.total}
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
                {staff && (
                  <p className="mt-1 text-xs text-muted-foreground">担当: {staff}</p>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Report Section (業務日報) ---

interface ReportSectionProps {
  report: DailyReport;
  setReport: (updater: DailyReport | ((prev: DailyReport) => DailyReport)) => void;
}

function ReportSection({ report, setReport }: ReportSectionProps) {
  const [showNew, setShowNew] = useState(false);
  const [showShared, setShowShared] = useState(false);
  const [newItemText, setNewItemText] = useState("");
  const [sharedItemText, setSharedItemText] = useState("");

  const addItem = (section: "newItems" | "sharedItems", text: string) => {
    if (!text.trim()) return;
    const item: ReportItem = { id: `rpt-${Date.now()}`, text: text.trim(), completed: false };
    setReport((prev: DailyReport) => ({
      ...prev,
      [section]: [...prev[section], item],
    }));
    if (section === "newItems") setNewItemText("");
    else setSharedItemText("");
  };

  const toggleItem = (section: "newItems" | "sharedItems", id: string) => {
    setReport((prev: DailyReport) => ({
      ...prev,
      [section]: prev[section].map((item: ReportItem) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      ),
    }));
  };

  const removeItem = (section: "newItems" | "sharedItems", id: string) => {
    setReport((prev: DailyReport) => ({
      ...prev,
      [section]: prev[section].filter((item: ReportItem) => item.id !== id),
    }));
  };

  return (
    <div className="mt-6 bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/50">
        <h3 className="font-medium text-foreground">D.I.GATE(株) 業務日報</h3>
      </div>

      {/* 本日の新規事案 */}
      <div className="border-b border-border">
        <button
          onClick={() => setShowNew(!showNew)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors"
        >
          <span className="font-medium text-foreground text-sm">本日の新規事案</span>
          <div className="flex items-center gap-2">
            {report.newItems.length > 0 && (
              <span className="text-xs text-muted-foreground">{report.newItems.length}件</span>
            )}
            {showNew ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>
        {showNew && (
          <div className="px-4 pb-4">
            <ul className="space-y-2 mb-3">
              {report.newItems.map((item) => (
                <li key={item.id} className="flex items-start gap-2">
                  <button
                    onClick={() => toggleItem("newItems", item.id)}
                    className={`mt-0.5 w-4 h-4 border-2 rounded flex-shrink-0 flex items-center justify-center transition-colors ${
                      item.completed ? "bg-primary border-primary" : "border-muted-foreground"
                    }`}
                    aria-label={item.completed ? "完了済み" : "未完了"}
                  >
                    {item.completed && (
                      <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span className={`text-sm flex-1 ${item.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {item.text}
                  </span>
                  <button onClick={() => removeItem("newItems", item.id)} className="text-muted-foreground hover:text-destructive flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="新規事案を入力..."
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addItem("newItems", newItemText);
                }}
                className="flex-1 px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground"
              />
              <button
                onClick={() => addItem("newItems", newItemText)}
                disabled={!newItemText.trim()}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-50"
              >
                追加
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 業務上の共有事項 */}
      <div>
        <button
          onClick={() => setShowShared(!showShared)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors"
        >
          <span className="font-medium text-foreground text-sm">業務上の共有事項</span>
          <div className="flex items-center gap-2">
            {report.sharedItems.length > 0 && (
              <span className="text-xs text-muted-foreground">{report.sharedItems.length}件</span>
            )}
            {showShared ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>
        {showShared && (
          <div className="px-4 pb-4">
            <ul className="space-y-2 mb-3">
              {report.sharedItems.map((item) => (
                <li key={item.id} className="flex items-start gap-2">
                  <button
                    onClick={() => toggleItem("sharedItems", item.id)}
                    className={`mt-0.5 w-4 h-4 border-2 rounded flex-shrink-0 flex items-center justify-center transition-colors ${
                      item.completed ? "bg-primary border-primary" : "border-muted-foreground"
                    }`}
                    aria-label={item.completed ? "完了済み" : "未完了"}
                  >
                    {item.completed && (
                      <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span className={`text-sm flex-1 ${item.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {item.text}
                  </span>
                  <button onClick={() => removeItem("sharedItems", item.id)} className="text-muted-foreground hover:text-destructive flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="共有事項を入力..."
                value={sharedItemText}
                onChange={(e) => setSharedItemText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addItem("sharedItems", sharedItemText);
                }}
                className="flex-1 px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground"
              />
              <button
                onClick={() => addItem("sharedItems", sharedItemText)}
                disabled={!sharedItemText.trim()}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-50"
              >
                追加
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- TimeSlotRows ---

interface TimeSlotRowsProps {
  slot: { id: string; time: string; tasks: TaskItem[] };
  selectedRegion: string;
  isTaskCompleted: (taskId: string, regionId: string) => boolean;
  isLate: (taskId: string, regionId: string) => boolean;
  getCompletedTime: (taskId: string, regionId: string) => string | null;
  onToggle: (taskId: string, regionId: string) => void;
  customTasks: CustomTask[];
  onRemoveCustomTask: (taskId: string) => void;
}

function TimeSlotRows({
  slot,
  selectedRegion,
  isTaskCompleted,
  isLate,
  getCompletedTime,
  onToggle,
  customTasks,
  onRemoveCustomTask,
}: TimeSlotRowsProps) {
  const filteredTasks = slot.tasks;
  if (filteredTasks.length === 0) return null;

  const isCustom = (taskId: string) => customTasks.some((ct) => ct.task.id === taskId);

  return (
    <>
      {filteredTasks.map((task, taskIndex) => (
        <tr key={task.id} className="border-b border-border hover:bg-accent/50">
          {taskIndex === 0 ? (
            <td className="p-3 text-foreground font-medium align-top" rowSpan={filteredTasks.length}>
              {slot.time}
            </td>
          ) : null}

          <td className="p-3 text-foreground">
            <div className="flex items-center gap-1">
              <span className={task.isSubTask ? "pl-4" : ""}>
                {task.isSubTask ? "→ " : ""}
                {task.label}
              </span>
              {isCustom(task.id) && (
                <button
                  onClick={() => onRemoveCustomTask(task.id)}
                  className="ml-1 text-muted-foreground hover:text-destructive flex-shrink-0"
                  aria-label="カスタムタスクを削除"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </td>

          <td className="p-3 text-center">
            <TaskCheckbox
              checked={isTaskCompleted(task.id, selectedRegion)}
              isLate={isLate(task.id, selectedRegion)}
              onChange={() => onToggle(task.id, selectedRegion)}
            />
          </td>

          <td
            className={`p-3 text-center text-sm ${
              isLate(task.id, selectedRegion)
                ? "bg-yellow-100 text-yellow-800 font-medium"
                : "text-muted-foreground"
            }`}
          >
            {getCompletedTime(task.id, selectedRegion) || "-"}
          </td>

          <td className="p-3 text-muted-foreground text-xs">{task.note}</td>
        </tr>
      ))}
    </>
  );
}

// --- Checkbox ---

interface TaskCheckboxProps {
  checked: boolean;
  isLate: boolean;
  onChange: () => void;
}

function TaskCheckbox({ checked, isLate, onChange }: TaskCheckboxProps) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
        checked
          ? isLate
            ? "bg-yellow-300 border-yellow-400"
            : "bg-primary border-primary"
          : "border-muted-foreground hover:border-primary"
      }`}
      aria-label={checked ? "タスク完了済み" : "タスク未完了"}
    >
      {checked && (
        <svg
          className={`w-3 h-3 ${isLate ? "text-foreground" : "text-primary-foreground"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}
