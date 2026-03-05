"use client";

import { useState, useEffect, useCallback } from "react";
import { defaultTimeSlots, regionList, type TimeSlot, type TaskItem } from "@/lib/task-data";
import { ChevronLeft, Users, BarChart3, Clock, Download, Calendar, FileText, LogOut, AlertTriangle, Filter } from "lucide-react";
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
  getAvailableDates,
  getEmptyDayData,
} from "@/lib/storage";

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

interface AdminDashboardProps {
  userId: string;
}

export function AdminDashboard({ userId }: AdminDashboardProps) {
  const supabase = createClient();
  const [selectedDate, setSelectedDate] = useState(getDateKey());
  const [dayData, setDayData] = useState<DaySaveData | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [showDelayedOnly, setShowDelayedOnly] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const dates = await getAvailableDates(userId);
      setAvailableDates(dates);
      const data = await loadDayData(userId, selectedDate);
      setDayData(data);
      setIsLoaded(true);
    };
    loadData();
  }, [selectedDate, userId]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
  };

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

  // Check if a region has delayed tasks
  const getDelayedTaskCount = (regionId: string): number => {
    if (!dayData) return 0;
    let delayedCount = 0;
    
    for (const slot of mergedSlots()) {
      for (const task of slot.tasks) {
        const completed = dayData.completedTasks.find(
          (t) => t.taskId === task.id && t.regionId === regionId
        );
        if (completed) {
          const cleanTime = slot.time.replace("~", "");
          const [idealHour, idealMin] = cleanTime.split(":").map(Number);
          const [completedHour, completedMin] = completed.completedAt.split(":").map(Number);
          const idealMinutes = idealHour * 60 + (idealMin || 0);
          const completedMinutes = completedHour * 60 + completedMin;
          if (completedMinutes > idealMinutes + 30) {
            delayedCount++;
          }
        }
      }
    }
    return delayedCount;
  };

  // Filter regions based on selection
  const filteredRegions = regionList.filter((region) => {
    if (regionFilter !== "all" && region.id !== regionFilter) return false;
    if (showDelayedOnly && getDelayedTaskCount(region.id) === 0) return false;
    return true;
  });

  const totalProgress = {
    completed: dayData?.completedTasks.length || 0,
    total: getRegionTaskCount() * regionList.length,
  };

  const progressPercent =
    totalProgress.total > 0
      ? Math.round((totalProgress.completed / totalProgress.total) * 100)
      : 0;

  // Total delayed count across all regions
  const totalDelayedCount = regionList.reduce((sum, region) => sum + getDelayedTaskCount(region.id), 0);

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
        <div className="bg-card rounded-lg p-4 mb-4 border border-border">
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
          
          {/* Delayed Tasks Alert */}
          {totalDelayedCount > 0 && (
            <div className="flex items-center gap-2 p-3 mb-3 bg-yellow-100 border border-yellow-300 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <span className="text-sm text-yellow-800">
                遅延タスク: <strong>{totalDelayedCount}件</strong>（30分以上遅延）
              </span>
            </div>
          )}

          <button
            onClick={downloadCSV}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">全体CSVダウンロード</span>
          </button>
        </div>

        {/* Filter Section */}
        <div className="bg-card rounded-lg p-4 mb-4 border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">フィルタ</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground"
              aria-label="地域フィルタ"
            >
              <option value="all">すべての地域</option>
              {regionList.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showDelayedOnly}
                onChange={(e) => setShowDelayedOnly(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground">遅延ありのみ表示</span>
            </label>
          </div>
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
          {filteredRegions.map((region) => {
            const regionTaskCount = getRegionTaskCount();
            const regionCompleted = getCompletedCountForRegion(region.id);
            const percent =
              regionTaskCount > 0 ? Math.round((regionCompleted / regionTaskCount) * 100) : 0;
            const staff = getStaffForRegion(region.id);
            const delayedCount = getDelayedTaskCount(region.id);
            const hasDelay = delayedCount > 0;

            return (
              <div 
                key={region.id} 
                className={`bg-card rounded-lg border p-4 ${
                  hasDelay 
                    ? "border-yellow-400 bg-yellow-50" 
                    : "border-border"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">{region.name}</h3>
                      {hasDelay && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-200 text-yellow-800 text-xs rounded-full">
                          <AlertTriangle className="w-3 h-3" />
                          {delayedCount}件遅延
                        </span>
                      )}
                    </div>
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
                      percent === 100 ? "bg-green-500" : hasDelay ? "bg-yellow-500" : "bg-primary"
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
          {filteredRegions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              条件に一致する地域がありません
            </div>
          )}
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
