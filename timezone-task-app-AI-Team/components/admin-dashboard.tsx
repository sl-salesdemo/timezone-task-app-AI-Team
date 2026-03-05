"use client";

import { useState, useEffect, useCallback } from "react";
import { defaultTimeSlots, regionList, type TimeSlot, type TaskItem } from "@/lib/task-data";
import { ChevronLeft, Users, BarChart3, Clock, Download, Calendar, FileText } from "lucide-react";
import Link from "next/link";

// Same types as task-checker
interface CompletedTask {
  taskId: string;
  regionId: string;
  completedAt: string;
}

interface ReportItem {
  id: string;
  text: string;
  completed: boolean;
}

interface DailyReport {
  newItems: ReportItem[];
  sharedItems: ReportItem[];
}

interface RegionAssignment {
  regionId: string;
  staffName: string;
}

interface CustomTask {
  slotId: string;
  time: string;
  task: TaskItem;
}

interface DaySaveData {
  completedTasks: CompletedTask[];
  report: DailyReport;
  regionAssignments: RegionAssignment[];
  customTasks: CustomTask[];
  savedAt: string;
}

function getDateKey(date?: Date): string {
  const d = date || new Date();
  return d.toISOString().split("T")[0];
}

function getStorageKey(dateKey: string): string {
  return `task-checker-v3-${dateKey}`;
}

function loadDayData(dateKey: string): DaySaveData {
  const key = getStorageKey(dateKey);
  const stored = localStorage.getItem(key);
  if (stored) return JSON.parse(stored);
  return {
    completedTasks: [],
    report: { newItems: [], sharedItems: [] },
    regionAssignments: [],
    customTasks: [],
    savedAt: "",
  };
}

// 履歴の日付リストを取得（最大2ヶ月分）
function getAvailableDates(): string[] {
  const dates: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("task-checker-v3-")) {
      const dateStr = key.replace("task-checker-v3-", "");
      dates.push(dateStr);
    }
  }
  return dates.sort((a, b) => b.localeCompare(a));
}

function getMergedTimeSlots(customTasks: CustomTask[]): TimeSlot[] {
  const slots = defaultTimeSlots.map((s) => ({ ...s, tasks: [...s.tasks] }));
  for (const ct of customTasks) {
    const existing = slots.find((s) => s.time === ct.time);
    if (existing) {
      existing.tasks.push(ct.task);
    } else {
      slots.push({ id: ct.slotId, time: ct.time, tasks: [ct.task] });
    }
  }
  slots.sort((a, b) => {
    const toMin = (t: string) => {
      const clean = t.replace("~", "");
      const [h, m] = clean.split(":").map(Number);
      return h * 60 + (m || 0);
    };
    return toMin(a.time) - toMin(b.time);
  });
  return slots;
}

export function AdminDashboard() {
  const [selectedDate, setSelectedDate] = useState(getDateKey());
  const [dayData, setDayData] = useState<DaySaveData | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setAvailableDates(getAvailableDates());
    setDayData(loadDayData(selectedDate));
    setIsLoaded(true);
  }, [selectedDate]);

  const mergedSlots = useCallback(() => {
    if (!dayData) return defaultTimeSlots;
    return getMergedTimeSlots(dayData.customTasks);
  }, [dayData]);

  const getRegionTaskCount = (): number => {
    let count = 0;
    for (const slot of mergedSlots()) {
      count += slot.tasks.length;
    }
    return count;
  };

  const getCompletedCountForRegion = (regionId: string): number => {
    if (!dayData) return 0;
    return dayData.completedTasks.filter((t) => t.regionId === regionId).length;
  };

  const getStaffForRegion = (regionId: string): string => {
    if (!dayData) return "";
    return dayData.regionAssignments.find((a) => a.regionId === regionId)?.staffName || "";
  };

  const totalProgress = {
    completed: dayData?.completedTasks.length || 0,
    total: getRegionTaskCount() * regionList.length,
  };

  const progressPercent =
    totalProgress.total > 0
      ? Math.round((totalProgress.completed / totalProgress.total) * 100)
      : 0;

  // CSV全体ダウンロード
  const downloadCSV = () => {
    if (!dayData) return;

    const slots = mergedSlots();
    let csvContent = "地域,担当者,理想時間,タスク,完了,完了時刻,遅延,備考\n";

    for (const region of regionList) {
      const staff = getStaffForRegion(region.id);
      for (const slot of slots) {
        for (const task of slot.tasks) {
          const completed = dayData.completedTasks.find(
            (t) => t.taskId === task.id && t.regionId === region.id
          );
          const isCompleted = !!completed;
          const completedAt = completed?.completedAt || "";

          let isLate = false;
          if (completed) {
            const cleanTime = slot.time.replace("~", "");
            const [idealHour, idealMin] = cleanTime.split(":").map(Number);
            const [completedHour, completedMin] = completed.completedAt.split(":").map(Number);
            const idealMinutes = idealHour * 60 + (idealMin || 0);
            const completedMinutes = completedHour * 60 + completedMin;
            isLate = completedMinutes > idealMinutes + 30;
          }

          const noteClean = (task.note || "").replace(/,/g, "、");
          csvContent += `${region.name},${staff},${slot.time},${task.label},${isCompleted ? "完了" : "未完了"},${completedAt},${isLate ? "遅延" : ""},${noteClean}\n`;
        }
      }
    }

    // 業務日報
    if (dayData.report.newItems.length > 0 || dayData.report.sharedItems.length > 0) {
      csvContent += "\n--- 業務日報 ---\n";
      csvContent += "区分,内容,完了\n";
      for (const item of dayData.report.newItems) {
        csvContent += `新規事案,${item.text.replace(/,/g, "、")},${item.completed ? "完了" : "未完了"}\n`;
      }
      for (const item of dayData.report.sharedItems) {
        csvContent += `共有事項,${item.text.replace(/,/g, "、")},${item.completed ? "完了" : "未完了"}\n`;
      }
    }

    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const blob = new Blob([bom, csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `業務進捗_全体_${selectedDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Link href="/" className="text-foreground">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <h1 className="flex-1 text-lg font-medium text-foreground">地域別 進捗管理</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        {/* 日付選択 */}
        <div className="mb-4 flex items-center gap-3">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground"
            aria-label="日付選択"
          >
            {/* 本日がリストに無い場合追加 */}
            {!availableDates.includes(getDateKey()) && (
              <option value={getDateKey()}>{getDateKey()}（本日）</option>
            )}
            {availableDates.map((d) => (
              <option key={d} value={d}>
                {d}
                {d === getDateKey() ? "（本日）" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Overall Progress Card */}
        <div className="bg-card rounded-lg p-4 mb-6 border border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{selectedDate} の全体進捗</p>
              <p className="text-2xl font-bold text-foreground">
                {totalProgress.completed} / {totalProgress.total}
              </p>
            </div>
            <div className="ml-auto">
              <div className="text-3xl font-bold text-primary">{progressPercent}%</div>
            </div>
          </div>
          <div className="w-full bg-secondary rounded-full h-2 mb-3">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <button
            onClick={downloadCSV}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">全体CSVダウンロード</span>
          </button>
        </div>

        {/* 最終保存時刻 */}
        {dayData?.savedAt && (
          <p className="text-xs text-muted-foreground mb-4">
            最終保存: {new Date(dayData.savedAt).toLocaleString("ja-JP")}
          </p>
        )}

        {/* Region Progress Grid */}
        <h2 className="text-foreground font-medium mb-3">地域別進捗</h2>
        <div className="grid grid-cols-1 gap-3 mb-6">
          {regionList.map((region) => {
            const regionTaskCount = getRegionTaskCount();
            const regionCompleted = getCompletedCountForRegion(region.id);
            const percent =
              regionTaskCount > 0 ? Math.round((regionCompleted / regionTaskCount) * 100) : 0;
            const staff = getStaffForRegion(region.id);

            return (
              <div key={region.id} className="bg-card rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-foreground">{region.name}</h3>
                    {staff && <p className="text-xs text-muted-foreground">担当: {staff}</p>}
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      percent === 100 ? "text-green-500" : "text-primary"
                    }`}
                  >
                    {percent}%
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 mb-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      percent === 100 ? "bg-green-500" : "bg-primary"
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {regionCompleted} / {regionTaskCount} 完了
                </p>
              </div>
            );
          })}
        </div>

        {/* 要求仕様書ダウンロード */}
        <div className="bg-card rounded-lg border border-border p-4 mb-6">
          <h2 className="font-medium text-foreground mb-3">ドキュメント</h2>
          <a
            href="/docs/requirements-specification.md"
            download="BPO業務進捗チェックシステム_要求仕様書.md"
            className="flex items-center gap-2 px-4 py-2.5 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span className="text-sm font-medium">要求仕様書ダウンロード</span>
          </a>
        </div>

        {/* 業務日報表示 */}
        {dayData && (dayData.report.newItems.length > 0 || dayData.report.sharedItems.length > 0) && (
          <div className="bg-card rounded-lg border border-border p-4">
            <h2 className="font-medium text-foreground mb-3">D.I.GATE(株) 業務日報</h2>
            {dayData.report.newItems.length > 0 && (
              <div className="mb-3">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">本日の新規事案</h3>
                <ul className="space-y-1">
                  {dayData.report.newItems.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-sm">
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          item.completed ? "bg-green-500" : "bg-muted-foreground"
                        }`}
                      />
                      <span
                        className={item.completed ? "line-through text-muted-foreground" : "text-foreground"}
                      >
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {dayData.report.sharedItems.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">業務上の共有事項</h3>
                <ul className="space-y-1">
                  {dayData.report.sharedItems.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-sm">
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          item.completed ? "bg-green-500" : "bg-muted-foreground"
                        }`}
                      />
                      <span
                        className={item.completed ? "line-through text-muted-foreground" : "text-foreground"}
                      >
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <footer className="border-t border-border px-4 py-3">
        <div className="flex justify-center gap-8">
          <Link href="/" className="flex flex-col items-center gap-1 text-muted-foreground">
            <Clock className="w-5 h-5" />
            <span className="text-xs">作業入力</span>
          </Link>
          <div className="flex flex-col items-center gap-1 text-primary">
            <Users className="w-5 h-5" />
            <span className="text-xs">管理画面</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
