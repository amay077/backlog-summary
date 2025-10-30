#!/usr/bin/env node
import { config } from 'dotenv';
import { Command } from 'commander';
import { createObjectCsvWriter } from 'csv-writer';
import dayjs, { Dayjs } from 'dayjs';
import * as fs from 'fs';
import * as path from 'path';
import * as iconv from 'iconv-lite';

// .env ファイルを読み込む
config();

// 型定義
interface BacklogActivity {
  id: number;
  project: {
    id: number;
    projectKey: string;
    name: string;
  };
  type: number;
  content: {
    id?: number;
    key_id?: number;
    summary?: string;
    description?: string;
    comment?: {
      id: number;
      content: string;
    };
    changes?: Array<{ field: string; new_value: string; old_value: string }>;
    link?: Array<{
      id: number;
      key_id: number;
      title: string;
      comment: {
        id: number;
        content: string;
      };
    }>;
    name?: string;
    version?: number;
    repository?: {
      id: number;
      name: string;
    };
    revisions?: Array<{
      rev: string;
      comment: string;
    }>;
  };
  created: string;
}

interface Activity {
  datetime: string;  // YYYY/MM/DD HH:mm:ss
  projectKey: string;
  projectName: string;
  activityType: string;
  title: string;
}

interface SummaryData {
  date: string;  // YYYY-MM-DD
  startTime: string;  // HH:mm
  endTime: string;  // HH:mm
  workingHours: number;  // 稼動時間（小数、例: 8.5）
  projectWorkingHours: Map<string, number>;  // プロジェクト別稼動時間（小数、例: 4.5）
  projectStats: Map<string, {
    count: number;
    minDatetime: string;
    maxDatetime: string;
  }>;
}

// 環境変数の検証
function validateEnv(): { spaceId: string; apiKey: string } {
  const spaceId = process.env.BACKLOG_SPACE_ID;
  const apiKey = process.env.BACKLOG_API_KEY;

  if (!spaceId) {
    console.error('エラー: 環境変数 BACKLOG_SPACE_ID が設定されていません。.env ファイルまたは環境変数で設定してください。');
    process.exit(1);
  }

  if (!apiKey) {
    console.error('エラー: 環境変数 BACKLOG_API_KEY が設定されていません。.env ファイルまたは環境変数で設定してください。');
    process.exit(1);
  }

  return { spaceId, apiKey };
}

// コマンドライン引数のパース
function parseArguments(): { month: string; encoding: 'shift-jis' | 'utf-8' } {
  const program = new Command();

  program
    .name('generate-monthly-report')
    .description('Backlog の月次報告書を生成する')
    .requiredOption('--month <YYYY-MM>', '対象月（YYYY-MM 形式）')
    .option('--encoding <encoding>', 'CSV ファイルのエンコーディング（shift-jis または utf-8）', 'shift-jis')
    .parse();

  const options = program.opts();
  const month = options.month as string;
  const encoding = options.encoding as string;

  // 月フォーマットの検証
  if (!/^\d{4}-\d{2}$/.test(month)) {
    console.error('エラー: 月のフォーマットが不正です。YYYY-MM 形式で指定してください。');
    process.exit(1);
  }

  // エンコーディングの検証
  if (encoding !== 'shift-jis' && encoding !== 'utf-8') {
    console.error('エラー: エンコーディングは shift-jis または utf-8 を指定してください。');
    process.exit(1);
  }

  return { month, encoding: encoding as 'shift-jis' | 'utf-8' };
}

// Backlog API: ユーザー認証
async function authenticateUser(domain: string, apiKey: string): Promise<number> {
  const url = `https://${domain}/api/v2/users/myself?apiKey=${apiKey}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 401) {
        console.error('エラー: 認証に失敗しました。API キーを確認してください。');
        process.exit(1);
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const user = await response.json() as { id: number };
    return user.id;
  } catch (error) {
    console.error(`エラー: ネットワークエラーが発生しました: ${error}`);
    process.exit(1);
  }
}

// Backlog API: アクティビティ取得（ページネーション対応）
async function fetchActivities(
  domain: string,
  apiKey: string,
  userId: number,
  month: string
): Promise<BacklogActivity[]> {
  const activities: BacklogActivity[] = [];
  let maxId: number | null = null;

  // 対象月の開始日と終了日
  const startDate = dayjs(`${month}-01`).startOf('month');
  const endDate = startDate.add(1, 'month');

  console.log(`${month} のアクティビティを取得中...`);

  while (true) {
    const maxIdParam = maxId ? `&maxId=${maxId}` : '';
    const url = `https://${domain}/api/v2/users/${userId}/activities?apiKey=${apiKey}&count=100${maxIdParam}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const batch = await response.json() as BacklogActivity[];

      if (batch.length === 0) {
        break;
      }

      // 対象月のアクティビティのみフィルタリング
      const filteredBatch = batch.filter(activity => {
        const activityDate = dayjs(activity.created);
        return activityDate.isAfter(startDate) && activityDate.isBefore(endDate);
      });

      activities.push(...filteredBatch);

      // 最後のアクティビティの日付が対象月より前なら終了
      const lastActivityDate = dayjs(batch[batch.length - 1].created);
      if (lastActivityDate.isBefore(startDate)) {
        break;
      }

      maxId = batch[batch.length - 1].id;
      console.log(`  ${activities.length} 件取得...`);
    } catch (error) {
      console.error(`エラー: ネットワークエラーが発生しました: ${error}`);
      process.exit(1);
    }
  }

  console.log(`合計 ${activities.length} 件のアクティビティを取得しました。`);
  return activities;
}

// Type 14（一括更新）を個別の Type 3（コメント）に分解
function expandBulkUpdates(activities: BacklogActivity[]): BacklogActivity[] {
  const expanded: BacklogActivity[] = [];

  for (const activity of activities) {
    if (activity.type === 14 && activity.content.link) {
      // 各リンク課題に対して個別のアクティビティを生成
      for (const link of activity.content.link) {
        expanded.push({
          ...activity,
          type: 3,
          content: {
            key_id: link.key_id,
            summary: link.title,
            comment: link.comment,
          },
        });
      }
    } else {
      expanded.push(activity);
    }
  }

  return expanded;
}

// アクティビティタイプごとの処理
function processActivity(activity: BacklogActivity, domain: string): Activity | null {
  const projectKey = activity.project.projectKey;
  const projectName = activity.project.name;
  const datetime = dayjs(activity.created).format('YYYY/MM/DD HH:mm:ss');

  switch (activity.type) {
    case 1: // 課題追加
      return {
        datetime,
        projectKey,
        projectName,
        activityType: '課題を追加',
        title: activity.content.summary || '',
      };

    case 2: // 課題更新
      return {
        datetime,
        projectKey,
        projectName,
        activityType: '課題を更新',
        title: activity.content.summary || '',
      };

    case 3: // 課題コメント
      return {
        datetime,
        projectKey,
        projectName,
        activityType: '課題にコメント',
        title: activity.content.summary || '',
      };

    case 5: // Wiki 追加
      return {
        datetime,
        projectKey,
        projectName,
        activityType: 'Wiki を追加',
        title: activity.content.name || '',
      };

    case 6: // Wiki 更新
      return {
        datetime,
        projectKey,
        projectName,
        activityType: 'Wiki を更新',
        title: activity.content.name || '',
      };

    case 12: // Git push
      const commitCount = activity.content.revisions?.length || 0;
      const commitMsg = activity.content.revisions?.[0]?.comment || '';
      return {
        datetime,
        projectKey,
        projectName,
        activityType: 'PUSH',
        title: `${activity.content.repository?.name || ''} (${commitCount}件) ${commitMsg}`,
      };

    case 13: // リポジトリ作成
      return {
        datetime,
        projectKey,
        projectName,
        activityType: 'リポジトリ作成',
        title: activity.content.repository?.name || '',
      };

    default:
      return null;
  }
}

// 業務日を計算（AM6:00 基準）
function calculateBusinessDay(datetime: string): string {
  const dt = dayjs(datetime);
  const hour = dt.hour();

  // AM6:00 前は前日の業務日として扱う
  if (hour < 6) {
    return dt.subtract(1, 'day').format('YYYY-MM-DD');
  }

  return dt.format('YYYY-MM-DD');
}

// 時刻を30分刻みで丸める（四捨五入）
// 0-14分 → :00, 15-44分 → :30, 45-59分 → 次の時間の :00
function roundToNearest30Min(dt: dayjs.Dayjs): dayjs.Dayjs {
  const minute = dt.minute();

  if (minute < 15) {
    // 0-14分 → :00
    return dt.minute(0).second(0).millisecond(0);
  } else if (minute < 45) {
    // 15-44分 → :30
    return dt.minute(30).second(0).millisecond(0);
  } else {
    // 45-59分 → 次の時間の :00
    return dt.add(1, 'hour').minute(0).second(0).millisecond(0);
  }
}

// 深夜残業対応の時刻フォーマット（24時間超表記）
// 業務日の基準日と日時を渡して、HH:mm フォーマットを返す
function formatTimeWith24Plus(businessDay: string, dt: dayjs.Dayjs): string {
  const businessDayDate = dayjs(businessDay);
  const hour = dt.hour();
  const minute = dt.minute();

  // 日時が業務日より後で、かつ時刻が6時より前の場合は24時間超表記を使用
  // 例：業務日が10/28で、日時が10/29 02:00 の場合 → 26:00
  if (dt.isAfter(businessDayDate) && hour < 6) {
    // 24時間を加算
    const adjustedHour = hour + 24;
    return `${adjustedHour}:${minute.toString().padStart(2, '0')}`;
  }

  return `${hour}:${minute.toString().padStart(2, '0')}`;
}

// 時刻を時間と分にパース
function parseTime(timeStr: string): { hour: number; minute: number } {
  const [hourStr, minuteStr] = timeStr.split(':');
  return {
    hour: parseInt(hourStr, 10),
    minute: parseInt(minuteStr, 10),
  };
}

// 時刻を分単位の数値に変換（比較用）
function timeToMinutes(timeStr: string): number {
  const { hour, minute } = parseTime(timeStr);
  return hour * 60 + minute;
}

// 朝休憩コードを計算（Googleスプレッドシートのロジック）
// Y9 = IF(E9=0,0,IF("7:00"-E9>0,8,IF("8:00"-E9>0,5,IF("11:45"-E9>0,4,IF("12:45"-E9>0,1,0)))))
function calculateMorningBreakCode(startTime: string): number {
  if (!startTime) return 0;

  const startMinutes = timeToMinutes(startTime);

  if (startMinutes < timeToMinutes('7:00')) return 8;
  if (startMinutes < timeToMinutes('8:00')) return 5;
  if (startMinutes < timeToMinutes('11:45')) return 4;
  if (startMinutes < timeToMinutes('12:45')) return 1;
  return 0;
}

// 午後休憩コードを計算（Googleスプレッドシートのロジック）
// Z9 = IF(F9-"22:44">0,4,IF(F9-"22:00">0,3,IF(F9-"20:14">0,2,IF(F9-"19:30">0,1,0))))
function calculateAfternoonBreakCode(endTime: string): number {
  if (!endTime) return 0;

  const endMinutes = timeToMinutes(endTime);

  if (endMinutes > timeToMinutes('22:44')) return 4;
  if (endMinutes > timeToMinutes('22:00')) return 3;
  if (endMinutes > timeToMinutes('20:14')) return 2;
  if (endMinutes > timeToMinutes('19:30')) return 1;
  return 0;
}

// 深夜休憩コードを計算（Googleスプレッドシートのロジック）
// AA9 = IF(F9-"28:44">0,6,IF(F9-"28:00">0,5,IF(F9-"26:44">0,4,IF(F9-"26:00">0,3,IF(F9-"24:44">0,2,IF(F9-"24:00">0,1,0))))))
function calculateDeepNightBreakCode(endTime: string): number {
  if (!endTime) return 0;

  const endMinutes = timeToMinutes(endTime);

  if (endMinutes > timeToMinutes('28:44')) return 6;
  if (endMinutes > timeToMinutes('28:00')) return 5;
  if (endMinutes > timeToMinutes('26:44')) return 4;
  if (endMinutes > timeToMinutes('26:00')) return 3;
  if (endMinutes > timeToMinutes('24:44')) return 2;
  if (endMinutes > timeToMinutes('24:00')) return 1;
  return 0;
}

// 勤務開始時刻を計算（Googleスプレッドシートのロジック）
// D9 = IF(Y9=5,"8:00",IF(Y9=1,"12:45",ROUNDUP(E9/"0:15",0)*"0:15"))
function calculateWorkStartTime(startTime: string): string {
  if (!startTime) return '';

  const morningCode = calculateMorningBreakCode(startTime);

  if (morningCode === 5) return '8:00';
  if (morningCode === 1) return '12:45';

  // 15分単位で切り上げ
  const { hour, minute } = parseTime(startTime);
  const totalMinutes = hour * 60 + minute;
  const roundedMinutes = Math.ceil(totalMinutes / 15) * 15;
  const newHour = Math.floor(roundedMinutes / 60);
  const newMinute = roundedMinutes % 60;

  return `${newHour}:${newMinute.toString().padStart(2, '0')}`;
}

// 勤務終了時刻を計算（Googleスプレッドシートのロジック）
// E9 = IF(AA9=5,"28:00",IF(AA9=3,"26:00",IF(AA9=1,"24:00",IF(Z9=3,"22:00",(IF(Z9=1,"19:30",IF(AND("11:45"-F9<=0,"12:45"-F9>=0),"12:45",INT(F9/"0:15")*"0:15")))))))
function calculateWorkEndTime(endTime: string): string {
  if (!endTime) return '';

  const deepNightCode = calculateDeepNightBreakCode(endTime);
  const afternoonCode = calculateAfternoonBreakCode(endTime);
  const endMinutes = timeToMinutes(endTime);

  if (deepNightCode === 5) return '28:00';
  if (deepNightCode === 3) return '26:00';
  if (deepNightCode === 1) return '24:00';
  if (afternoonCode === 3) return '22:00';
  if (afternoonCode === 1) return '19:30';

  // 11:45 <= endTime <= 12:45 の場合は 12:45
  if (endMinutes >= timeToMinutes('11:45') && endMinutes <= timeToMinutes('12:45')) {
    return '12:45';
  }

  // 15分単位で切り捨て
  const { hour, minute } = parseTime(endTime);
  const totalMinutes = hour * 60 + minute;
  const roundedMinutes = Math.floor(totalMinutes / 15) * 15;
  const newHour = Math.floor(roundedMinutes / 60);
  const newMinute = roundedMinutes % 60;

  return `${newHour}:${newMinute.toString().padStart(2, '0')}`;
}

// 休憩時間を計算（Googleスプレッドシートのロジック）
// 休憩時間 = INT((朝休憩コード + 午後休憩コード + 深夜休憩コード) / 2) × 0.5
function calculateBreakTime(startTime: string, endTime: string): number {
  // 勤務開始・勤務終了を計算
  const workStartTime = calculateWorkStartTime(startTime);
  const workEndTime = calculateWorkEndTime(endTime);

  // これらの時刻から休憩コードを再計算
  const morningCode = calculateMorningBreakCode(workStartTime);
  const afternoonCode = calculateAfternoonBreakCode(workEndTime);
  const deepNightCode = calculateDeepNightBreakCode(workEndTime);

  const breakTime = Math.floor((morningCode + afternoonCode + deepNightCode) / 2) * 0.5;
  return breakTime;
}

// 稼動時間を計算
// 稼動時間 = 労働時間 - 休憩時間
function calculateWorkingHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;

  // 勤務開始・勤務終了を計算
  const workStartTime = calculateWorkStartTime(startTime);
  const workEndTime = calculateWorkEndTime(endTime);

  // 労働時間を計算（勤務開始〜勤務終了）
  const startMinutes = timeToMinutes(workStartTime);
  const endMinutes = timeToMinutes(workEndTime);
  const laborHours = (endMinutes - startMinutes) / 60;

  // 休憩時間を計算
  const breakTime = calculateBreakTime(startTime, endTime);

  // 稼動時間 = 労働時間 - 休憩時間
  const workingHours = laborHours - breakTime;

  return workingHours;
}

// プロジェクト別稼動時間を計算（按分と調整）
function calculateProjectWorkingHours(
  totalWorkingHours: number,
  projectCounts: Map<string, number>,
  allProjectKeys: string[]
): Map<string, number> {
  const projectWorkingHours = new Map<string, number>();

  // 稼動時間が0の場合、すべて0を返す
  if (totalWorkingHours === 0) {
    for (const projectKey of allProjectKeys) {
      projectWorkingHours.set(projectKey, 0);
    }
    return projectWorkingHours;
  }

  // 全件数を計算
  const totalCount = Array.from(projectCounts.values()).reduce((sum, count) => sum + count, 0);

  // 全件数が0の場合、すべて0を返す
  if (totalCount === 0) {
    for (const projectKey of allProjectKeys) {
      projectWorkingHours.set(projectKey, 0);
    }
    return projectWorkingHours;
  }

  // 1. 按分計算して0.5刻みで丸める（最小単位は0.5）
  for (const projectKey of allProjectKeys) {
    const count = projectCounts.get(projectKey) || 0;
    if (count === 0) {
      projectWorkingHours.set(projectKey, 0);
      continue;
    }
    const allocated = (totalWorkingHours * count) / totalCount;
    let rounded = Math.round(allocated * 2) / 2; // 0.5刻みで丸める
    if (rounded < 0.5) {
      rounded = 0.5; // 0.5未満（0.0を含む）は一律で0.5
    }
    projectWorkingHours.set(projectKey, rounded);
  }

  // 2. 合計値を計算
  let sum = Array.from(projectWorkingHours.values()).reduce((s, v) => s + v, 0);

  // 3. 合計値が稼動時間と一致するように調整
  while (Math.abs(sum - totalWorkingHours) > 0.01) {
    if (sum > totalWorkingHours) {
      // 合計値が多い場合：稼動の多い順に0.5減算
      const sortedByValue = Array.from(projectWorkingHours.entries())
        .filter(([_, value]) => value > 0) // 0より大きいもののみ
        .sort((a, b) => b[1] - a[1]); // 降順

      if (sortedByValue.length === 0) break;

      const [projectKey, currentValue] = sortedByValue[0];
      projectWorkingHours.set(projectKey, currentValue - 0.5);
      sum -= 0.5;
    } else {
      // 合計値が少ない場合：稼動の少ない順に0.5加算
      const sortedByValue = Array.from(projectWorkingHours.entries())
        .sort((a, b) => a[1] - b[1]); // 昇順

      const [projectKey, currentValue] = sortedByValue[0];
      projectWorkingHours.set(projectKey, currentValue + 0.5);
      sum += 0.5;
    }
  }

  return projectWorkingHours;
}

// サマリデータを集計
function aggregateSummary(activities: Activity[], month: string): SummaryData[] {
  // 業務日ごとにグルーピング
  const businessDayMap = new Map<string, Activity[]>();

  for (const activity of activities) {
    const businessDay = calculateBusinessDay(activity.datetime);
    if (!businessDayMap.has(businessDay)) {
      businessDayMap.set(businessDay, []);
    }
    businessDayMap.get(businessDay)!.push(activity);
  }

  // 全プロジェクトキーを収集
  const allProjectKeys = new Set<string>();
  for (const activity of activities) {
    allProjectKeys.add(activity.projectKey);
  }

  // 指定月の全日付を生成（1日〜月末まで）
  const startDate = dayjs(month);
  const daysInMonth = startDate.daysInMonth();
  const allDates: string[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    allDates.push(startDate.date(day).format('YYYY-MM-DD'));
  }

  // サマリデータを生成
  const summaryData: SummaryData[] = [];

  for (const date of allDates) {
    const dateActivities = businessDayMap.get(date) || [];

    if (dateActivities.length === 0) {
      // アクティビティがない日
      const projectStats = new Map<string, {
        count: number;
        minDatetime: string;
        maxDatetime: string;
      }>();

      const projectCounts = new Map<string, number>();

      for (const projectKey of allProjectKeys) {
        projectStats.set(projectKey, {
          count: 0,
          minDatetime: '',
          maxDatetime: '',
        });
        projectCounts.set(projectKey, 0);
      }

      // プロジェクト別稼動時間を計算（全て0になる）
      const projectWorkingHours = calculateProjectWorkingHours(
        0,
        projectCounts,
        Array.from(allProjectKeys)
      );

      summaryData.push({
        date,
        startTime: '',
        endTime: '',
        workingHours: 0,
        projectWorkingHours,
        projectStats,
      });
    } else {
      // アクティビティがある日
      // 全プロジェクトの最小・最大日時を計算
      const allDatetimes = dateActivities.map(a => dayjs(a.datetime, 'YYYY/MM/DD HH:mm:ss'));
      const minDatetime = allDatetimes.reduce((min, dt) => (dt.isBefore(min) ? dt : min));
      const maxDatetime = allDatetimes.reduce((max, dt) => (dt.isAfter(max) ? dt : max));

      // 開始時刻は原則 9:00、最小日時が 13:00 以降なら 13:00（午前半休）
      let startTime: string;
      const minHour = minDatetime.hour();
      if (minHour >= 13) {
        startTime = '13:00';
      } else {
        startTime = '9:00';
      }

      // 終了時刻は30分刻みで丸めて、深夜残業対応
      let roundedMaxDatetime = roundToNearest30Min(maxDatetime);

      // 丸めた終了時刻が15:00以降の場合、1時間減算（家事休憩を再現）
      const roundedHour = roundedMaxDatetime.hour();
      const roundedMinute = roundedMaxDatetime.minute();
      const roundedTimeInMinutes = roundedHour * 60 + roundedMinute;
      if (roundedTimeInMinutes >= 15 * 60) {
        roundedMaxDatetime = roundedMaxDatetime.subtract(1, 'hour');
      }

      const endTime = formatTimeWith24Plus(date, roundedMaxDatetime);

      // 稼動時間を計算
      const workingHours = calculateWorkingHours(startTime, endTime);

      // プロジェクト別に集計
      const projectStats = new Map<string, {
        count: number;
        minDatetime: string;
        maxDatetime: string;
      }>();

      const projectCounts = new Map<string, number>();

      for (const projectKey of allProjectKeys) {
        const projectActivities = dateActivities.filter(a => a.projectKey === projectKey);

        if (projectActivities.length === 0) {
          projectStats.set(projectKey, {
            count: 0,
            minDatetime: '',
            maxDatetime: '',
          });
          projectCounts.set(projectKey, 0);
        } else {
          const projectDatetimes = projectActivities.map(a => dayjs(a.datetime, 'YYYY/MM/DD HH:mm:ss'));
          const minDt = projectDatetimes.reduce((min, dt) => (dt.isBefore(min) ? dt : min));
          const maxDt = projectDatetimes.reduce((max, dt) => (dt.isAfter(max) ? dt : max));

          projectStats.set(projectKey, {
            count: projectActivities.length,
            minDatetime: minDt.format('YYYY/MM/DD HH:mm:ss'),
            maxDatetime: maxDt.format('YYYY/MM/DD HH:mm:ss'),
          });
          projectCounts.set(projectKey, projectActivities.length);
        }
      }

      // プロジェクト別稼動時間を計算
      const projectWorkingHours = calculateProjectWorkingHours(
        workingHours,
        projectCounts,
        Array.from(allProjectKeys)
      );

      summaryData.push({
        date,
        startTime,
        endTime,
        workingHours,
        projectWorkingHours,
        projectStats,
      });
    }
  }

  return summaryData;
}

// 明細 CSV を出力
async function writeDetailCsv(
  activities: Activity[],
  month: string,
  encoding: 'shift-jis' | 'utf-8'
): Promise<void> {
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const filePath = path.join(reportsDir, `${month}-report-detail.csv`);
  const tempFilePath = encoding === 'shift-jis' ? `${filePath}.tmp` : filePath;

  const csvWriter = createObjectCsvWriter({
    path: tempFilePath,
    header: [
      { id: 'datetime', title: '日時' },
      { id: 'projectKey', title: 'プロジェクトキー' },
      { id: 'projectName', title: 'プロジェクト名' },
      { id: 'activityType', title: 'アクティビティ種類' },
      { id: 'title', title: 'タイトル/概要' },
    ],
    encoding: 'utf8',
  });

  try {
    await csvWriter.writeRecords(activities);

    // Shift-JIS の場合は変換
    if (encoding === 'shift-jis') {
      const utf8Data = fs.readFileSync(tempFilePath, 'utf8');
      const shiftJisData = iconv.encode(utf8Data, 'shift-jis');
      fs.writeFileSync(filePath, shiftJisData);
      fs.unlinkSync(tempFilePath);
    }

    console.log(`明細CSVを出力しました: ${filePath}`);
  } catch (error) {
    console.error(`エラー: CSV ファイルの書き込みに失敗しました: ${error}`);
    process.exit(1);
  }
}

// サマリ CSV を出力
async function writeSummaryCsv(
  summaryData: SummaryData[],
  month: string,
  encoding: 'shift-jis' | 'utf-8'
): Promise<void> {
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const filePath = path.join(reportsDir, `${month}-report-summary.csv`);
  const tempFilePath = encoding === 'shift-jis' ? `${filePath}.tmp` : filePath;

  // 全プロジェクトキーをアルファベット順にソート
  const allProjectKeys = new Set<string>();
  for (const summary of summaryData) {
    for (const projectKey of summary.projectStats.keys()) {
      allProjectKeys.add(projectKey);
    }
  }
  const sortedProjectKeys = Array.from(allProjectKeys).sort();

  // ヘッダーを動的に生成
  const headers: Array<{ id: string; title: string }> = [
    { id: 'date', title: '日付' },
    { id: 'startTime', title: '開始時刻' },
    { id: 'endTime', title: '終了時刻' },
    { id: 'workingHours', title: '稼動時間' },
  ];

  // プロジェクト別稼動時間列を追加
  for (const projectKey of sortedProjectKeys) {
    headers.push({ id: `${projectKey}_workingHours`, title: projectKey });
  }

  // プロジェクト別統計列を追加
  for (const projectKey of sortedProjectKeys) {
    headers.push(
      { id: `${projectKey}_count`, title: `${projectKey}_件数` },
      { id: `${projectKey}_min`, title: `${projectKey}_最小日時` },
      { id: `${projectKey}_max`, title: `${projectKey}_最大日時` }
    );
  }

  // データ行を生成
  const records = summaryData.map(summary => {
    const record: Record<string, string | number> = {
      date: summary.date,
      startTime: summary.startTime,
      endTime: summary.endTime,
      workingHours: summary.workingHours,
    };

    // プロジェクト別稼動時間を追加
    for (const projectKey of sortedProjectKeys) {
      const projectWorkingHour = summary.projectWorkingHours.get(projectKey) || 0;
      record[`${projectKey}_workingHours`] = projectWorkingHour;
    }

    // プロジェクト別統計を追加
    for (const projectKey of sortedProjectKeys) {
      const stats = summary.projectStats.get(projectKey);
      if (stats) {
        record[`${projectKey}_count`] = stats.count;
        record[`${projectKey}_min`] = stats.minDatetime;
        record[`${projectKey}_max`] = stats.maxDatetime;
      } else {
        record[`${projectKey}_count`] = 0;
        record[`${projectKey}_min`] = '';
        record[`${projectKey}_max`] = '';
      }
    }

    return record;
  });

  const csvWriter = createObjectCsvWriter({
    path: tempFilePath,
    header: headers,
    encoding: 'utf8',
  });

  try {
    await csvWriter.writeRecords(records);

    // Shift-JIS の場合は変換
    if (encoding === 'shift-jis') {
      const utf8Data = fs.readFileSync(tempFilePath, 'utf8');
      const shiftJisData = iconv.encode(utf8Data, 'shift-jis');
      fs.writeFileSync(filePath, shiftJisData);
      fs.unlinkSync(tempFilePath);
    }

    console.log(`サマリCSVを出力しました: ${filePath}`);
  } catch (error) {
    console.error(`エラー: CSV ファイルの書き込みに失敗しました: ${error}`);
    process.exit(1);
  }
}

// メイン処理
async function main() {
  console.log('=== Backlog 月次報告書生成 ===\n');

  // 環境変数の検証
  const { spaceId, apiKey } = validateEnv();
  const domain = `${spaceId}.backlog.com`;

  // コマンドライン引数のパース
  const { month, encoding } = parseArguments();

  // ユーザー認証
  console.log('Backlog に接続中...');
  const userId = await authenticateUser(domain, apiKey);
  console.log(`認証成功（ユーザーID: ${userId}）\n`);

  // アクティビティ取得
  const rawActivities = await fetchActivities(domain, apiKey, userId, month);

  // Type 14 を分解
  const expandedActivities = expandBulkUpdates(rawActivities);

  // アクティビティを処理
  const activities: Activity[] = [];
  for (const activity of expandedActivities) {
    const processed = processActivity(activity, domain);
    if (processed) {
      activities.push(processed);
    }
  }

  console.log(`\n${activities.length} 件のアクティビティを処理しました。`);

  if (activities.length === 0) {
    console.log('対象月のアクティビティがありません。');
    return;
  }

  // 明細 CSV を出力
  await writeDetailCsv(activities, month, encoding);

  // サマリを集計
  const summaryData = aggregateSummary(activities, month);

  // サマリ CSV を出力
  await writeSummaryCsv(summaryData, month, encoding);

  console.log(`\n✅ 月次報告書を生成しました（合計 ${activities.length} 件のアクティビティ）`);
}

// エントリーポイント
main().catch(error => {
  console.error(`予期しないエラーが発生しました: ${error}`);
  process.exit(1);
});
