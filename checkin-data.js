/* 小组打卡统计系统 - 共享数据层
 * 成员：阿姜（组长）+ 10 位组员
 * 项目：M = Morning Ritual, R = Reading Session, D = Daily Reflection
 */

const MEMBERS = [
  '阿姜', 'Jancy', '龍', 'yz', '火烧云',
  '谭永春', '森屿', '湫枫', '董睿尧', '憧霖', '进步'
];

const PROJECTS = [
  { key: 'M', slug: 'morning',  name: 'Morning Ritual',   short: 'M', color: '#a8d8f0' },
  { key: 'R', slug: 'reading',  name: 'Reading Session',  short: 'R', color: '#d0c0f0' },
  { key: 'D', slug: 'reflection', name: 'Daily Reflection', short: 'D', color: '#f0d8b0' }
];

const STORAGE_KEY = 'checkin_records_v1';

// 组长密码：以 SHA-256(盐 + 明文) 哈希存储。源码与部署包里只有哈希值，没有明文，
// 因此公开分享部署链接也不会泄露真实密码。修改密码：把下面哈希替换为 sha256(ADMIN_SALT + '新密码')。
const ADMIN_SALT = 'checkin-team-salt-2026';
const ADMIN_PWD_HASH = '95566e0f889ef2d737c71b75042718c19f2b185406024bbbe40b1cc8049da2ed';

function getRecords() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch (e) { return {}; }
}

function setRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** 确保某天有默认全勤记录 */
function ensureDay(dateStr) {
  const records = getRecords();
  if (!records[dateStr]) {
    records[dateStr] = {};
    for (const m of MEMBERS) records[dateStr][m] = { M: true, R: true, D: true };
    setRecords(records);
  }
  return records;
}

/** 设置某人某天某项目是否缺席 */
function setAbsence(dateStr, member, projectKey, absent = true) {
  const records = getRecords();
  if (!records[dateStr]) records[dateStr] = {};
  if (!records[dateStr][member]) records[dateStr][member] = { M: true, R: true, D: true };
  records[dateStr][member][projectKey] = !absent;
  setRecords(records);
}

/** 解析快速输入，例如 "龍M yzR 火烧云D" */
function parseAbsenceInput(text) {
  const tokens = text.split(/[\s,，]+/).filter(Boolean);
  const result = [];
  for (const t of tokens) {
    const match = t.match(/^(.+?)([MRD])$/i);
    if (!match) continue;
    const member = match[1];
    const key = match[2].toUpperCase();
    if (MEMBERS.includes(member)) result.push({ member, key });
  }
  return result;
}

/** 重置 8/1 起 31 天全部为全勤（干净起点，无模拟缺席数据） */
function resetAllComplete() {
  const records = {};
  const start = new Date('2026-08-01');
  const end = new Date(start); end.setDate(start.getDate() + 30);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ds = d.toISOString().slice(0, 10);
    records[ds] = {};
    for (const m of MEMBERS) records[ds][m] = { M: true, R: true, D: true };
  }
  setRecords(records);
}

/** 清空所有打卡记录（彻底归零）。统计页会显示“暂无数据”，需从 8/1 起重新记录 */
function clearAllData() {
  setRecords({});
}

/** 仅用于 Admin 界面渲染的默认全勤视图，不会写入 localStorage（用户真正改动后才落盘） */
function buildDefaultDay() {
  const day = {};
  for (const m of MEMBERS) day[m] = { M: true, R: true, D: true };
  return day;
}

/** 获取某项目的完整统计 */
function getStatsForProject(projectKey) {
  const records = getRecords();
  const dates = Object.keys(records).sort();
  const totalDays = dates.length || 1;

  const memberStats = {};
  for (const m of MEMBERS) {
    memberStats[m] = { present: 0, absent: 0, streak: 0, maxStreak: 0, absences: [] };
  }

  const defaultMemberDay = { M: true, R: true, D: true };
  const daily = [];
  for (const ds of dates) {
    const day = records[ds] || {};
    let presentCount = 0;
    for (const m of MEMBERS) {
      const memberDay = day[m] || defaultMemberDay;
      const ok = memberDay[projectKey];
      if (ok) {
        memberStats[m].present++;
        presentCount++;
      } else {
        memberStats[m].absent++;
        memberStats[m].absences.push(ds);
      }
    }
    daily.push({ date: ds, present: presentCount, total: MEMBERS.length, rate: presentCount / MEMBERS.length });
  }

  // 连续天数
  for (const m of MEMBERS) {
    let cur = 0, max = 0;
    for (const ds of dates) {
      const memberDay = records[ds][m] || defaultMemberDay;
      if (memberDay[projectKey]) { cur++; max = Math.max(max, cur); }
      else cur = 0;
    }
    memberStats[m].streak = cur;
    memberStats[m].maxStreak = max;
  }

  return { dates, daily, memberStats, totalDays };
}

// 注意：不再在首次访问时自动建立全勤底表。数据从 8/1 起由 Admin 后台真实记录，
// 未记录任何数据时统计页显示“暂无数据”。“重置为全勤”按钮可随时重建 8/1 起全勤底表。

/** URL slug → project key */
function projectBySlug(slug) {
  return PROJECTS.find(p => p.slug === slug) || PROJECTS[0];
}
