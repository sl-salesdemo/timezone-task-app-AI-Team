export interface TaskItem {
  id: string;
  label: string;
  scheduledTime?: string;
  note?: string;
  isSubTask?: boolean;
}

export interface Staff {
  id: string;
  name: string;
}

export const staffList: Staff[] = [
  { id: "sato", name: "佐藤" },
  { id: "tanaka", name: "田中" },
  { id: "suzuki", name: "鈴木" },
  { id: "kato", name: "加藤" },
  { id: "hiraga", name: "平賀" },
];

export interface Region {
  id: string;
  name: string;
}

export const regionList: Region[] = [
  { id: "kanto", name: "関東" },
  { id: "kansai", name: "関西" },
  { id: "kyushu", name: "九州" },
  { id: "tokai", name: "東海" },
  { id: "hokkaido", name: "北海道" },
  { id: "tohoku", name: "東北" },
  { id: "okinawa", name: "沖縄" },
];

export interface TimeSlot {
  id: string;
  time: string;
  tasks: TaskItem[];
}

// デフォルトのタスクリスト
export const defaultTimeSlots: TimeSlot[] = [
  {
    id: "730",
    time: "7:30",
    tasks: [
      { id: "730-1", label: "e-winds csvダウンロード" },
      { id: "730-2", label: "e-winds 欠品対応リスト作成" },
      { id: "730-3", label: "line共有", isSubTask: true },
      { id: "730-4", label: "googleスペース格納", isSubTask: true },
    ],
  },
  {
    id: "800",
    time: "8:00",
    tasks: [
      { id: "800-1", label: "セットサブリスト作成" },
      { id: "800-2", label: "取り込み", isSubTask: true },
      { id: "800-3", label: "欠品振替業務" },
      { id: "800-4", label: "リスト作成", isSubTask: true },
      { id: "800-5", label: "追加伝票作成", isSubTask: true },
      { id: "800-6", label: "追加伝票作取り込み", isSubTask: true },
      { id: "800-7", label: "e-winds 欠品調整処理", isSubTask: true },
    ],
  },
  {
    id: "930",
    time: "9:30",
    tasks: [
      { id: "930-1", label: "出荷確定メール送信" },
      { id: "930-2", label: "e-winds 仕入先直送確認依頼", isSubTask: true },
      { id: "930-3", label: "ダブルチェック", note: "北海道、東北" },
      { id: "930-4", label: "欠品直送処理", note: "東北誤った商品" },
      { id: "930-5", label: "フラグチェックドライブ記載" },
      { id: "930-6", label: "欠品振替表フォルダ格納" },
    ],
  },
  {
    id: "1140",
    time: "11:40",
    tasks: [
      { id: "1140-1", label: "欠品対応入力 残数確認" },
    ],
  },
  {
    id: "1200",
    time: "12:00",
    tasks: [
      { id: "1200-1", label: "確定データ保存", note: "※13時以降となってしまった場合は必ず遅れる旨連絡" },
    ],
  },
  {
    id: "1300",
    time: "13:00",
    tasks: [
      { id: "1300-1", label: "京樽FLI欠品報告", note: "※水、日は京樽なし。土はFLIなし。" },
      { id: "1300-2", label: "欠品振替サマリ更新" },
    ],
  },
  {
    id: "1300b",
    time: "13:00~",
    tasks: [
      { id: "1300b-1", label: "補充業務" },
    ],
  },
  {
    id: "1500",
    time: "15:00",
    tasks: [
      { id: "1500-1", label: "フラグ操作（FCL）" },
      { id: "1500-2", label: "フラグ操作（立て替え）" },
    ],
  },
  {
    id: "1630",
    time: "16:30",
    tasks: [
      { id: "1630-1", label: "SKUフラグチェックシート更新" },
    ],
  },
];
