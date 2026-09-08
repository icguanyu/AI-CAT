/**
 * 檔案：src/app/ip/page.tsx  →  路由 /ip
 * 角色：前端層 — 智慧財產權宣告
 */
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '智慧財產權宣告｜AI-CAT',
  description: 'AI-CAT 網站、原始碼、標誌與內容之著作權與使用規範。',
};

const CONTACT = 'icguanyu@gmail.com';

export default function IpPage() {
  return (
    <main className="legal">
      <div className="legal-nav">
        <Link className="back" href="/">
          ← 回首頁
        </Link>
        <Link className="back" href="/ip/en">
          English
        </Link>
      </div>
      <h1>智慧財產權宣告</h1>
      <p className="updated">最後更新：2026-09-08</p>

      <h2>一、著作權</h2>
      <p>
        © 2026 icguanyu. 版權所有，保留一切權利。
        本網站「AI-CAT — AI Competency Assessment Tool」之原始碼、介面與視覺設計、文件、
        評測題庫與提示（prompt）邏輯，均為著作權人之專有財產。
      </p>
      <p>
        本專案<strong>非開放原始碼軟體</strong>，未授予任何明示或默示之授權。
        未經著作權人事前書面同意，不得以任何形式重製、散布、公開傳輸、改作、出租，
        或用於商業目的。
      </p>

      <h2>二、名稱與標誌</h2>
      <p>
        「AI-CAT」名稱、貓形標誌（logomark）及相關視覺識別為本服務之標識。
        不得以可能造成混淆、或使人誤認為與本服務有關聯、贊助或背書的方式使用。
      </p>

      <h2>三、使用者輸入內容</h2>
      <p>
        你在測驗中輸入的文字，其權利仍屬於你。為提供服務所需，你授予本服務
        一項非專屬、免權利金之授權，得處理該內容以：傳送給 AI 模型產生回覆與評分、
        產生你的能力報告、以及在你的帳號下留存檢測紀錄。相關處理方式詳見{' '}
        <Link href="/privacy">隱私政策</Link>。
      </p>

      <h2>四、第三方素材</h2>
      <ul>
        <li>AI 模型與其輸出：依 OpenAI 之服務條款與使用政策。</li>
        <li>
          字型：Noto Sans TC 與 IBM Plex Mono，依 SIL Open Font License 1.1 授權。
        </li>
      </ul>

      <h2>五、AI 產生內容之免責</h2>
      <p>
        能力報告、分級、「L5 示範」等內容由 AI 模型產生，可能不完整或有誤，
        僅供學習與自我參考，<strong>不構成專業意見或任何形式的保證</strong>。
      </p>

      <h2>六、禁止行為</h2>
      <p>使用本網站時，不得從事下列行為：</p>
      <ul>
        <li>
          對本服務之原始碼或編譯後程式進行還原工程、反組譯、反編譯，或以任何方式
          取得、重建未公開之原始碼、演算法或提示（prompt）邏輯。
        </li>
        <li>
          破解、規避或停用任何技術保護措施、存取控制、身分驗證或流量限制機制。
        </li>
        <li>
          植入、散布或執行惡意程式、後門、病毒、指令碼或任何足以干擾、破壞、竄改
          本服務、其資料或其他使用者權益之程式碼。
        </li>
        <li>
          未經授權存取本服務之伺服器、資料庫、帳號或非公開資料，或進行滲透測試、
          漏洞掃描、壓力測試等未獲事前書面同意之安全測試行為。
        </li>
        <li>
          以自動化程式大量擷取內容、盜用 API，或以任何方式規避使用次數限制。
        </li>
        <li>移除、遮蔽或變更任何著作權標示、本宣告或其他權利標記。</li>
      </ul>

      <h2>七、法律責任與權利保留</h2>
      <p>
        前條所列行為可能違反《著作權法》、《營業秘密法》、《刑法》妨害電腦使用罪章
        （第三五八條至第三六三條）及其他相關法令，並須依《民法》負損害賠償責任。
      </p>
      <p>
        著作權人<strong>保留一切法律追訴權</strong>。對於任何未經授權之重製、散布、
        破解、竄改、惡意攻擊或程式碼濫用行為，著作權人得依法追究行為人之民事與刑事責任；
        行為人並應賠償因此所生之一切損害，包括但不限於：服務中斷、修復與重建費用、
        營運及財務損失、商譽損害、調查與訴訟費用及律師費。
      </p>
      <p>
        本宣告未授予、亦不得解釋為授予任何規避上述限制之權利。縱使本服務之部分程式碼
        因技術原因可於瀏覽器端被檢視，亦不代表著作權人拋棄其權利，或同意其被重製、
        改作或再利用。
      </p>

      <h2>八、侵權通知與聯絡</h2>
      <p>
        若你認為本網站有內容侵害你的權利，或對本宣告有疑問，請來信{' '}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>。
      </p>

      <p className="legal-footer">
        <Link href="/privacy">隱私政策</Link> · <Link href="/">回首頁</Link>
      </p>
    </main>
  );
}
