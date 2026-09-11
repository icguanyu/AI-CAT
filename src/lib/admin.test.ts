/**
 * 檔案：src/lib/admin.test.ts
 * 測 isAdminEmail() / isReviewerEmail()——後台權限判斷最基礎的一塊。
 *
 * 白話說明：這兩個函式決定「這個 email 算不算後台管理員／標註員」，做法只是比對環境變數
 * ADMIN_EMAILS／REVIEWER_EMAILS（逗號分隔的名單）。這裡故意連「大小寫」「名單留空」
 * 「email 前後有空格」這些邊界情況都測到——因為權限判斷這種東西，一旦某個邊界情況判斷錯，
 * 後果是「多開了一扇門」（安全漏洞）或「把自己鎖在外面」（真的管理員登不進去），修正成本
 * 比一般 UI 排版錯誤高很多，值得多花幾個測試案例把它釘死。
 *
 * requireAdmin()／requireReviewer() 這兩個還會呼叫 requireAuth()（驗證登入 session）
 * 的函式，這次先不測——要測就得 mock 掉 Supabase 那層，之後有需要再補。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { isAdminEmail, isReviewerEmail } from './admin';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('isAdminEmail', () => {
  it('email 在 ADMIN_EMAILS 名單內 → true', () => {
    process.env.ADMIN_EMAILS = 'a@x.com,b@x.com';
    expect(isAdminEmail('a@x.com')).toBe(true);
  });

  it('email 不在名單內 → false', () => {
    process.env.ADMIN_EMAILS = 'a@x.com,b@x.com';
    expect(isAdminEmail('c@x.com')).toBe(false);
  });

  it('大小寫不敏感（Google 登入信箱大小寫本來就可能不一致）', () => {
    process.env.ADMIN_EMAILS = 'a@x.com';
    expect(isAdminEmail('A@X.COM')).toBe(true);
  });

  it('名單裡的 email 前後有空格也要認得出來（逗號分隔容易手滑打空格）', () => {
    process.env.ADMIN_EMAILS = ' a@x.com , b@x.com ';
    expect(isAdminEmail('a@x.com')).toBe(true);
  });

  it('ADMIN_EMAILS 完全沒設 → 一律 false（fail closed：寧可錯擋，不能錯放）', () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdminEmail('anyone@x.com')).toBe(false);
  });

  it('email 是 null / undefined（例如登入資訊缺失）→ false，不會噴錯', () => {
    process.env.ADMIN_EMAILS = 'a@x.com';
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
});

describe('isReviewerEmail', () => {
  it('邏輯跟 isAdminEmail 一致，只是看的環境變數換成 REVIEWER_EMAILS', () => {
    process.env.REVIEWER_EMAILS = 'friend@x.com';
    expect(isReviewerEmail('friend@x.com')).toBe(true);
    expect(isReviewerEmail('stranger@x.com')).toBe(false);
  });
});
