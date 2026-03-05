import { createClient } from "@/lib/supabase/client";

// Types for task data
export interface CompletedTask {
  taskId: string;
  regionId: string;
  completedAt: string;
}

export interface ReportItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface DailyReport {
  newItems: ReportItem[];
  sharedItems: ReportItem[];
}

export interface RegionAssignment {
  regionId: string;
  staffName: string;
}

export interface CustomTask {
  slotId: string;
  time: string;
  task: {
    id: string;
    label: string;
    note?: string;
    isSubTask?: boolean;
  };
}

export interface DaySaveData {
  completedTasks: CompletedTask[];
  report: DailyReport;
  regionAssignments: RegionAssignment[];
  customTasks: CustomTask[];
  savedAt: string;
}

export function getDateKey(date?: Date): string {
  const d = date || new Date();
  return d.toISOString().split("T")[0];
}

// LocalStorage functions (fallback)
function getLocalStorageKey(dateKey: string): string {
  return `task-checker-v3-${dateKey}`;
}

export function loadFromLocalStorage(dateKey: string): DaySaveData {
  if (typeof window === "undefined") {
    return getEmptyDayData();
  }
  
  const key = getLocalStorageKey(dateKey);
  const stored = localStorage.getItem(key);
  if (stored) {
    return JSON.parse(stored);
  }
  return getEmptyDayData();
}

export function saveToLocalStorage(data: DaySaveData, dateKey: string) {
  if (typeof window === "undefined") return;
  
  const key = getLocalStorageKey(dateKey);
  data.savedAt = new Date().toISOString();
  localStorage.setItem(key, JSON.stringify(data));
}

export function getEmptyDayData(): DaySaveData {
  return {
    completedTasks: [],
    report: { newItems: [], sharedItems: [] },
    regionAssignments: [],
    customTasks: [],
    savedAt: "",
  };
}

// Supabase storage functions
export async function loadFromSupabase(userId: string, dateKey: string): Promise<DaySaveData | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from("day_data")
    .select("*")
    .eq("user_id", userId)
    .eq("date_key", dateKey)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No data found - this is not an error
      return null;
    }
    console.error("Error loading from Supabase:", error);
    return null;
  }

  if (!data) return null;

  return {
    completedTasks: data.completed_tasks || [],
    report: data.report || { newItems: [], sharedItems: [] },
    regionAssignments: data.region_assignments || [],
    customTasks: data.custom_tasks || [],
    savedAt: data.saved_at || "",
  };
}

export async function saveToSupabase(
  userId: string,
  dateKey: string,
  dayData: DaySaveData
): Promise<boolean> {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("day_data")
    .upsert(
      {
        user_id: userId,
        date_key: dateKey,
        completed_tasks: dayData.completedTasks,
        report: dayData.report,
        region_assignments: dayData.regionAssignments,
        custom_tasks: dayData.customTasks,
        saved_at: now,
      },
      {
        onConflict: "user_id,date_key",
      }
    );

  if (error) {
    console.error("Error saving to Supabase:", error);
    return false;
  }

  return true;
}

// Combined storage with Supabase primary, localStorage fallback
export async function loadDayData(userId: string | null, dateKey: string): Promise<DaySaveData> {
  // Try Supabase first if user is logged in
  if (userId) {
    const supabaseData = await loadFromSupabase(userId, dateKey);
    if (supabaseData) {
      return supabaseData;
    }
  }

  // Fallback to localStorage
  return loadFromLocalStorage(dateKey);
}

export async function saveDayData(
  userId: string | null,
  dateKey: string,
  data: DaySaveData
): Promise<void> {
  // Always save to localStorage as backup
  saveToLocalStorage(data, dateKey);

  // If logged in, also save to Supabase
  if (userId) {
    await saveToSupabase(userId, dateKey, data);
  }
}

// Clean up old localStorage data (keep last 2 months)
export function cleanupOldLocalData() {
  if (typeof window === "undefined") return;
  
  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
  const cutoff = getDateKey(twoMonthsAgo);

  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith("task-checker-v3-")) {
      const dateStr = key.replace("task-checker-v3-", "");
      if (dateStr < cutoff) {
        localStorage.removeItem(key);
      }
    }
  }
}

// Get available dates from localStorage (for admin dashboard)
export function getAvailableDatesFromLocalStorage(): string[] {
  if (typeof window === "undefined") return [];
  
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

// Get available dates from Supabase
export async function getAvailableDatesFromSupabase(userId: string): Promise<string[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from("day_data")
    .select("date_key")
    .eq("user_id", userId)
    .order("date_key", { ascending: false });

  if (error) {
    console.error("Error getting dates from Supabase:", error);
    return [];
  }

  return data?.map((d) => d.date_key) || [];
}

// Combined function to get all available dates
export async function getAvailableDates(userId: string | null): Promise<string[]> {
  const localDates = getAvailableDatesFromLocalStorage();
  
  if (userId) {
    const supabaseDates = await getAvailableDatesFromSupabase(userId);
    // Merge and deduplicate
    const allDates = [...new Set([...localDates, ...supabaseDates])];
    return allDates.sort((a, b) => b.localeCompare(a));
  }

  return localDates;
}
