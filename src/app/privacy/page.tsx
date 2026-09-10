/**
 * 檔案：src/app/privacy/page.tsx  →  路由 /privacy
 * 角色：前端層 — 隱私政策
 */
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '隱私政策',
  description: 'AI-CAT 蒐集、使用與保存個人資料的方式，以及使用者的權利。',
  alternates: {
    canonical: '/privacy',
    languages: {
      'zh-Hant': '/privacy',
      en: '/privacy/en',
      'x-default': '/privacy',
    },
  },
};

const CONTACT = 'icguanyu@gmail.com';

export default function PrivacyPage() {
  return (
    <main className="legal">
      <div className="legal-nav">
        <Link className="back" href="/">
          ← 回首頁
        </Link>
        <Link className="back" href="/privacy/en">
          English
        </Link>
      </div>
      <h1>隱私政策</h1>
      <p className="updated">最後更新：2026-09-10</p>

      <p>
        AI-CAT（以下稱「本服務」）是一個 AI 能力檢測工具。使用本服務即表示你已閱讀並同意本政策。
      </p>

      <h2>一、我們蒐集哪些資料</h2>
      <ul>
        <li>
          <strong>帳號資料</strong>：透過 Google 登入時取得的電子郵件、顯示名稱、頭像網址，以及
          Google 帳號識別碼。
        </li>
        <li>
          <strong>檢測資料</strong>：你在測驗沙盒中輸入的訊息、AI 助手的回覆（提交後會與評分報告一起保存為
          <strong>完整對話逐字稿</strong>）、以及提交後產生的評分報告與能力分級。逐字稿用於顯示與還原你的結果、
          分析題目難易，以及改進評分模型。
        </li>
        <li>
          <strong>用量資料</strong>：每個帳號的免費檢測次數計數。
        </li>
        <li>
          <strong>技術資料</strong>：用於流量限制的來源 IP、以及伺服器端錯誤日誌。
        </li>
        <li>
          <strong>本機儲存</strong>：你的亮／暗色主題偏好、以及登入狀態，儲存在你瀏覽器的
          localStorage，不會傳送到我們的伺服器以外的地方。
        </li>
      </ul>

      <h2>二、使用目的</h2>
      <ul>
        <li>提供檢測服務、產生並顯示能力報告。</li>
        <li>計算與限制每個帳號的免費次數。</li>
        <li>防止濫用、維護服務穩定與控制成本。</li>
      </ul>
      <p>
        我們不會將你的個人資料出售、出租，或用於廣告投放與跨站追蹤。
      </p>

      <h2>三、第三方處理者</h2>
      <p>為提供服務，資料會經由下列第三方處理：</p>
      <ul>
        <li>
          <strong>Google</strong>：第三方登入（OAuth）。
        </li>
        <li>
          <strong>Supabase</strong>：使用者驗證與資料庫（帳號、報告、次數）。
        </li>
        <li>
          <strong>Upstash（Redis）</strong>：測驗進行中的暫存狀態。
        </li>
        <li>
          <strong>OpenAI</strong>：
          <strong>
            你在測驗中輸入的訊息與對話歷程，會傳送給 OpenAI 的模型
          </strong>
          以產生 AI 回覆與評分。請勿在對話中輸入個人機密、營業秘密或他人隱私資訊。
        </li>
        <li>
          <strong>Vercel</strong>：網站與 API 的代管與日誌。
        </li>
      </ul>

      <h2>四、保存期限</h2>
      <ul>
        <li>
          測驗進行中的即時暫存（Upstash）於該場結束或閒置約 1 小時後自動刪除。免登入試用的結果暫存約 72 小時後刪除。
        </li>
        <li>
          提交後的評分報告、對話逐字稿與帳號 / 個人資料，保存至你刪除帳號或提出刪除請求為止。
        </li>
      </ul>

      <h2>五、你的權利</h2>
      <p>
        你可以要求查詢、更正或刪除我們保存的你的個人資料與檢測紀錄。請來信{' '}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>，我們會在合理期間內處理。
        你也可以隨時停止使用本服務，並於 Google 帳號設定中撤銷本服務的授權。
      </p>

      <h2>六、資料安全</h2>
      <p>
        傳輸過程以 HTTPS 加密。伺服器端金鑰以環境變數保管，具高權限的資料庫金鑰不會出現在前端。
        但沒有任何系統能保證絕對安全，你了解並接受此風險。
      </p>
      <p>
        任何嘗試未經授權存取、破解、干擾、竄改本服務，或植入惡意程式碼之行為均被嚴格禁止，
        行為人可能因此負民事賠償及刑事責任，著作權人並保留一切法律追訴權；
        詳見<Link href="/ip">智慧財產權宣告</Link>「禁止行為」與「法律責任與權利保留」。
      </p>

      <h2>七、未成年人</h2>
      <p>
        本服務不針對未滿 13 歲之兒童設計。若你未達所在地法律規定之同意年齡，請在監護人同意下使用。
      </p>

      <h2>八、政策更新</h2>
      <p>
        我們可能不時修訂本政策，並更新本頁的「最後更新」日期。重大變更會於網站上以合理方式告知。
      </p>

      <p className="legal-footer">
        <Link href="/ip">智慧財產權宣告</Link> ·{' '}
        <Link href="/">回首頁</Link>
      </p>
    </main>
  );
}
