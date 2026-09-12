/**
 * 檔案：src/app/privacy/en/page.tsx  →  路由 /privacy/en
 * 角色：前端層 — 隱私政策（英文版，內容與 /privacy 對應）
 */
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How AI-CAT collects, uses, and retains personal data, and your rights.',
  alternates: {
    canonical: '/privacy/en',
    languages: {
      'zh-Hant': '/privacy',
      en: '/privacy/en',
      'x-default': '/privacy',
    },
  },
};

const CONTACT = 'icguanyu@gmail.com';

export default function PrivacyEnPage() {
  return (
    <main className="legal">
      <div className="legal-nav">
        <Link className="back" href="/">
          ← Home
        </Link>
        <Link className="back" href="/privacy">
          中文
        </Link>
      </div>
      <h1>Privacy Policy</h1>
      <p className="updated">Last updated: 2026-09-12</p>

      <p>
        AI-CAT (the &ldquo;Service&rdquo;) is an AI competency assessment tool. By
        using the Service, you acknowledge that you have read and agree to this
        Policy. In case of any discrepancy between this English version and the{' '}
        <Link href="/privacy">Traditional Chinese version</Link>, the Chinese
        version prevails.
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong>: the email address, display name (given /
          family name), locale, avatar URL, and Google account identifier
          obtained when you sign in with Google.
        </li>
        <li>
          <strong>Optional profile data</strong>: on &ldquo;My records&rdquo; you
          may voluntarily provide an age band, education level, and gender. You
          can skip or change these at any time; they are used only for aggregate
          analysis and never shown on your report or share card.
        </li>
        <li>
          <strong>Assessment data</strong>: the messages you enter in the
          assessment sandbox and the AI assistant&rsquo;s replies (retained after
          you submit as the <strong>full conversation transcript</strong>,
          alongside the scoring report), plus the scoring report and competency
          level generated after you submit. The transcript is used to display and
          restore your result, analyse scenario difficulty, and improve the
          scoring model.
        </li>
        <li>
          <strong>Usage data</strong>: the free-assessment count for each
          account.
        </li>
        <li>
          <strong>Technical data</strong>: the source IP address used for rate
          limiting, and server-side error logs.
        </li>
        <li>
          <strong>Local storage</strong>: your light/dark theme preference and
          sign-in state, stored in your browser&rsquo;s localStorage; these are
          not transmitted anywhere beyond our servers.
        </li>
      </ul>

      <h2>2. How we use it</h2>
      <ul>
        <li>
          To provide the assessment service and generate and display your
          competency report.
        </li>
        <li>To count and limit the free assessments for each account.</li>
        <li>
          To prevent abuse, maintain service stability, and control costs.
        </li>
      </ul>
      <p>
        We do not sell or rent your personal data, and we do not use it for
        advertising or cross-site tracking.
      </p>

      <h2>3. Third-party processors</h2>
      <p>To provide the Service, data is processed by the following parties:</p>
      <ul>
        <li>
          <strong>Google</strong>: third-party sign-in (OAuth); and Google
          Analytics for site traffic analysis (page views, referrers, device
          type, etc. — does not include your conversation content).
        </li>
        <li>
          <strong>Supabase</strong>: user authentication and database (accounts,
          reports, counts).
        </li>
        <li>
          <strong>Upstash (Redis)</strong>: transient state during an
          assessment.
        </li>
        <li>
          <strong>OpenAI</strong>:{' '}
          <strong>
            the messages and conversation history you enter during an assessment
            are sent to OpenAI&rsquo;s models
          </strong>{' '}
          to generate AI replies and scoring. Do not enter personal
          confidential information, trade secrets, or others&rsquo; private
          information into the conversation.
        </li>
        <li>
          <strong>Vercel</strong>: hosting and logging for the website and
          API, plus Speed Insights performance monitoring.
        </li>
      </ul>

      <h2>4. Retention</h2>
      <ul>
        <li>
          Transient in-session state during an assessment (Upstash) is deleted
          automatically after the session ends or is idle for about 1 hour.
          Results of a no-login trial are deleted after about 72 hours.
        </li>
        <li>
          Submitted scoring reports, conversation transcripts, and account /
          personal data are retained until you delete your account or submit a
          deletion request.
        </li>
      </ul>

      <h2>5. Your rights</h2>
      <p>
        You may request access to, correction of, or deletion of the personal
        data and assessment records we hold about you. Email{' '}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a> and we will act within a
        reasonable period. You may also stop using the Service at any time and
        revoke the Service&rsquo;s authorization in your Google account settings.
      </p>

      <h2>6. Data security</h2>
      <p>
        Data in transit is encrypted with HTTPS. Server-side keys are kept as
        environment variables, and high-privilege database keys are never
        exposed to the front end. However, no system can guarantee absolute
        security, and you understand and accept this risk.
      </p>
      <p>
        Any attempt to access, crack, interfere with, or tamper with the
        Service without authorization, or to inject malicious code, is strictly
        prohibited. Offenders may bear civil liability and criminal
        responsibility, and the copyright holder reserves all rights to pursue
        legal action; see the{' '}
        <Link href="/ip/en">Intellectual Property Notice</Link>, sections
        &ldquo;Prohibited Conduct&rdquo; and &ldquo;Legal Liability and
        Reservation of Rights&rdquo;.
      </p>

      <h2>7. Minors</h2>
      <p>
        The Service is not designed for children under 13. If you are below the
        age of consent under the laws of your jurisdiction, please use the
        Service with the consent of a guardian.
      </p>

      <h2>8. Changes to this Policy</h2>
      <p>
        We may revise this Policy from time to time and update the &ldquo;Last
        updated&rdquo; date on this page. Material changes will be announced on
        the website by reasonable means.
      </p>

      <p className="legal-footer">
        <Link href="/ip/en">Intellectual Property Notice</Link> ·{' '}
        <Link href="/">Home</Link>
      </p>
    </main>
  );
}
