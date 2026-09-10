/**
 * 檔案：src/types/profile.ts
 * 角色：型別層 — 使用者自願自填的分群資料（年齡區間 / 學歷 / 性別）
 * 功能：封閉詞彙 + 中文標籤 + 收窄函式。存於 profiles 表，僅供彙總分析。
 *       Google 標準登入不提供這三項，一律靠使用者自填、可跳過。
 */

export type AgeBand =
  | '18_24'
  | '25_34'
  | '35_44'
  | '45_54'
  | '55_plus'
  | 'prefer_not';

export const AGE_BAND_LABEL: Record<AgeBand, string> = {
  '18_24': '18–24',
  '25_34': '25–34',
  '35_44': '35–44',
  '45_54': '45–54',
  '55_plus': '55 以上',
  prefer_not: '不願透露',
};

export type Education =
  | 'junior_high'
  | 'senior_high'
  | 'college'
  | 'master'
  | 'phd'
  | 'prefer_not';

export const EDUCATION_LABEL: Record<Education, string> = {
  junior_high: '國中以下',
  senior_high: '高中職',
  college: '專科／大學',
  master: '碩士',
  phd: '博士',
  prefer_not: '不願透露',
};

export type Gender = 'male' | 'female' | 'other' | 'prefer_not';

export const GENDER_LABEL: Record<Gender, string> = {
  male: '男',
  female: '女',
  other: '其他',
  prefer_not: '不願透露',
};

/** 使用者自填的分群欄位；未填為 null。 */
export interface ProfileExtras {
  ageBand: AgeBand | null;
  education: Education | null;
  gender: Gender | null;
}

export const AGE_BANDS = Object.keys(AGE_BAND_LABEL) as AgeBand[];
export const EDUCATIONS = Object.keys(EDUCATION_LABEL) as Education[];
export const GENDERS = Object.keys(GENDER_LABEL) as Gender[];

export function isAgeBand(v: unknown): v is AgeBand {
  return typeof v === 'string' && v in AGE_BAND_LABEL;
}
export function isEducation(v: unknown): v is Education {
  return typeof v === 'string' && v in EDUCATION_LABEL;
}
export function isGender(v: unknown): v is Gender {
  return typeof v === 'string' && v in GENDER_LABEL;
}

/** 三項都填了才算「完成」（選「不願透露」也算填）。 */
export function isProfileComplete(p: ProfileExtras): boolean {
  return p.ageBand != null && p.education != null && p.gender != null;
}
